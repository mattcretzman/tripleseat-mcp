"use strict";
/**
 * API Key management — generation, validation, CRUD.
 * Now includes OAuth client_credentials support for Claude connectors.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateApiKey = generateApiKey;
exports.generateOAuthCredentials = generateOAuthCredentials;
exports.createApiKey = createApiKey;
exports.validateKey = validateKey;
exports.validateOAuthClient = validateOAuthClient;
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
 * Generate OAuth client credentials (client_id + client_secret).
 */
function generateOAuthCredentials() {
    const clientId = "mcp_" + node_crypto_1.default.randomBytes(16).toString("hex");
    const clientSecret = "secret_" + node_crypto_1.default.randomBytes(24).toString("hex");
    const secretHash = node_crypto_1.default.createHash("sha256").update(clientSecret).digest("hex");
    return { clientId, clientSecret, secretHash };
}
/**
 * Create a new API key with OAuth credentials and insert into the database.
 * Returns the plaintext key + OAuth client_id/client_secret (shown once to the user).
 */
async function createApiKey(label, roleId, createdBy) {
    const { plaintext, hash, prefix } = generateApiKey();
    const { clientId, clientSecret, secretHash } = generateOAuthCredentials();
    const row = await (0, db_js_1.queryOne)(`INSERT INTO mcp_api_keys (label, key_hash, key_prefix, role_id, created_by, is_active, client_id, client_secret_hash)
     VALUES ($1, $2, $3, $4, $5, true, $6, $7)
     RETURNING id, label, key_prefix, role_id, client_id`, [label, hash, prefix, roleId, createdBy, clientId, secretHash]);
    if (!row)
        throw new Error("Failed to create API key");
    return {
        key: plaintext,
        id: row.id,
        prefix: row.key_prefix,
        label: row.label,
        role_id: row.role_id,
        client_id: clientId,
        client_secret: clientSecret,
    };
}
/**
 * Validate a plaintext API key (Bearer token). Returns key + role info or null.
 */
async function validateKey(plaintextKey) {
    const hash = node_crypto_1.default.createHash("sha256").update(plaintextKey).digest("hex");
    const row = await (0, db_js_1.queryOne)(`SELECT k.*, r.name AS role_name, r.allowed_tools AS role_allowed_tools
     FROM mcp_api_keys k
     JOIN mcp_roles r ON r.id = k.role_id
     WHERE k.key_hash = $1 AND k.is_active = true`, [hash]);
    if (!row)
        return null;
    // Update last_used_at (fire and forget)
    (0, db_js_1.query)(`UPDATE mcp_api_keys SET last_used_at = NOW() WHERE id = $1`, [row.id]).catch(() => { });
    const { role_name, role_allowed_tools, ...apiKeyFields } = row;
    return {
        apiKey: apiKeyFields,
        role: {
            id: row.role_id,
            name: role_name,
            allowed_tools: role_allowed_tools,
        },
    };
}
/**
 * Validate OAuth client_credentials. Returns key + role info or null.
 */
async function validateOAuthClient(clientId, clientSecret) {
    const secretHash = node_crypto_1.default.createHash("sha256").update(clientSecret).digest("hex");
    const row = await (0, db_js_1.queryOne)(`SELECT k.*, r.name AS role_name, r.allowed_tools AS role_allowed_tools
     FROM mcp_api_keys k
     JOIN mcp_roles r ON r.id = k.role_id
     WHERE k.client_id = $1 AND k.client_secret_hash = $2 AND k.is_active = true`, [clientId, secretHash]);
    if (!row)
        return null;
    // Update last_used_at (fire and forget)
    (0, db_js_1.query)(`UPDATE mcp_api_keys SET last_used_at = NOW() WHERE id = $1`, [row.id]).catch(() => { });
    const { role_name, role_allowed_tools, ...apiKeyFields } = row;
    return {
        apiKey: apiKeyFields,
        role: {
            id: row.role_id,
            name: role_name,
            allowed_tools: role_allowed_tools,
        },
    };
}
/**
 * List all API keys with role info (never returns hashes or secrets).
 */
async function listKeys() {
    const rows = await (0, db_js_1.query)(`SELECT k.id, k.label, k.key_prefix, k.role_id, k.is_active, k.created_by,
            k.last_used_at, k.created_at, k.updated_at, k.client_id,
            r.id AS role_id_join, r.name AS role_name, r.description AS role_description
     FROM mcp_api_keys k
     LEFT JOIN mcp_roles r ON r.id = k.role_id
     ORDER BY k.created_at DESC`);
    return rows.map((row) => ({
        id: row.id,
        label: row.label,
        key_prefix: row.key_prefix,
        role_id: row.role_id,
        is_active: row.is_active,
        created_by: row.created_by,
        last_used_at: row.last_used_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        client_id: row.client_id,
        role: {
            id: row.role_id_join,
            name: row.role_name,
            description: row.role_description,
        },
    }));
}
/**
 * Revoke an API key (soft delete).
 */
async function revokeKey(id) {
    await (0, db_js_1.query)(`UPDATE mcp_api_keys SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
}
/**
 * Update the role assigned to an API key.
 */
async function updateKeyRole(id, newRoleId) {
    await (0, db_js_1.query)(`UPDATE mcp_api_keys SET role_id = $1, updated_at = NOW() WHERE id = $2`, [newRoleId, id]);
}
