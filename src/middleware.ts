/**
 * Express middleware for API key auth and admin session auth.
 */

import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { validateKey } from "./api-keys.js";
import { getSupabase } from "./db.js";

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
    const result = await validateKey(token);

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
    // If Supabase is not configured, allow through
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
    const db = getSupabase();

    const { data, error } = await db
      .from("mcp_admin_sessions")
      .select("id, expires_at")
      .eq("id", sessionId)
      .single();

    if (error || !data) {
      res.clearCookie("admin_session");
      res.redirect("/admin/login");
      return;
    }

    // Check expiry
    if (new Date(data.expires_at) < new Date()) {
      await db.from("mcp_admin_sessions").delete().eq("id", sessionId);
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
  const db = getSupabase();
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

  const { error } = await db
    .from("mcp_admin_sessions")
    .insert({ id: sessionId, expires_at: expiresAt });

  if (error) throw new Error(`Failed to create session: ${error.message}`);
  return sessionId;
}

/**
 * Delete an admin session.
 */
export async function deleteAdminSession(sessionId: string): Promise<void> {
  const db = getSupabase();
  await db.from("mcp_admin_sessions").delete().eq("id", sessionId);
}
