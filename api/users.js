"use strict";
/**
 * User management — CRUD, password hashing, authentication.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUser = createUser;
exports.authenticateUser = authenticateUser;
exports.listUsers = listUsers;
exports.getUser = getUser;
exports.updateUser = updateUser;
exports.deactivateUser = deactivateUser;
exports.resetPassword = resetPassword;
exports.touchLastActive = touchLastActive;
exports.seedAdminUser = seedAdminUser;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_js_1 = require("./db.js");
const BCRYPT_ROUNDS = 12;
async function createUser(email, name, password, roleId, isAdmin = false) {
    const passwordHash = await bcryptjs_1.default.hash(password, BCRYPT_ROUNDS);
    const row = await (0, db_js_1.queryOne)(`INSERT INTO mcp_users (email, name, password_hash, role_id, is_admin)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`, [email.toLowerCase().trim(), name.trim(), passwordHash, roleId, isAdmin]);
    if (!row)
        throw new Error("Failed to create user");
    return row;
}
/**
 * Validate email + password. Returns user with role info or null.
 */
async function authenticateUser(email, password) {
    const row = await (0, db_js_1.queryOne)(`SELECT u.*, r.name AS role_name, r.description AS role_description, r.allowed_tools AS role_allowed_tools
     FROM mcp_users u
     JOIN mcp_roles r ON r.id = u.role_id
     WHERE u.email = $1 AND u.is_active = true`, [email.toLowerCase().trim()]);
    if (!row)
        return null;
    const valid = await bcryptjs_1.default.compare(password, row.password_hash);
    if (!valid)
        return null;
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
async function listUsers() {
    const rows = await (0, db_js_1.query)(`SELECT u.id, u.email, u.name, u.role_id, u.is_admin, u.is_active,
            u.last_active_at, u.created_at, u.updated_at,
            r.name AS role_name, r.description AS role_description
     FROM mcp_users u
     LEFT JOIN mcp_roles r ON r.id = u.role_id
     ORDER BY u.created_at DESC`);
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
async function getUser(id) {
    const row = await (0, db_js_1.queryOne)(`SELECT u.*, r.name AS role_name, r.description AS role_description, r.allowed_tools AS role_allowed_tools
     FROM mcp_users u
     JOIN mcp_roles r ON r.id = u.role_id
     WHERE u.id = $1`, [id]);
    if (!row)
        return null;
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
async function updateUser(id, updates) {
    const setClauses = [];
    const params = [];
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
    if (setClauses.length === 0)
        throw new Error("No updates provided");
    setClauses.push(`updated_at = NOW()`);
    params.push(id);
    const row = await (0, db_js_1.queryOne)(`UPDATE mcp_users SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`, params);
    if (!row)
        throw new Error("User not found");
    return row;
}
async function deactivateUser(id) {
    await (0, db_js_1.query)(`UPDATE mcp_users SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
}
async function resetPassword(id, newPassword) {
    const passwordHash = await bcryptjs_1.default.hash(newPassword, BCRYPT_ROUNDS);
    await (0, db_js_1.query)(`UPDATE mcp_users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [
        passwordHash,
        id,
    ]);
}
async function touchLastActive(id) {
    (0, db_js_1.query)(`UPDATE mcp_users SET last_active_at = NOW() WHERE id = $1`, [id]).catch(() => { });
}
/**
 * Seed a default admin user from env vars on first deploy.
 * Skips if any admin user already exists.
 */
async function seedAdminUser(roleId) {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
        return { created: false };
    }
    const existing = await (0, db_js_1.queryOne)(`SELECT id FROM mcp_users WHERE is_admin = true LIMIT 1`);
    if (existing)
        return { created: false };
    await createUser(email, "Admin", password, roleId, true);
    console.log("[Users] Seeded default admin user:", email);
    return { created: true, email };
}
