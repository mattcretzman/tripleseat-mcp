/**
 * Admin dashboard Express routes.
 */

import { Router, Request, Response } from "express";
import { adminAuth, createAdminSession, deleteAdminSession } from "../middleware.js";
import { authenticateUser, createUser, listUsers, updateUser, deactivateUser, resetPassword } from "../users.js";
import { listRoles, createRole, updateRole, seedDefaultRoles, getRole } from "../roles.js";
import { sendInviteEmail } from "../email.js";
import { getRecentUsage, getUsageStats } from "../usage.js";
import { query, queryOne } from "../db.js";
import { hasCredentials, hasRefreshToken } from "../auth.js";
import { loginPage, dashboardPage } from "./views.js";

const router = Router();

// ── Public Routes ──

router.get("/login", (_req: Request, res: Response) => {
  res.type("html").send(loginPage());
});

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.type("html").send(loginPage("Email and password are required."));
    return;
  }

  try {
    const user = await authenticateUser(email, password);

    if (!user) {
      res.type("html").send(loginPage("Invalid email or password."));
      return;
    }

    if (!user.is_admin) {
      res.type("html").send(loginPage("Admin access required."));
      return;
    }

    const sessionId = await createAdminSession(user.id);
    res.cookie("admin_session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });
    res.redirect("/admin/dashboard");
  } catch (err: any) {
    res.type("html").send(loginPage("Login failed: " + err.message));
  }
});

router.post("/logout", async (req: Request, res: Response) => {
  const sessionId = req.cookies?.admin_session;
  if (sessionId) {
    try {
      await deleteAdminSession(sessionId);
    } catch (_) {}
  }
  res.clearCookie("admin_session", { path: "/" });
  res.redirect("/admin/login");
});

// ── Protected Routes (admin auth required) ──

router.use(adminAuth);

// Dashboard
router.get("/dashboard", async (_req: Request, res: Response) => {
  try {
    const [users, roles, stats, tokenRow, clientCount, sessionCount] = await Promise.all([
      listUsers(),
      listRoles(),
      getUsageStats(),
      queryOne<{ expires_at: string; updated_at: string }>(
        `SELECT expires_at, updated_at FROM tripleseat_tokens WHERE id = 'primary'`
      ),
      queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM mcp_oauth_clients`),
      queryOne<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM mcp_oauth_tokens WHERE expires_at > NOW()`
      ),
    ]);

    const tripleseatStatus = !hasCredentials()
      ? "missing_credentials"
      : !hasRefreshToken() && !tokenRow
        ? "needs_oauth_setup"
        : "ready";

    const health = {
      tripleseat_status: tripleseatStatus,
      tripleseat_token_expires_at: tokenRow?.expires_at || null,
      tripleseat_token_updated_at: tokenRow?.updated_at || null,
      oauth_client_count: parseInt(clientCount?.count || "0", 10),
      active_session_count: parseInt(sessionCount?.count || "0", 10),
    };

    res.type("html").send(
      dashboardPage({ users, roles, stats, health })
    );
  } catch (err: any) {
    res.status(500).send("Dashboard error: " + err.message);
  }
});

// ── API: Users ──

router.get("/api/users", async (_req: Request, res: Response) => {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/users", async (req: Request, res: Response) => {
  try {
    const { email, name, password, role_id, is_admin, send_invite } = req.body;
    if (!email || !name || !password || !role_id) {
      res.status(400).json({ error: "email, name, password, and role_id are required" });
      return;
    }
    const user = await createUser(email, name, password, role_id, is_admin || false);

    let invite_sent = false;
    let invite_error: string | undefined;

    if (send_invite) {
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host || "tripleseat-mcp.vercel.app";
      const mcpUrl = `${protocol}://${host}/mcp`;

      const role = await getRole(role_id);
      const result = await sendInviteEmail({
        to: email,
        name,
        password,
        roleName: role?.name || "user",
        invitedBy: "Admin",
        mcpUrl,
      });
      invite_sent = result.success;
      invite_error = result.error;
    }

    res.json({
      id: user.id, email: user.email, name: user.name,
      role_id: user.role_id, is_admin: user.is_admin,
      invite_sent, invite_error,
    });
  } catch (err: any) {
    if (err.message?.includes("duplicate key") || err.message?.includes("unique")) {
      res.status(409).json({ error: "A user with that email already exists" });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

router.post("/api/users/:id/send-invite", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password) {
      res.status(400).json({ error: "password is required to include in the invite" });
      return;
    }

    const users = await listUsers();
    const user = users.find((u: any) => u.id === id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host || "tripleseat-mcp.vercel.app";
    const mcpUrl = `${protocol}://${host}/mcp`;

    const role = await getRole(user.role_id);
    const result = await sendInviteEmail({
      to: user.email,
      name: user.name,
      password,
      roleName: role?.name || "user",
      invitedBy: "Admin",
      mcpUrl,
    });

    if (result.success) {
      res.json({ ok: true });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/api/users/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates: any = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.email !== undefined) updates.email = req.body.email;
    if (req.body.role_id !== undefined) updates.role_id = req.body.role_id;
    if (req.body.is_admin !== undefined) updates.is_admin = req.body.is_admin;
    if (req.body.is_active !== undefined) updates.is_active = req.body.is_active;

    const user = await updateUser(id as string, updates);
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/users/:id/reset-password", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password) {
      res.status(400).json({ error: "password is required" });
      return;
    }
    await resetPassword(id as string, password);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/users/:id/deactivate", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await deactivateUser(id as string);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: Roles ──

router.get("/api/roles", async (_req: Request, res: Response) => {
  try {
    const roles = await listRoles();
    res.json(roles);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/roles", async (req: Request, res: Response) => {
  try {
    const { name, description, allowed_tools } = req.body;
    if (!name || !allowed_tools || !Array.isArray(allowed_tools)) {
      res.status(400).json({ error: "name and allowed_tools[] are required" });
      return;
    }
    const role = await createRole(name, description || "", allowed_tools);
    res.json(role);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/api/roles/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates: any = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.allowed_tools !== undefined) updates.allowed_tools = req.body.allowed_tools;

    const role = await updateRole(id as string, updates);
    res.json(role);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: Usage ──

router.get("/api/usage", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const filters: any = {};
    if (req.query.days) filters.days = parseInt(req.query.days as string);
    if (req.query.user_id) filters.user_id = req.query.user_id;
    if (req.query.tool_name) filters.tool_name = req.query.tool_name;

    const usage = await getRecentUsage(limit, filters);
    res.json(usage);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/usage/stats", async (_req: Request, res: Response) => {
  try {
    const stats = await getUsageStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: Seed ──

router.post("/api/seed", async (_req: Request, res: Response) => {
  try {
    const result = await seedDefaultRoles();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: Health ──

router.get("/api/health", async (_req: Request, res: Response) => {
  try {
    const [tokenRow, clientCount, sessionCount] = await Promise.all([
      queryOne<{ expires_at: string; updated_at: string }>(
        `SELECT expires_at, updated_at FROM tripleseat_tokens WHERE id = 'primary'`
      ),
      queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM mcp_oauth_clients`),
      queryOne<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM mcp_oauth_tokens WHERE expires_at > NOW()`
      ),
    ]);

    const tripleseatStatus = !hasCredentials()
      ? "missing_credentials"
      : !hasRefreshToken() && !tokenRow
        ? "needs_oauth_setup"
        : "ready";

    res.json({
      tripleseat_status: tripleseatStatus,
      tripleseat_token_expires_at: tokenRow?.expires_at || null,
      tripleseat_token_updated_at: tokenRow?.updated_at || null,
      oauth_client_count: parseInt(clientCount?.count || "0", 10),
      active_session_count: parseInt(sessionCount?.count || "0", 10),
      database: true,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, database: false });
  }
});

// ── API: OAuth Clients ──

router.get("/api/oauth-clients", async (_req: Request, res: Response) => {
  try {
    const clients = await query(
      `SELECT c.client_id, c.client_name, c.redirect_uris, c.created_at,
              COUNT(t.token_hash) FILTER (WHERE t.expires_at > NOW()) AS active_tokens,
              MAX(t.created_at) AS last_token_issued
       FROM mcp_oauth_clients c
       LEFT JOIN mcp_oauth_tokens t ON t.client_id = c.client_id
       GROUP BY c.client_id, c.client_name, c.redirect_uris, c.created_at
       ORDER BY c.created_at DESC`
    );
    res.json(clients);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as adminRouter };
