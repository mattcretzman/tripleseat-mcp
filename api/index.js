"use strict";
/**
 * TripleSeat MCP Server — Vercel Serverless Edition
 *
 * Handles JSON-RPC directly instead of using the SDK transport.
 * Every request is self-contained — no sessions needed.
 * OAuth 2.1 Authorization Code + PKCE for MCP connector auth.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const auth_js_1 = require("./auth.js");
const middleware_js_1 = require("./middleware.js");
const routes_js_1 = require("./admin/routes.js");
const db_js_1 = require("./db.js");
const roles_js_1 = require("./roles.js");
const users_js_1 = require("./users.js");
const users_js_2 = require("./users.js");
const oauth_js_1 = require("./oauth.js");
const mcp_js_1 = require("./mcp.js");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// Run migrations on cold start
let migrated = false;
async function ensureMigrated() {
    if (migrated)
        return;
    migrated = true;
    try {
        await (0, db_js_1.migrate)();
        const { created } = await (0, roles_js_1.seedDefaultRoles)();
        if (created.length > 0)
            console.log("[Init] Seeded roles:", created.join(", "));
        const { query: dbQuery } = await import("./db.js");
        const adminRole = await dbQuery(`SELECT id FROM mcp_roles WHERE name = 'admin' LIMIT 1`);
        if (adminRole.length > 0) {
            const result = await (0, users_js_1.seedAdminUser)(adminRole[0].id);
            if (result.created)
                console.log("[Init] Seeded admin user:", result.email);
        }
    }
    catch (err) {
        console.error("[Init] Migration error:", err.message);
        migrated = false;
    }
}
// CORS
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS, PATCH");
    res.header("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, Mcp-Session-Id, Last-Event-ID");
    res.header("Access-Control-Expose-Headers", "Content-Type, Mcp-Session-Id");
    if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
    }
    next();
});
// Ensure DB is migrated before any route
app.use(async (_req, _res, next) => {
    await ensureMigrated();
    next();
});
// Health check
app.get("/", (_req, res) => {
    try {
        const status = !(0, auth_js_1.hasCredentials)()
            ? "missing_credentials"
            : !(0, auth_js_1.hasRefreshToken)()
                ? "needs_oauth_setup"
                : "ready";
        res.json({
            name: "tripleseat-mcp",
            version: "3.0.0",
            status,
            transport: "streamable-http",
            endpoint: "/mcp",
            admin: "/admin/login",
            auth: "oauth2-authorization-code",
            setup: status === "needs_oauth_setup" ? "/auth/login" : undefined,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});
// ── OAuth 2.1 Endpoints (MCP protocol auth) ──
app.get("/.well-known/oauth-authorization-server", (req, res) => {
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host || "tripleseat-mcp.vercel.app";
    const issuer = protocol + "://" + host;
    res.json((0, oauth_js_1.getMetadata)(issuer));
});
app.post("/oauth/register", async (req, res) => {
    try {
        const { client_name, redirect_uris } = req.body;
        const client = await (0, oauth_js_1.registerClient)(client_name, redirect_uris);
        res.status(201).json({
            client_id: client.client_id,
            client_name: client.client_name,
            redirect_uris: client.redirect_uris,
            token_endpoint_auth_method: "none",
        });
    }
    catch (err) {
        console.error("[OAuth Register Error]", err.message);
        res.status(500).json({ error: "server_error", error_description: err.message });
    }
});
app.get("/oauth/authorize", (req, res) => {
    const { client_id, redirect_uri, code_challenge, code_challenge_method, state, response_type, } = req.query;
    if (response_type !== "code") {
        res.status(400).json({ error: "unsupported_response_type" });
        return;
    }
    if (!client_id || !redirect_uri || !code_challenge || !state) {
        res.status(400).json({
            error: "invalid_request",
            error_description: "client_id, redirect_uri, code_challenge, and state are required",
        });
        return;
    }
    res.type("html").send((0, oauth_js_1.renderLoginPage)({
        clientId: client_id,
        redirectUri: redirect_uri,
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method || "S256",
        state,
    }));
});
app.post("/oauth/authorize", async (req, res) => {
    const { client_id, redirect_uri, code_challenge, code_challenge_method, state, email, password } = req.body;
    if (!client_id || !redirect_uri || !code_challenge || !state || !email || !password) {
        res.type("html").send((0, oauth_js_1.renderLoginPage)({
            clientId: client_id || "",
            redirectUri: redirect_uri || "",
            codeChallenge: code_challenge || "",
            codeChallengeMethod: code_challenge_method || "S256",
            state: state || "",
            error: "All fields are required.",
        }));
        return;
    }
    try {
        const user = await (0, users_js_2.authenticateUser)(email, password);
        if (!user) {
            res.type("html").send((0, oauth_js_1.renderLoginPage)({
                clientId: client_id,
                redirectUri: redirect_uri,
                codeChallenge: code_challenge,
                codeChallengeMethod: code_challenge_method || "S256",
                state,
                error: "Invalid email or password.",
            }));
            return;
        }
        const code = await (0, oauth_js_1.createAuthCode)(user.id, client_id, redirect_uri, code_challenge, code_challenge_method || "S256");
        const redirectUrl = new URL(redirect_uri);
        redirectUrl.searchParams.set("code", code);
        redirectUrl.searchParams.set("state", state);
        res.redirect(redirectUrl.toString());
    }
    catch (err) {
        console.error("[OAuth Authorize Error]", err.message);
        res.type("html").send((0, oauth_js_1.renderLoginPage)({
            clientId: client_id,
            redirectUri: redirect_uri,
            codeChallenge: code_challenge,
            codeChallengeMethod: code_challenge_method || "S256",
            state,
            error: "An error occurred. Please try again.",
        }));
    }
});
app.post("/oauth/token", async (req, res) => {
    try {
        const { grant_type } = req.body;
        if (grant_type === "authorization_code") {
            const { code, code_verifier, redirect_uri } = req.body;
            if (!code || !code_verifier || !redirect_uri) {
                res.status(400).json({
                    error: "invalid_request",
                    error_description: "code, code_verifier, and redirect_uri are required",
                });
                return;
            }
            const tokens = await (0, oauth_js_1.exchangeCode)(code, code_verifier, redirect_uri);
            res.json(tokens);
        }
        else if (grant_type === "refresh_token") {
            const { refresh_token } = req.body;
            if (!refresh_token) {
                res.status(400).json({
                    error: "invalid_request",
                    error_description: "refresh_token is required",
                });
                return;
            }
            const tokens = await (0, oauth_js_1.refreshAccessToken)(refresh_token);
            res.json(tokens);
        }
        else {
            res.status(400).json({
                error: "unsupported_grant_type",
                error_description: "Supported: authorization_code, refresh_token",
            });
        }
    }
    catch (err) {
        if (err instanceof oauth_js_1.OAuthError) {
            res.status(400).json({ error: err.code, error_description: err.message });
        }
        else {
            console.error("[OAuth Token Error]", err.message);
            res.status(500).json({ error: "server_error", error_description: err.message });
        }
    }
});
// ── Admin Dashboard ──
app.use("/admin", routes_js_1.adminRouter);
// ── Account: Change Password ──
function changePasswordPage(opts = {}) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TripleSeat MCP - Change Password</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #0a0a0a; --surface: #141414; --border: #262626;
      --text: #ededed; --text-secondary: #888888;
      --accent: #0070f3; --accent-hover: #0060d3;
      --success: #00c853; --success-subtle: rgba(0, 200, 83, 0.1);
      --danger: #ff4444; --danger-subtle: rgba(255, 68, 68, 0.1);
      --radius-sm: 6px;
      --font: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    }
    body {
      background: var(--bg); color: var(--text); font-family: var(--font);
      font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased;
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
    .success-msg {
      background: var(--success-subtle); color: var(--success);
      padding: 10px 12px; border-radius: var(--radius-sm);
      font-size: 13px; margin-bottom: 16px;
      border: 1px solid rgba(0, 200, 83, 0.2);
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
      <h1>Change Password</h1>
      <p class="subtitle">Update your TripleSeat MCP password</p>
      ${opts.error ? `<div class="error-msg">${esc(opts.error)}</div>` : ""}
      ${opts.success ? `<div class="success-msg">${esc(opts.success)}</div>` : ""}
      <form method="POST" action="/account/change-password">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" placeholder="you@example.com" autofocus required>
        <label for="current_password">Current Password</label>
        <input type="password" id="current_password" name="current_password" placeholder="Enter current password" required>
        <label for="new_password">New Password</label>
        <input type="password" id="new_password" name="new_password" placeholder="Enter new password" required>
        <label for="confirm_password">Confirm New Password</label>
        <input type="password" id="confirm_password" name="confirm_password" placeholder="Confirm new password" required>
        <button type="submit" class="btn">Change Password</button>
      </form>
      <p class="footer">TripleSeat MCP &middot; Stormbreaker Digital</p>
    </div>
  </div>
</body>
</html>`;
}
function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
app.get("/account/change-password", (_req, res) => {
    res.type("html").send(changePasswordPage());
});
app.post("/account/change-password", async (req, res) => {
    const { email, current_password, new_password, confirm_password } = req.body;
    if (!email || !current_password || !new_password || !confirm_password) {
        res.type("html").send(changePasswordPage({ error: "All fields are required." }));
        return;
    }
    if (new_password.length < 8) {
        res.type("html").send(changePasswordPage({ error: "New password must be at least 8 characters." }));
        return;
    }
    if (new_password !== confirm_password) {
        res.type("html").send(changePasswordPage({ error: "New passwords do not match." }));
        return;
    }
    if (current_password === new_password) {
        res.type("html").send(changePasswordPage({ error: "New password must be different from your current password." }));
        return;
    }
    try {
        const result = await (0, users_js_1.changePassword)(email, current_password, new_password);
        if (!result.success) {
            res.type("html").send(changePasswordPage({ error: result.error || "Password change failed." }));
            return;
        }
        res.type("html").send(changePasswordPage({ success: "Password changed successfully. You can close this page." }));
    }
    catch (err) {
        res.type("html").send(changePasswordPage({ error: "An error occurred. Please try again." }));
    }
});
// ── TripleSeat OAuth Setup Routes (one-time) ──
app.get("/auth/login", (req, res) => {
    const host = req.headers.host || "tripleseat-mcp.vercel.app";
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const redirectUri = protocol + "://" + host + "/auth/callback";
    const authorizeUrl = (0, auth_js_1.getAuthorizeUrl)(redirectUri);
    res.redirect(authorizeUrl);
});
app.get("/auth/callback", async (req, res) => {
    const code = req.query.code;
    const error = req.query.error;
    if (error) {
        res.status(400).send("<h1>Authorization Failed</h1><p>Error: " + error + "</p>" +
            "<p>" + (req.query.error_description || "") + "</p>");
        return;
    }
    if (!code) {
        res.status(400).send("<h1>Missing authorization code</h1>");
        return;
    }
    try {
        const host = req.headers.host || "tripleseat-mcp.vercel.app";
        const protocol = req.headers["x-forwarded-proto"] || "https";
        const redirectUri = protocol + "://" + host + "/auth/callback";
        const tokens = await (0, auth_js_1.exchangeCodeForTokens)(code, redirectUri);
        try {
            await (0, auth_js_1.storeTokens)(tokens);
            console.log("[Auth Callback] Tokens stored in database successfully");
        }
        catch (storeErr) {
            console.error("[Auth Callback] Failed to store tokens in DB:", storeErr.message);
        }
        res.send(`<!DOCTYPE html>
<html><head><title>TripleSeat MCP - OAuth Setup Complete</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; background: #0a0a0a; color: #ededed; }
  .success { color: #00c853; }
  .token-box { background: #141414; border: 1px solid #262626; padding: 16px; border-radius: 8px; word-break: break-all; font-family: monospace; font-size: 14px; margin: 12px 0; }
  .step { margin: 20px 0; padding: 16px; background: #141414; border-left: 4px solid #0070f3; border-radius: 4px; }
  code { background: #262626; padding: 2px 6px; border-radius: 4px; }
  a { color: #0070f3; }
</style></head>
<body>
  <h1 class="success">OAuth Setup Complete!</h1>
  <p>TripleSeat authorized the Stormbreaker app.</p>
  <h3>Refresh Token:</h3>
  <div class="token-box">${tokens.refresh_token || "NOT PROVIDED"}</div>
  <div class="step">
    <p><strong>1.</strong> Go to <a href="https://vercel.com/mcretzman-9359s-projects/tripleseat-mcp/settings/environment-variables" target="_blank">Vercel Environment Variables</a></p>
    <p><strong>2.</strong> Set <code>TRIPLESEAT_REFRESH_TOKEN</code> to the refresh token above</p>
    <p><strong>3.</strong> Redeploy the project</p>
  </div>
</body></html>`);
    }
    catch (err) {
        res.status(500).send("<h1>Token Exchange Failed</h1><pre>" + err.message + "</pre>");
    }
});
// ── MCP Endpoint ──
app.post("/mcp", middleware_js_1.oauthTokenAuth, async (req, res) => {
    try {
        const body = req.body;
        if (Array.isArray(body)) {
            const results = await Promise.all(body.map((msg) => (0, mcp_js_1.handleMessage)(msg, req)));
            const responses = results.filter((r) => r !== null);
            if (responses.length === 0) {
                res.status(202).end();
            }
            else {
                res.json(responses);
            }
            return;
        }
        const result = await (0, mcp_js_1.handleMessage)(body, req);
        if (result === null) {
            res.status(202).end();
        }
        else {
            res.json(result);
        }
    }
    catch (error) {
        console.error("[MCP Error]", error);
        res.status(500).json((0, mcp_js_1.jsonrpcError)(null, -32603, "Internal server error"));
    }
});
app.get("/mcp", (_req, res) => {
    res.status(405).json((0, mcp_js_1.jsonrpcError)(null, -32000, "Use POST for MCP requests"));
});
app.delete("/mcp", (_req, res) => {
    res.status(200).json({ ok: true });
});
// ── Start ──
const PORT = process.env.PORT || 3000;
if (process.env.VERCEL !== "1") {
    app.listen(PORT, () => {
        console.log(`\nTripleSeat MCP Server running on http://localhost:${PORT}`);
        console.log(`  MCP endpoint: http://localhost:${PORT}/mcp`);
        console.log(`  Admin panel:  http://localhost:${PORT}/admin/login`);
        console.log(`  OAuth:        http://localhost:${PORT}/.well-known/oauth-authorization-server`);
        console.log(`  Credentials:  ${(0, auth_js_1.hasCredentials)() ? "configured" : "missing"}`);
        console.log();
    });
}
exports.default = app;
