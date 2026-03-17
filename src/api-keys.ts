/**
 * API Key management — generation, validation, CRUD.
 */

import crypto from "node:crypto";
import { getSupabase } from "./db.js";

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
 * Create a new API key and insert into the database.
 * Returns the plaintext key (shown once to the user).
 */
export async function createApiKey(
  label: string,
  roleId: string,
  createdBy: string
): Promise<{ key: string; id: string; prefix: string; label: string; role_id: string }> {
  const db = getSupabase();
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

  if (error) throw new Error(`Failed to create API key: ${error.message}`);

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
export async function validateKey(
  plaintextKey: string
): Promise<{ apiKey: ApiKeyRecord; role: { id: string; name: string; allowed_tools: string[] } } | null> {
  const db = getSupabase();
  const hash = crypto.createHash("sha256").update(plaintextKey).digest("hex");

  const { data, error } = await db
    .from("mcp_api_keys")
    .select("*, role:mcp_roles(id, name, allowed_tools)")
    .eq("key_hash", hash)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;

  // Update last_used_at (fire and forget)
  db.from("mcp_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return {
    apiKey: data as ApiKeyRecord,
    role: data.role as { id: string; name: string; allowed_tools: string[] },
  };
}

/**
 * List all API keys with role info (never returns hashes).
 */
export async function listKeys(): Promise<any[]> {
  const db = getSupabase();

  const { data, error } = await db
    .from("mcp_api_keys")
    .select("id, label, key_prefix, role_id, is_active, created_by, last_used_at, created_at, updated_at, role:mcp_roles(id, name, description)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list keys: ${error.message}`);
  return data || [];
}

/**
 * Revoke an API key (soft delete).
 */
export async function revokeKey(id: string): Promise<void> {
  const db = getSupabase();

  const { error } = await db
    .from("mcp_api_keys")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`Failed to revoke key: ${error.message}`);
}

/**
 * Update the role assigned to an API key.
 */
export async function updateKeyRole(id: string, newRoleId: string): Promise<void> {
  const db = getSupabase();

  const { error } = await db
    .from("mcp_api_keys")
    .update({ role_id: newRoleId, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`Failed to update key role: ${error.message}`);
}
