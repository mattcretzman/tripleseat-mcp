/**
 * OAuth 2.1 Authorization Code flow with PKCE for MCP protocol auth.
 *
 * Claude's MCP Connector discovers this via /.well-known/oauth-authorization-server,
 * registers dynamically, then redirects the user to /oauth/authorize for login.
 */

import crypto from "node:crypto";
import { query, queryOne } from "./db.js";

const ACCESS_TOKEN_TTL = 24 * 60 * 60;       // 24 hours (seconds)
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60;  // 30 days (seconds)
const AUTH_CODE_TTL = 10 * 60;                 // 10 minutes (seconds)

// ── OAuth Server Metadata ──

export function getMetadata(issuer: string) {
  return {
    issuer,
    authorization_endpoint: issuer + "/oauth/authorize",
    token_endpoint: issuer + "/oauth/token",
    registration_endpoint: issuer + "/oauth/register",
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["read"],
  };
}

// ── Dynamic Client Registration (RFC 7591) ──

export async function registerClient(
  name?: string,
  redirectUris?: string[]
): Promise<{ client_id: string; client_name: string; redirect_uris: string[] }> {
  const clientId = "mcp_" + crypto.randomBytes(16).toString("hex");
  const clientName = name || "MCP Client";
  const uris = redirectUris || [];

  await query(
    `INSERT INTO mcp_oauth_clients (client_id, client_name, redirect_uris)
     VALUES ($1, $2, $3)`,
    [clientId, clientName, uris]
  );

  return { client_id: clientId, client_name: clientName, redirect_uris: uris };
}

export async function getClient(clientId: string): Promise<{ client_id: string; redirect_uris: string[] } | null> {
  return queryOne<{ client_id: string; redirect_uris: string[] }>(
    `SELECT client_id, redirect_uris FROM mcp_oauth_clients WHERE client_id = $1`,
    [clientId]
  );
}

// ── Authorization Codes ──

export async function createAuthCode(
  userId: string,
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
  codeChallengeMethod: string = "S256"
): Promise<string> {
  const code = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + AUTH_CODE_TTL * 1000).toISOString();

  await query(
    `INSERT INTO mcp_oauth_codes (code, user_id, client_id, redirect_uri, code_challenge, code_challenge_method, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [code, userId, clientId, redirectUri, codeChallenge, codeChallengeMethod, expiresAt]
  );

  return code;
}

// ── Token Exchange ──

interface TokenResult {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export async function exchangeCode(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<TokenResult> {
  const row = await queryOne<{
    code: string;
    user_id: string;
    client_id: string;
    redirect_uri: string;
    code_challenge: string;
    code_challenge_method: string;
    expires_at: string;
    used: boolean;
  }>(
    `SELECT * FROM mcp_oauth_codes WHERE code = $1`,
    [code]
  );

  if (!row) throw new OAuthError("invalid_grant", "Authorization code not found");
  if (row.used) throw new OAuthError("invalid_grant", "Authorization code already used");
  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw new OAuthError("invalid_grant", "Authorization code expired");
  }
  if (row.redirect_uri !== redirectUri) {
    throw new OAuthError("invalid_grant", "Redirect URI mismatch");
  }

  // PKCE verification
  const expectedChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  if (expectedChallenge !== row.code_challenge) {
    throw new OAuthError("invalid_grant", "PKCE code_verifier does not match code_challenge");
  }

  // Mark code as used
  await query(`UPDATE mcp_oauth_codes SET used = true WHERE code = $1`, [code]);

  return issueTokenPair(row.user_id, row.client_id);
}

// ── Refresh Token ──

export async function refreshAccessToken(refreshToken: string): Promise<TokenResult> {
  const refreshHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

  const row = await queryOne<{
    token_hash: string;
    user_id: string;
    client_id: string;
    refresh_expires_at: string;
  }>(
    `SELECT token_hash, user_id, client_id, refresh_expires_at
     FROM mcp_oauth_tokens
     WHERE refresh_token_hash = $1`,
    [refreshHash]
  );

  if (!row) throw new OAuthError("invalid_grant", "Refresh token not found");
  if (new Date(row.refresh_expires_at).getTime() < Date.now()) {
    throw new OAuthError("invalid_grant", "Refresh token expired");
  }

  // Delete the old token pair (rotation)
  await query(`DELETE FROM mcp_oauth_tokens WHERE token_hash = $1`, [row.token_hash]);

  return issueTokenPair(row.user_id, row.client_id);
}

// ── Token Validation (for /mcp middleware) ──

export interface TokenInfo {
  userId: string;
  clientId: string;
}

export async function validateToken(accessToken: string): Promise<TokenInfo | null> {
  const tokenHash = crypto.createHash("sha256").update(accessToken).digest("hex");

  const row = await queryOne<{ user_id: string; client_id: string; expires_at: string }>(
    `SELECT user_id, client_id, expires_at FROM mcp_oauth_tokens WHERE token_hash = $1`,
    [tokenHash]
  );

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  return { userId: row.user_id, clientId: row.client_id };
}

// ── Helpers ──

async function issueTokenPair(userId: string, clientId: string): Promise<TokenResult> {
  const accessToken = "mcp_at_" + crypto.randomBytes(32).toString("hex");
  const refreshToken = "mcp_rt_" + crypto.randomBytes(32).toString("hex");

  const tokenHash = crypto.createHash("sha256").update(accessToken).digest("hex");
  const refreshHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

  const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL * 1000).toISOString();
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000).toISOString();

  await query(
    `INSERT INTO mcp_oauth_tokens (token_hash, user_id, client_id, expires_at, refresh_token_hash, refresh_expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tokenHash, userId, clientId, accessExpiresAt, refreshHash, refreshExpiresAt]
  );

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL,
    refresh_token: refreshToken,
    scope: "read",
  };
}

export class OAuthError extends Error {
  code: string;
  constructor(code: string, description: string) {
    super(description);
    this.code = code;
  }
}

// ── Login Page HTML ──

export function renderLoginPage(params: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string;
  error?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TripleSeat MCP - Sign In</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #0a0a0a; --surface: #141414; --border: #262626;
      --text: #ededed; --text-secondary: #888888;
      --accent: #0070f3; --accent-hover: #0060d3;
      --danger: #ff4444; --danger-subtle: rgba(255, 68, 68, 0.1);
      --radius: 8px; --radius-sm: 6px;
      --font: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    }
    body {
      background: var(--bg); color: var(--text); font-family: var(--font);
      font-size: 14px; line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 20px;
    }
    .card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; padding: 40px; width: 100%; max-width: 400px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    }
    .card h1 { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
    .card .subtitle { color: var(--text-secondary); font-size: 13px; margin-bottom: 28px; }
    label { display: block; font-size: 13px; font-weight: 500; color: var(--text-secondary); margin-bottom: 6px; }
    input[type="email"], input[type="password"] {
      width: 100%; padding: 10px 12px; background: var(--bg);
      border: 1px solid var(--border); border-radius: var(--radius-sm);
      color: var(--text); font-size: 14px; font-family: var(--font);
      outline: none; transition: border-color 0.15s; margin-bottom: 16px;
    }
    input:focus { border-color: var(--accent); }
    .error-msg {
      background: var(--danger-subtle); color: var(--danger);
      padding: 10px 12px; border-radius: var(--radius-sm);
      font-size: 13px; margin-bottom: 16px;
      border: 1px solid rgba(255, 68, 68, 0.2);
    }
    .btn {
      width: 100%; padding: 10px 16px; font-size: 13px; font-weight: 500;
      font-family: var(--font); border-radius: var(--radius-sm);
      border: 1px solid var(--accent); background: var(--accent);
      color: white; cursor: pointer; transition: background 0.15s; margin-top: 4px;
    }
    .btn:hover { background: var(--accent-hover); }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: var(--text-secondary); }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <h1>Sign In</h1>
      <p class="subtitle">Authorize Claude to access TripleSeat data</p>
      ${params.error ? `<div class="error-msg">${escapeHtml(params.error)}</div>` : ""}
      <form method="POST" action="/oauth/authorize">
        <input type="hidden" name="client_id" value="${escapeHtml(params.clientId)}">
        <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}">
        <input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}">
        <input type="hidden" name="code_challenge_method" value="${escapeHtml(params.codeChallengeMethod)}">
        <input type="hidden" name="state" value="${escapeHtml(params.state)}">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" placeholder="you@example.com" autofocus required>
        <label for="password">Password</label>
        <input type="password" id="password" name="password" placeholder="Enter your password" required>
        <button type="submit" class="btn">Sign In &amp; Authorize</button>
      </form>
      <p class="footer">TripleSeat MCP &middot; Stormbreaker Digital</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
