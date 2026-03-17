/**
 * Admin dashboard Express routes.
 */

import { Router, Request, Response } from "express";
import { adminAuth, createAdminSession, deleteAdminSession } from "../middleware.js";
import { createApiKey, listKeys, revokeKey, updateKeyRole } from "../api-keys.js";
import { listRoles, createRole, updateRole, seedDefaultRoles } from "../roles.js";
import { getRecentUsage, getUsageStats } from "../usage.js";
import { loginPage, dashboardPage } from "./views.js";

const router = Router();

// ── Public Routes ──

router.get("/login", (_req: Request, res: Response) => {
  res.type("html").send(loginPage());
});

router.post("/login", async (req: Request, res: Response) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    res.type("html").send(loginPage("ADMIN_PASSWORD environment variable not set."));
    return;
  }

  if (password !== adminPassword) {
    res.type("html").send(loginPage("Invalid password."));
    return;
  }

  try {
    const sessionId = await createAdminSession();
    res.cookie("admin_session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: "/",
    });
    res.redirect("/admin/dashboard");
  } catch (err: any) {
    res.type("html").send(loginPage("Session creation failed: " + err.message));
  }
});

router.post("/logout", async (req: Request, res: Response) => {
  const sessionId = req.cookies?.admin_session;
  if (sessionId) {
    try {
      await deleteAdminSession(sessionId);
    } catch (_) {
      // Ignore cleanup errors
    }
  }
  res.clearCookie("admin_session", { path: "/" });
  res.redirect("/admin/login");
});

// ── Protected Routes (admin auth required) ──

router.use(adminAuth);

// Dashboard
router.get("/dashboard", async (_req: Request, res: Response) => {
  try {
    const [keys, roles, stats] = await Promise.all([
      listKeys(),
      listRoles(),
      getUsageStats(),
    ]);

    res.type("html").send(
      dashboardPage({ keys, roles, stats })
    );
  } catch (err: any) {
    res.status(500).send("Dashboard error: " + err.message);
  }
});

// ── API: Keys ──

router.get("/api/keys", async (_req: Request, res: Response) => {
  try {
    const keys = await listKeys();
    res.json(keys);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/keys", async (req: Request, res: Response) => {
  try {
    const { label, role_id } = req.body;
    if (!label || !role_id) {
      res.status(400).json({ error: "label and role_id are required" });
      return;
    }
    const result = await createApiKey(label, role_id, "admin");
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/api/keys/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active, role_id } = req.body;

    if (is_active === false) {
      await revokeKey(id as string);
    }
    if (role_id) {
      await updateKeyRole(id as string, role_id);
    }

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
    if (req.query.key_id) filters.key_id = req.query.key_id;
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
