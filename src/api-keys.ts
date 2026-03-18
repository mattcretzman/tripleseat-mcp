/**
 * API Key management — generation, validation, CRUD.
 * Now includes OAuth client_credentials support for Claude connectors.
 */

import crypto from "node:crypto";
import { query, queryOne } from "./db.js";

export interface ApiKeyRecord {
  id: string;
  label: string;
  key_hash: string;
  key_prefix: string;
  role_id: string;
  is_active: boolean;
  created_by: string;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
  client_id?: string;
}

export interface ApiKeyWithRole extends ApiKeyRecord {
  role: {
    id: string;
    name: string;
    description: string;
    allowed_tools: string[];
  };
}

export interface GeneratedKey {
  plaintext: string;
  hash: string;
  prefix: string;
}

/**
 * Generate a new API key with ts_ prefix + 40 hex chars.
 */
export function generateApiKey(): GeneratedKey {
  const random = crypto.randomBytes(20).toString("hex"); // 40 hex chars
  const plaintext = `ts_${random}`;
  const hash = crypto.createHash("sha256").update(plaintext).digest("hex");
  const prefix = plaintext.substring(0, 11); // "ts_" + first 8 hex chars
  return { plaintext, hash, prefix };
}

/**
 * Generate OAuth client credentials (client_id + client_secret).
 */
export function generateOAuthCredentials(): { clientId: string; clientSecret: string; secretHash: string } {
  const clientId = "mcp_" + crypto.randomBytes(16).toString("hex");
  const clientSecret = "secret_" + crypto.randomBytes(24).toString("hex");
  const secretHash = crypto.createHash("sha256").update(clientSecret).digest("hex");
  return { clientId, clientSecret, secretHash };
}

/**
 * Create a new API key with OAuth credentials and insert into the database.
 * Returns the plaintext key + OAuth client_id/client_secret (shown once to the user).
 */
export async function createApiKey(
  label: string,
  roleId: string,
  createdBy: string
): Promise<{
  key: string;
  id: string;
  prefix: string;
  label: string;
  role_id: string;
  client_id: string;
  client_secret: string;
}> {
  const { plaintext, hash, prefix } = generateApiKey();
  const { clientId, clientSecret, secretHash } = generateOAuthCredentials();

  const row = await queryOne<{ id: string; label: string; key_prefix: string; role_id: string; client_id: string }>(
    `INSERT INTO mcp_api_keys (label, key_hash, key_prefix, role_id, created_by, is_active, client_id, client_secret_hash)
     VALUES ($1, $2, $3, $4, $5, true, $6, $7)
     RETURNING id, label, key_prefix, role_id, client_id`,
    [label, hash, prefix, roleId, createdBy, clientId, secretHash]
  );

  if (!row) throw new Error("Failed to create API key");

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
export async function validateKey(
  plaintextKey: string
): Promise<{ apiKey: ApiKeyRecord; role: { id: string; name: string; allowed_tools: string[] } } | null> {
  const hash = crypto.createHash("sha256").update(plaintextKey).digest("hex");

  const row = await queryOne<ApiKeyRecord & { role_name: string; role_allowed_tools: string[] }>(
    `SELECT k.*, r.name AS role_name, r.allowed_tools AS role_allowed_tools
     FROM mcp_api_keys k
     JOIN mcp_roles r ON r.id = k.role_id
     WHERE k.key_hash = $1 AND k.is_active = true`,
    [hash]
  );

  if (!row) return null;

  // Update last_used_at (fire and forget)
  query(
    `UPDATE mcp_api_keys SET last_used_at = NOW() WHERE id = $1`,
    [row.id]
  ).catch(() => {});

  const { role_name, role_allowed_tools, ...apiKeyFields } = row;

  return {
    apiKey: apiKeyFields as ApiKeyRecord,
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
export async function validateOAuthClient(
  clientId: string,
  clientSecret: string
): Promise<{ apiKey: ApiKeyRecord; role: { id: string; name: string; allowed_tools: string[] } } | null> {
  const secretHash = crypto.createHash("sha256").update(clientSecret).digest("hex");

  const row = await queryOne<ApiKeyRecord & { role_name: string; role_allowed_tools: string[] }>(
    `SELECT k.*, r.name AS role_name, r.allowed_tools AS role_allowed_tools
     FROM mcp_api_keys k
     JOIN mcp_roles r ON r.id = k.role_id
     WHERE k.client_id = $1 AND k.client_secret_hash = $2 AND k.is_active = true`,
    [clientId, secretHash]
  );

  if (!row) return null;

  // Update last_used_at (fire and forget)
  query(
    `UPDATE mcp_api_keys SET last_used_at = NOW() WHERE id = $1`,
    [row.id]
  ).catch(() => {});

  const { role_name, role_allowed_tools, ...apiKeyFields } = row;

  return {
    apiKey: apiKeyFields as ApiKeyRecord,
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
export async function listKeys(): Promise<any[]> {
  const rows = await query(
    `SELECT k.id, k.label, k.key_prefix, k.role_id, k.is_active, k.created_by,
            k.last_used_at, k.created_at, k.updated_at, k.client_id,
            r.id AS role_id_join, r.name AS role_name, r.description AS role_description
     FROM mcp_api_keys k
     LEFT JOIN mcp_roles r ON r.id = k.role_id
     ORDER BY k.created_at DESC`
  );

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
export async function revokeKey(id: string): Promise<void> {
  await query(
    `UPDATE mcp_api_keys SET is_active = false, updated_at = NOW() WHERE id = $1`,
    [id]
  );
}

/**
 * Update the role assigned to an API key.
 */
export async function updateKeyRole(id: string, newRoleId: string): Promise<void> {
  await query(
    `UPDATE mcp_api_keys SET role_id = $1, updated_at = NOW() WHERE id = $2`,
    [newRoleId, id]
  );
}
