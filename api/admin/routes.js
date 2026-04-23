"use strict";
/**
 * Admin dashboard Express routes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const middleware_js_1 = require("../middleware.js");
const users_js_1 = require("../users.js");
const roles_js_1 = require("../roles.js");
const email_js_1 = require("../email.js");
const usage_js_1 = require("../usage.js");
const views_js_1 = require("./views.js");
const router = (0, express_1.Router)();
exports.adminRouter = router;
// ── Public Routes ──
router.get("/login", (_req, res) => {
    res.type("html").send((0, views_js_1.loginPage)());
});
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.type("html").send((0, views_js_1.loginPage)("Email and password are required."));
        return;
    }
    try {
        const user = await (0, users_js_1.authenticateUser)(email, password);
        if (!user) {
            res.type("html").send((0, views_js_1.loginPage)("Invalid email or password."));
            return;
        }
        if (!user.is_admin) {
            res.type("html").send((0, views_js_1.loginPage)("Admin access required."));
            return;
        }
        const sessionId = await (0, middleware_js_1.createAdminSession)(user.id);
        res.cookie("admin_session", sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
            sameSite: "lax",
            maxAge: 24 * 60 * 60 * 1000,
            path: "/",
        });
        res.redirect("/admin/dashboard");
    }
    catch (err) {
        res.type("html").send((0, views_js_1.loginPage)("Login failed: " + err.message));
    }
});
router.post("/logout", async (req, res) => {
    const sessionId = req.cookies?.admin_session;
    if (sessionId) {
        try {
            await (0, middleware_js_1.deleteAdminSession)(sessionId);
        }
        catch (_) { }
    }
    res.clearCookie("admin_session", { path: "/" });
    res.redirect("/admin/login");
});
// ── Protected Routes (admin auth required) ──
router.use(middleware_js_1.adminAuth);
// Dashboard
router.get("/dashboard", async (_req, res) => {
    try {
        const [users, roles, stats] = await Promise.all([
            (0, users_js_1.listUsers)(),
            (0, roles_js_1.listRoles)(),
            (0, usage_js_1.getUsageStats)(),
        ]);
        res.type("html").send((0, views_js_1.dashboardPage)({ users, roles, stats }));
    }
    catch (err) {
        res.status(500).send("Dashboard error: " + err.message);
    }
});
// ── API: Users ──
router.get("/api/users", async (_req, res) => {
    try {
        const users = await (0, users_js_1.listUsers)();
        res.json(users);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post("/api/users", async (req, res) => {
    try {
        const { email, name, password, role_id, is_admin, send_invite } = req.body;
        if (!email || !name || !password || !role_id) {
            res.status(400).json({ error: "email, name, password, and role_id are required" });
            return;
        }
        const user = await (0, users_js_1.createUser)(email, name, password, role_id, is_admin || false);
        let invite_sent = false;
        let invite_error;
        if (send_invite) {
            const role = await (0, roles_js_1.getRole)(role_id);
            const result = await (0, email_js_1.sendInviteEmail)({
                to: email,
                name,
                password,
                roleName: role?.name || "user",
                invitedBy: "Admin",
            });
            invite_sent = result.success;
            invite_error = result.error;
        }
        res.json({
            id: user.id, email: user.email, name: user.name,
            role_id: user.role_id, is_admin: user.is_admin,
            invite_sent, invite_error,
        });
    }
    catch (err) {
        if (err.message?.includes("duplicate key") || err.message?.includes("unique")) {
            res.status(409).json({ error: "A user with that email already exists" });
        }
        else {
            res.status(500).json({ error: err.message });
        }
    }
});
router.post("/api/users/:id/send-invite", async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;
        if (!password) {
            res.status(400).json({ error: "password is required to include in the invite" });
            return;
        }
        const users = await (0, users_js_1.listUsers)();
        const user = users.find((u) => u.id === id);
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        const role = await (0, roles_js_1.getRole)(user.role_id);
        const result = await (0, email_js_1.sendInviteEmail)({
            to: user.email,
            name: user.name,
            password,
            roleName: role?.name || "user",
            invitedBy: "Admin",
        });
        if (result.success) {
            res.json({ ok: true });
        }
        else {
            res.status(500).json({ error: result.error });
        }
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.patch("/api/users/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const updates = {};
        if (req.body.name !== undefined)
            updates.name = req.body.name;
        if (req.body.email !== undefined)
            updates.email = req.body.email;
        if (req.body.role_id !== undefined)
            updates.role_id = req.body.role_id;
        if (req.body.is_admin !== undefined)
            updates.is_admin = req.body.is_admin;
        if (req.body.is_active !== undefined)
            updates.is_active = req.body.is_active;
        const user = await (0, users_js_1.updateUser)(id, updates);
        res.json(user);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post("/api/users/:id/reset-password", async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;
        if (!password) {
            res.status(400).json({ error: "password is required" });
            return;
        }
        await (0, users_js_1.resetPassword)(id, password);
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post("/api/users/:id/deactivate", async (req, res) => {
    try {
        const { id } = req.params;
        await (0, users_js_1.deactivateUser)(id);
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
        if (req.query.user_id)
            filters.user_id = req.query.user_id;
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
