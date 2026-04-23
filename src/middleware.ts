/**
 * Express middleware for OAuth token auth and admin session auth.
 */

import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { validateToken } from "./oauth.js";
import { getUser, touchLastActive } from "./users.js";
import { query, queryOne } from "./db.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: {
          id: string;
          name: string;
          allowed_tools: string[];
        };
      };
    }
  }
}

/**
 * OAuth token authentication middleware for the /mcp endpoint.
 * Validates Bearer token and attaches user + role info to the request.
 */
export async function oauthTokenAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      jsonrpc: "2.0",
      id: req.body?.id || null,
      error: { code: -32001, message: "Authentication required. Bearer token missing." },
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const tokenInfo = await validateToken(token);

    if (!tokenInfo) {
      res.status(401).json({
        jsonrpc: "2.0",
        id: req.body?.id || null,
        error: { code: -32001, message: "Invalid or expired access token" },
      });
      return;
    }

    const user = await getUser(tokenInfo.userId);

    if (!user || !user.is_active) {
      res.status(401).json({
        jsonrpc: "2.0",
        id: req.body?.id || null,
        error: { code: -32001, message: "User account is deactivated" },
      });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: {
        id: user.role.id,
        name: user.role.name,
        allowed_tools: user.role.allowed_tools,
      },
    };

    touchLastActive(user.id);
    next();
  } catch (err: any) {
    console.error("[OAuth Auth Error]", err.message);
    res.status(500).json({
      jsonrpc: "2.0",
      id: req.body?.id || null,
      error: { code: -32603, message: "Authentication error" },
    });
  }
}

/**
 * Admin session authentication middleware.
 * Checks the admin_session cookie against the mcp_admin_sessions table.
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
    const session = await queryOne<{ id: string; user_id: string; expires_at: string }>(
      `SELECT id, user_id, expires_at FROM mcp_admin_sessions WHERE id = $1 AND expires_at > NOW()`,
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
 * Create an admin session tied to a user and return the session ID.
 */
export async function createAdminSession(userId: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await query(
    `INSERT INTO mcp_admin_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
    [sessionId, userId, expiresAt]
  );

  return sessionId;
}

/**
 * Delete an admin session.
 */
export async function deleteAdminSession(sessionId: string): Promise<void> {
  await query(`DELETE FROM mcp_admin_sessions WHERE id = $1`, [sessionId]);
}
