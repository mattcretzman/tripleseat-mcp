"use strict";
/**
 * API Key management — generation, validation, CRUD.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateApiKey = generateApiKey;
exports.createApiKey = createApiKey;
exports.validateKey = validateKey;
exports.listKeys = listKeys;
exports.revokeKey = revokeKey;
exports.updateKeyRole = updateKeyRole;
const node_crypto_1 = __importDefault(require("node:crypto"));
const db_js_1 = require("./db.js");
/**
 * Generate a new API key with ts_ prefix + 40 hex chars.
 */
function generateApiKey() {
    const random = node_crypto_1.default.randomBytes(20).toString("hex"); // 40 hex chars
    const plaintext = `ts_${random}`;
    const hash = node_crypto_1.default.createHash("sha256").update(plaintext).digest("hex");
    const prefix = plaintext.substring(0, 11); // "ts_" + first 8 hex chars
    return { plaintext, hash, prefix };
}
/**
 * Create a new API key and insert into the database.
 * Returns the plaintext key (shown once to the user).
 */
async function createApiKey(label, roleId, createdBy) {
    const db = (0, db_js_1.getSupabase)();
    const { plaintext, hash, prefix } = generateApiKey();
    const { data, error } = await db
        .from("mcp_api_keys")
        .insert({
        label,
        key_hash: hash,
        key_prefix: prefix,
        role_id: roleId,
        created_by: createdBy,
        is_active: true,
    })
        .select("id, label, key_prefix, role_id")
        .single();
    if (error)
        throw new Error(`Failed to create API key: ${error.message}`);
    return {
        key: plaintext,
        id: data.id,
        prefix: data.key_prefix,
        label: data.label,
        role_id: data.role_id,
    };
}
/**
 * Validate a plaintext API key. Returns key + role info or null.
 */
async function validateKey(plaintextKey) {
    const db = (0, db_js_1.getSupabase)();
    const hash = node_crypto_1.default.createHash("sha256").update(plaintextKey).digest("hex");
    const { data, error } = await db
        .from("mcp_api_keys")
        .select("*, role:mcp_roles(id, name, allowed_tools)")
        .eq("key_hash", hash)
        .eq("is_active", true)
        .single();
    if (error || !data)
        return null;
    // Update last_used_at (fire and forget)
    db.from("mcp_api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", data.id)
        .then(() => { });
    return {
        apiKey: data,
        role: data.role,
    };
}
/**
 * List all API keys with role info (never returns hashes).
 */
async function listKeys() {
    const db = (0, db_js_1.getSupabase)();
    const { data, error } = await db
        .from("mcp_api_keys")
        .select("id, label, key_prefix, role_id, is_active, created_by, last_used_at, created_at, updated_at, role:mcp_roles(id, name, description)")
        .order("created_at", { ascending: false });
    if (error)
        throw new Error(`Failed to list keys: ${error.message}`);
    return data || [];
}
/**
 * Revoke an API key (soft delete).
 */
async function revokeKey(id) {
    const db = (0, db_js_1.getSupabase)();
    const { error } = await db
        .from("mcp_api_keys")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id);
    if (error)
        throw new Error(`Failed to revoke key: ${error.message}`);
}
/**
 * Update the role assigned to an API key.
 */
async function updateKeyRole(id, newRoleId) {
    const db = (0, db_js_1.getSupabase)();
    const { error } = await db
        .from("mcp_api_keys")
        .update({ role_id: newRoleId, updated_at: new Date().toISOString() })
        .eq("id", id);
    if (error)
        throw new Error(`Failed to update key role: ${error.message}`);
}
