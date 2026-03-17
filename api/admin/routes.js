"use strict";
/**
 * Admin dashboard Express routes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const middleware_js_1 = require("../middleware.js");
const api_keys_js_1 = require("../api-keys.js");
const roles_js_1 = require("../roles.js");
const usage_js_1 = require("../usage.js");
const views_js_1 = require("./views.js");
const router = (0, express_1.Router)();
exports.adminRouter = router;
// ── Public Routes ──
router.get("/login", (_req, res) => {
    res.type("html").send((0, views_js_1.loginPage)());
});
router.post("/login", async (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
        res.type("html").send((0, views_js_1.loginPage)("ADMIN_PASSWORD environment variable not set."));
        return;
    }
    if (password !== adminPassword) {
        res.type("html").send((0, views_js_1.loginPage)("Invalid password."));
        return;
    }
    try {
        const sessionId = await (0, middleware_js_1.createAdminSession)();
        res.cookie("admin_session", sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
            sameSite: "lax",
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            path: "/",
        });
        res.redirect("/admin/dashboard");
    }
    catch (err) {
        res.type("html").send((0, views_js_1.loginPage)("Session creation failed: " + err.message));
    }
});
router.post("/logout", async (req, res) => {
    const sessionId = req.cookies?.admin_session;
    if (sessionId) {
        try {
            await (0, middleware_js_1.deleteAdminSession)(sessionId);
        }
        catch (_) {
            // Ignore cleanup errors
        }
    }
    res.clearCookie("admin_session", { path: "/" });
    res.redirect("/admin/login");
});
// ── Protected Routes (admin auth required) ──
router.use(middleware_js_1.adminAuth);
// Dashboard
router.get("/dashboard", async (_req, res) => {
    try {
        const [keys, roles, stats] = await Promise.all([
            (0, api_keys_js_1.listKeys)(),
            (0, roles_js_1.listRoles)(),
            (0, usage_js_1.getUsageStats)(),
        ]);
        res.type("html").send((0, views_js_1.dashboardPage)({ keys, roles, stats }));
    }
    catch (err) {
        res.status(500).send("Dashboard error: " + err.message);
    }
});
// ── API: Keys ──
router.get("/api/keys", async (_req, res) => {
    try {
        const keys = await (0, api_keys_js_1.listKeys)();
        res.json(keys);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post("/api/keys", async (req, res) => {
    try {
        const { label, role_id } = req.body;
        if (!label || !role_id) {
            res.status(400).json({ error: "label and role_id are required" });
            return;
        }
        const result = await (0, api_keys_js_1.createApiKey)(label, role_id, "admin");
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.patch("/api/keys/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active, role_id } = req.body;
        if (is_active === false) {
            await (0, api_keys_js_1.revokeKey)(id);
        }
        if (role_id) {
            await (0, api_keys_js_1.updateKeyRole)(id, role_id);
        }
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ── API: Roles ──
router.get("/api/roles", async (_req, res) => {
    try {
        const roles = await (0, roles_js_1.listRoles)();
        res.json(roles);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post("/api/roles", async (req, res) => {
    try {
        const { name, description, allowed_tools } = req.body;
        if (!name || !allowed_tools || !Array.isArray(allowed_tools)) {
            res.status(400).json({ error: "name and allowed_tools[] are required" });
            return;
        }
        const role = await (0, roles_js_1.createRole)(name, description || "", allowed_tools);
        res.json(role);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.patch("/api/roles/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const updates = {};
        if (req.body.name !== undefined)
            updates.name = req.body.name;
        if (req.body.description !== undefined)
            updates.description = req.body.description;
        if (req.body.allowed_tools !== undefined)
            updates.allowed_tools = req.body.allowed_tools;
        const role = await (0, roles_js_1.updateRole)(id, updates);
        res.json(role);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ── API: Usage ──
router.get("/api/usage", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const filters = {};
        if (req.query.days)
            filters.days = parseInt(req.query.days);
        if (req.query.key_id)
            filters.key_id = req.query.key_id;
        if (req.query.tool_name)
            filters.tool_name = req.query.tool_name;
        const usage = await (0, usage_js_1.getRecentUsage)(limit, filters);
        res.json(usage);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get("/api/usage/stats", async (_req, res) => {
    try {
        const stats = await (0, usage_js_1.getUsageStats)();
        res.json(stats);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ── API: Seed ──
router.post("/api/seed", async (_req, res) => {
    try {
        const result = await (0, roles_js_1.seedDefaultRoles)();
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
