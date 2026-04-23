"use strict";
/**
 * Express middleware for OAuth token auth and admin session auth.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.oauthTokenAuth = oauthTokenAuth;
exports.adminAuth = adminAuth;
exports.createAdminSession = createAdminSession;
exports.deleteAdminSession = deleteAdminSession;
const node_crypto_1 = __importDefault(require("node:crypto"));
const oauth_js_1 = require("./oauth.js");
const users_js_1 = require("./users.js");
const db_js_1 = require("./db.js");
/**
 * OAuth token authentication middleware for the /mcp endpoint.
 * Validates Bearer token and attaches user + role info to the request.
 */
async function oauthTokenAuth(req, res, next) {
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
        const tokenInfo = await (0, oauth_js_1.validateToken)(token);
        if (!tokenInfo) {
            res.status(401).json({
                jsonrpc: "2.0",
                id: req.body?.id || null,
                error: { code: -32001, message: "Invalid or expired access token" },
            });
            return;
        }
        const user = await (0, users_js_1.getUser)(tokenInfo.userId);
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
        (0, users_js_1.touchLastActive)(user.id);
        next();
    }
    catch (err) {
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
async function adminAuth(req, res, next) {
    const sessionId = req.cookies?.admin_session;
    if (!sessionId) {
        res.redirect("/admin/login");
        return;
    }
    try {
        const session = await (0, db_js_1.queryOne)(`SELECT id, user_id, expires_at FROM mcp_admin_sessions WHERE id = $1 AND expires_at > NOW()`, [sessionId]);
        if (!session) {
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
 * Create an admin session tied to a user and return the session ID.
 */
async function createAdminSession(userId) {
    const sessionId = node_crypto_1.default.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await (0, db_js_1.query)(`INSERT INTO mcp_admin_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`, [sessionId, userId, expiresAt]);
    return sessionId;
}
/**
 * Delete an admin session.
 */
async function deleteAdminSession(sessionId) {
    await (0, db_js_1.query)(`DELETE FROM mcp_admin_sessions WHERE id = $1`, [sessionId]);
}
