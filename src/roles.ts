/**
 * Role management — CRUD and seeding default roles.
 */

import { getSupabase } from "./db.js";

export interface Role {
  id: string;
  name: string;
  description: string;
  allowed_tools: string[];
  created_at: string;
  updated_at: string;
}

const ALL_TOOLS = [
  "get_event",
  "search_events",
  "list_upcoming_events",
  "check_availability",
  "get_lead",
  "search_leads",
  "list_recent_leads",
  "get_booking",
  "search_bookings",
  "get_contact",
  "search_contacts",
  "get_account",
  "search_accounts",
  "list_sites",
  "list_locations",
  "get_location",
  "list_users",
] as const;

export { ALL_TOOLS };

/**
 * List all roles.
 */
export async function listRoles(): Promise<Role[]> {
  const db = getSupabase();

  const { data, error } = await db
    .from("mcp_roles")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to list roles: ${error.message}`);
  return (data || []) as Role[];
}

/**
 * Get a single role by ID.
 */
export async function getRole(id: string): Promise<Role | null> {
  const db = getSupabase();

  const { data, error } = await db
    .from("mcp_roles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as Role;
}

/**
 * Create a new role.
 */
export async function createRole(
  name: string,
  description: string,
  allowedTools: string[]
): Promise<Role> {
  const db = getSupabase();

  const { data, error } = await db
    .from("mcp_roles")
    .insert({ name, description, allowed_tools: allowedTools })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create role: ${error.message}`);
  return data as Role;
}

/**
 * Update an existing role.
 */
export async function updateRole(
  id: string,
  updates: Partial<Pick<Role, "name" | "description" | "allowed_tools">>
): Promise<Role> {
  const db = getSupabase();

  const { data, error } = await db
    .from("mcp_roles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to update role: ${error.message}`);
  return data as Role;
}

/**
 * Seed default roles if none exist.
 */
export async function seedDefaultRoles(): Promise<{ created: string[]; skipped: boolean }> {
  const db = getSupabase();

  const { count, error: countError } = await db
    .from("mcp_roles")
    .select("*", { count: "exact", head: true });

  if (countError) throw new Error(`Failed to check roles: ${countError.message}`);

  if (count && count > 0) {
    return { created: [], skipped: true };
  }

  const defaults = [
    {
      name: "admin",
      description: "Full access to all 17 tools",
      allowed_tools: [...ALL_TOOLS],
    },
    {
      name: "manager",
      description: "All tools except user management",
      allowed_tools: ALL_TOOLS.filter((t) => t !== "list_users"),
    },
    {
      name: "coordinator",
      description: "Events, leads, availability, and bookings",
      allowed_tools: [
        "get_event",
        "search_events",
        "list_upcoming_events",
        "check_availability",
        "get_lead",
        "search_leads",
        "list_recent_leads",
        "get_booking",
        "search_bookings",
      ],
    },
    {
      name: "viewer",
      description: "Read-only access to individual records",
      allowed_tools: ALL_TOOLS.filter((t) => t.startsWith("get_")),
    },
  ];

  const { error } = await db.from("mcp_roles").insert(defaults);
  if (error) throw new Error(`Failed to seed roles: ${error.message}`);

  return { created: defaults.map((d) => d.name), skipped: false };
}
