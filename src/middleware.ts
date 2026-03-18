/**
 * Express middleware for API key auth and admin session auth.
 */

import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { validateKey } from "./api-keys.js";
import { query, queryOne } from "./db.js";

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      apiKeyId?: string;
      apiKeyLabel?: string;
      role?: {
        id: string;
        name: string;
        allowed_tools: string[];
      };
      hasApiKey?: boolean;
    }
  }
}

/**
 * API key authentication middleware for the /mcp endpoint.
 *
 * If a Bearer token is provided, validates it and attaches role info.
 * If no token is provided, allows the request through for backward
 * compatibility but sets hasApiKey = false so tools aren't filtered.
 */
export async function apiKeyAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // No API key — allow through for backward compatibility
    req.hasApiKey = false;
    next();
    return;
  }

  const token = authHeader.substring(7);

  try {
    // First try: direct API key validation (ts_ prefix)
    let result = await validateKey(token);

    // Second try: OAuth token validation (oauth_ prefix)
    if (!result && token.startsWith("oauth_")) {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      // Look up the OAuth session to find the API key ID
      const session = await queryOne<{ id: string }>(
        `SELECT id FROM mcp_admin_sessions WHERE id LIKE $1 AND expires_at > NOW()`,
        ["oauth:" + tokenHash + ":%"]
      );

      if (session) {
        // Extract the API key ID from the session ID format: "oauth:<hash>:<keyId>"
        const parts = session.id.split(":");
        const keyId = parts[2];

        // Look up the key and role directly
        const keyRow = await queryOne<any>(
          `SELECT k.*, r.name AS role_name, r.allowed_tools AS role_allowed_tools
           FROM mcp_api_keys k
           JOIN mcp_roles r ON r.id = k.role_id
           WHERE k.id = $1 AND k.is_active = true`,
          [keyId]
        );

        if (keyRow) {
          result = {
            apiKey: keyRow,
            role: {
              id: keyRow.role_id,
              name: keyRow.role_name,
              allowed_tools: keyRow.role_allowed_tools,
            },
          };

          // Update last_used_at
          query(`UPDATE mcp_api_keys SET last_used_at = NOW() WHERE id = $1`, [keyId]).catch(() => {});
        }
      }
    }

    if (!result) {
      res.status(401).json({
        jsonrpc: "2.0",
        id: req.body?.id || null,
        error: { code: -32001, message: "Invalid or revoked API key" },
      });
      return;
    }

    req.apiKeyId = result.apiKey.id;
    req.apiKeyLabel = result.apiKey.label;
    req.role = result.role;
    req.hasApiKey = true;
    next();
  } catch (err: any) {
    // If database is not configured, allow through
    console.error("[API Key Auth Error]", err.message);
    req.hasApiKey = false;
    next();
  }
}

/**
 * Admin session authentication middleware.
 * Checks the admin_session cookie against the admin_sessions table.
 */
export async function adminAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const sessionId = req.cookies?.admin_session;

  if (!sessionId) {
    res.redirect("/admin/login");
    return;
  }

  try {
    const session = await queryOne<{ id: string; expires_at: string }>(
      `SELECT id, expires_at FROM mcp_admin_sessions WHERE id = $1 AND expires_at > NOW()`,
      [sessionId]
    );

    if (!session) {
      res.clearCookie("admin_session");
      res.redirect("/admin/login");
      return;
    }

    next();
  } catch (err: any) {
    console.error("[Admin Auth Error]", err.message);
    res.redirect("/admin/login");
  }
}

/**
 * Create an admin session and return the session ID.
 */
export async function createAdminSession(): Promise<string> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

  await query(
    `INSERT INTO mcp_admin_sessions (id, expires_at) VALUES ($1, $2)`,
    [sessionId, expiresAt]
  );

  return sessionId;
}

/**
 * Delete an admin session.
 */
export async function deleteAdminSession(sessionId: string): Promise<void> {
  await query(
    `DELETE FROM mcp_admin_sessions WHERE id = $1`,
    [sessionId]
  );
}
