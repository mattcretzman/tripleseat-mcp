/**
 * TripleSeat OAuth 2.0 Authentication — Authorization Code Flow
 *
 * TripleSeat requires the Authorization Code flow (not client_credentials)
 * because API calls need a "resource owner" (user) context.
 *
 * Setup flow (one-time):
 * 1. Visit /auth/login on the deployed server
 * 2. Log in to TripleSeat and authorize the app
 * 3. The callback captures tokens and stores them in the database
 *
 * Runtime flow:
 * - Reads the stored access_token from the database
 * - If expired, attempts refresh_token grant
 * - If refresh fails, requires re-authorization via /auth/login
 */

import { query, queryOne } from "./db.js";

const TOKEN_URL = "https://api.tripleseat.com/oauth2/token";

// Authorize endpoint is on login.tripleseat.com
const AUTHORIZE_URL = "https://login.tripleseat.com/oauth2/authorize";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  created_at?: number;
}

interface CachedToken {
  access_token: string;
  expires_at: number;
}

let cachedToken: CachedToken | null = null;

function getCredentials() {
  const clientId = process.env.TRIPLESEAT_CLIENT_ID;
  const clientSecret = process.env.TRIPLESEAT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing TripleSeat API credentials. Set TRIPLESEAT_CLIENT_ID and TRIPLESEAT_CLIENT_SECRET environment variables."
    );
  }
  return { clientId, clientSecret };
}

/**
 * Build the authorization URL for the one-time OAuth setup.
 */
export function getAuthorizeUrl(redirectUri: string): string {
  const { clientId } = getCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "read",
  });
  return AUTHORIZE_URL + "?" + params.toString();
}

/**
 * Exchange an authorization code for access + refresh tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const { clientId, clientSecret } = getCredentials();

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      "Token exchange failed (" + response.status + "): " + responseText.substring(0, 500)
    );
  }

  return JSON.parse(responseText) as TokenResponse;
}

/**
 * Store tokens from the OAuth callback in the database.
 * This is called once after the authorization code exchange.
 */
export async function storeTokens(tokens: TokenResponse): Promise<void> {
  const expiresIn = tokens.expires_in || 7200;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  // Upsert into a tripleseat_tokens table (single row, id='primary')
  await query(
    `INSERT INTO tripleseat_tokens (id, access_token, refresh_token, expires_at, updated_at)
     VALUES ('primary', $1, $2, $3, NOW())
     ON CONFLICT (id) DO UPDATE SET
       access_token = $1,
       refresh_token = $2,
       expires_at = $3,
       updated_at = NOW()`,
    [tokens.access_token, tokens.refresh_token || null, expiresAt.toISOString()]
  );

  // Also update in-memory cache
  cachedToken = {
    access_token: tokens.access_token,
    expires_at: expiresAt.getTime(),
  };

  console.log("[Auth] Stored new tokens, expires at:", expiresAt.toISOString());
}

/**
 * Get a valid access token. Priority:
 * 1. In-memory cache (fastest)
 * 2. Database-stored token (survives cold starts)
 * 3. Attempt refresh_token grant
 * 4. Fail with re-auth required message
 */
export async function getAccessToken(): Promise<string> {
  // 1. Return cached token if still valid (5-min buffer)
  if (cachedToken && Date.now() < cachedToken.expires_at - 300_000) {
    return cachedToken.access_token;
  }

  // 2. Check database for stored token
  try {
    const row = await queryOne<{
      access_token: string;
      refresh_token: string | null;
      expires_at: string;
    }>(
      `SELECT access_token, refresh_token, expires_at FROM tripleseat_tokens WHERE id = 'primary'`
    );

    if (row) {
      const expiresAt = new Date(row.expires_at).getTime();

      // If DB token is still valid (5-min buffer)
      if (Date.now() < expiresAt - 300_000) {
        cachedToken = { access_token: row.access_token, expires_at: expiresAt };
        console.log("[Auth] Using stored access token, expires:", row.expires_at);
        return row.access_token;
      }

      // 3. Try to refresh using the stored refresh token
      if (row.refresh_token) {
        console.log("[Auth] Access token expired/expiring, attempting refresh...");
        try {
          const newTokens = await refreshAccessToken(row.refresh_token);
          // CRITICAL: TripleSeat uses rotating refresh tokens. The old one is now
          // invalid. We MUST save the new refresh_token or we lose access permanently.
          try {
            await storeTokens(newTokens);
          } catch (storeErr: any) {
            console.error("[Auth] CRITICAL: Got new tokens but failed to store them:", storeErr.message);
            // Retry once
            try { await storeTokens(newTokens); } catch {}
          }
          return newTokens.access_token;
        } catch (refreshErr: any) {
          console.log("[Auth] Refresh failed:", refreshErr.message);
          // Fall through to env var fallback or error
        }
      }
    }
  } catch (dbErr: any) {
    console.log("[Auth] DB token lookup failed:", dbErr.message);
    // Fall through to env var fallback
  }

  // 4. Legacy fallback: try env var refresh token
  const envRefreshToken = process.env.TRIPLESEAT_REFRESH_TOKEN;
  if (envRefreshToken) {
    console.log("[Auth] Trying env var refresh token...");
    try {
      const newTokens = await refreshAccessToken(envRefreshToken);
      // Store in DB for future use
      try { await storeTokens(newTokens); } catch {}
      return newTokens.access_token;
    } catch (refreshErr: any) {
      console.log("[Auth] Env refresh token also failed:", refreshErr.message);
    }
  }

  throw new Error(
    "TripleSeat access token expired and refresh failed. Visit /auth/login to re-authorize."
  );
}

/**
 * Attempt to refresh the access token using a refresh_token grant.
 */
async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = getCredentials();

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      "TripleSeat token refresh failed (" + response.status + "): " + responseText.substring(0, 500)
    );
  }

  if (responseText.trimStart().startsWith("<")) {
    throw new Error(
      "TripleSeat returned HTML instead of JSON during token refresh (status " +
        response.status + ")"
    );
  }

  let data: TokenResponse;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    throw new Error(
      "TripleSeat returned invalid JSON during token refresh: " +
        responseText.substring(0, 300)
    );
  }

  return data;
}

export function clearTokenCache(): void {
  cachedToken = null;
}

export function hasCredentials(): boolean {
  return !!(
    process.env.TRIPLESEAT_CLIENT_ID && process.env.TRIPLESEAT_CLIENT_SECRET
  );
}

export function hasRefreshToken(): boolean {
  return !!process.env.TRIPLESEAT_REFRESH_TOKEN;
}
