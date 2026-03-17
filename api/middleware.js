"use strict";
/**
 * Express middleware for API key auth and admin session auth.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeyAuth = apiKeyAuth;
exports.adminAuth = adminAuth;
exports.createAdminSession = createAdminSession;
exports.deleteAdminSession = deleteAdminSession;
const node_crypto_1 = __importDefault(require("node:crypto"));
const api_keys_js_1 = require("./api-keys.js");
const db_js_1 = require("./db.js");
/**
 * API key authentication middleware for the /mcp endpoint.
 *
 * If a Bearer token is provided, validates it and attaches role info.
 * If no token is provided, allows the request through for backward
 * compatibility but sets hasApiKey = false so tools aren't filtered.
 */
async function apiKeyAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        // No API key — allow through for backward compatibility
        req.hasApiKey = false;
        next();
        return;
    }
    const token = authHeader.substring(7);
    try {
        const result = await (0, api_keys_js_1.validateKey)(token);
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
    }
    catch (err) {
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
async function adminAuth(req, res, next) {
    const sessionId = req.cookies?.admin_session;
    if (!sessionId) {
        res.redirect("/admin/login");
        return;
    }
    try {
        const db = (0, db_js_1.getSupabase)();
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
    }
    catch (err) {
        console.error("[Admin Auth Error]", err.message);
        res.redirect("/admin/login");
    }
}
/**
 * Create an admin session and return the session ID.
 */
async function createAdminSession() {
    const db = (0, db_js_1.getSupabase)();
    const sessionId = node_crypto_1.default.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
    const { error } = await db
        .from("mcp_admin_sessions")
        .insert({ id: sessionId, expires_at: expiresAt });
    if (error)
        throw new Error(`Failed to create session: ${error.message}`);
    return sessionId;
}
/**
 * Delete an admin session.
 */
async function deleteAdminSession(sessionId) {
    const db = (0, db_js_1.getSupabase)();
    await db.from("mcp_admin_sessions").delete().eq("id", sessionId);
}
