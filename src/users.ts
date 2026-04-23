/**
 * User management — CRUD, password hashing, authentication.
 */

import bcrypt from "bcryptjs";
import { query, queryOne } from "./db.js";

const BCRYPT_ROUNDS = 12;

export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role_id: string;
  is_admin: boolean;
  is_active: boolean;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserWithRole extends User {
  role: {
    id: string;
    name: string;
    description: string;
    allowed_tools: string[];
  };
}

export async function createUser(
  email: string,
  name: string,
  password: string,
  roleId: string,
  isAdmin: boolean = false
): Promise<User> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const row = await queryOne<User>(
    `INSERT INTO mcp_users (email, name, password_hash, role_id, is_admin)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [email.toLowerCase().trim(), name.trim(), passwordHash, roleId, isAdmin]
  );

  if (!row) throw new Error("Failed to create user");
  return row;
}

/**
 * Validate email + password. Returns user with role info or null.
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<UserWithRole | null> {
  const row = await queryOne<
    User & { role_name: string; role_description: string; role_allowed_tools: string[] }
  >(
    `SELECT u.*, r.name AS role_name, r.description AS role_description, r.allowed_tools AS role_allowed_tools
     FROM mcp_users u
     JOIN mcp_roles r ON r.id = u.role_id
     WHERE u.email = $1 AND u.is_active = true`,
    [email.toLowerCase().trim()]
  );

  if (!row) return null;

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) return null;

  const { role_name, role_description, role_allowed_tools, ...userFields } = row;

  return {
    ...userFields,
    role: {
      id: row.role_id,
      name: role_name,
      description: role_description,
      allowed_tools: role_allowed_tools,
    },
  };
}

export async function listUsers(): Promise<any[]> {
  const rows = await query(
    `SELECT u.id, u.email, u.name, u.role_id, u.is_admin, u.is_active,
            u.last_active_at, u.created_at, u.updated_at,
            r.name AS role_name, r.description AS role_description
     FROM mcp_users u
     LEFT JOIN mcp_roles r ON r.id = u.role_id
     ORDER BY u.created_at DESC`
  );

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role_id: row.role_id,
    is_admin: row.is_admin,
    is_active: row.is_active,
    last_active_at: row.last_active_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    role: row.role_name
      ? { id: row.role_id, name: row.role_name, description: row.role_description }
      : null,
  }));
}

export async function getUser(id: string): Promise<UserWithRole | null> {
  const row = await queryOne<
    User & { role_name: string; role_description: string; role_allowed_tools: string[] }
  >(
    `SELECT u.*, r.name AS role_name, r.description AS role_description, r.allowed_tools AS role_allowed_tools
     FROM mcp_users u
     JOIN mcp_roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [id]
  );

  if (!row) return null;

  const { role_name, role_description, role_allowed_tools, ...userFields } = row;

  return {
    ...userFields,
    role: {
      id: row.role_id,
      name: role_name,
      description: role_description,
      allowed_tools: role_allowed_tools,
    },
  };
}

export async function updateUser(
  id: string,
  updates: Partial<Pick<User, "name" | "email" | "role_id" | "is_admin" | "is_active">>
): Promise<User> {
  const setClauses: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    params.push(updates.name.trim());
  }
  if (updates.email !== undefined) {
    setClauses.push(`email = $${paramIndex++}`);
    params.push(updates.email.toLowerCase().trim());
  }
  if (updates.role_id !== undefined) {
    setClauses.push(`role_id = $${paramIndex++}`);
    params.push(updates.role_id);
  }
  if (updates.is_admin !== undefined) {
    setClauses.push(`is_admin = $${paramIndex++}`);
    params.push(updates.is_admin);
  }
  if (updates.is_active !== undefined) {
    setClauses.push(`is_active = $${paramIndex++}`);
    params.push(updates.is_active);
  }

  if (setClauses.length === 0) throw new Error("No updates provided");

  setClauses.push(`updated_at = NOW()`);
  params.push(id);

  const row = await queryOne<User>(
    `UPDATE mcp_users SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  if (!row) throw new Error("User not found");
  return row;
}

export async function deactivateUser(id: string): Promise<void> {
  await query(`UPDATE mcp_users SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
}

export async function resetPassword(id: string, newPassword: string): Promise<void> {
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await query(`UPDATE mcp_users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [
    passwordHash,
    id,
  ]);
}

export async function touchLastActive(id: string): Promise<void> {
  query(`UPDATE mcp_users SET last_active_at = NOW() WHERE id = $1`, [id]).catch(() => {});
}

/**
 * Seed a default admin user from env vars on first deploy.
 * Skips if any admin user already exists.
 */
export async function seedAdminUser(roleId: string): Promise<{ created: boolean; email?: string }> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    return { created: false };
  }

  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM mcp_users WHERE is_admin = true LIMIT 1`
  );

  if (existing) return { created: false };

  await createUser(email, "Admin", password, roleId, true);
  console.log("[Users] Seeded default admin user:", email);
  return { created: true, email };
}
