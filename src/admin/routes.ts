/**
 * Admin dashboard Express routes.
 */

import { Router, Request, Response } from "express";
import { adminAuth, createAdminSession, deleteAdminSession } from "../middleware.js";
import { authenticateUser, createUser, listUsers, updateUser, deactivateUser, resetPassword } from "../users.js";
import { listRoles, createRole, updateRole, seedDefaultRoles } from "../roles.js";
import { getRecentUsage, getUsageStats } from "../usage.js";
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
    const [users, roles, stats] = await Promise.all([
      listUsers(),
      listRoles(),
      getUsageStats(),
    ]);

    res.type("html").send(
      dashboardPage({ users, roles, stats })
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
    const { email, name, password, role_id, is_admin } = req.body;
    if (!email || !name || !password || !role_id) {
      res.status(400).json({ error: "email, name, password, and role_id are required" });
      return;
    }
    const user = await createUser(email, name, password, role_id, is_admin || false);
    res.json({ id: user.id, email: user.email, name: user.name, role_id: user.role_id, is_admin: user.is_admin });
  } catch (err: any) {
    if (err.message?.includes("duplicate key") || err.message?.includes("unique")) {
      res.status(409).json({ error: "A user with that email already exists" });
    } else {
      res.status(500).json({ error: err.message });
    }
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

export { router as adminRouter };
