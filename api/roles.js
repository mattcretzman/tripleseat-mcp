"use strict";
/**
 * Role management — CRUD and seeding default roles.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_TOOLS = void 0;
exports.listRoles = listRoles;
exports.getRole = getRole;
exports.createRole = createRole;
exports.updateRole = updateRole;
exports.seedDefaultRoles = seedDefaultRoles;
const db_js_1 = require("./db.js");
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
];
exports.ALL_TOOLS = ALL_TOOLS;
/**
 * List all roles.
 */
async function listRoles() {
    const db = (0, db_js_1.getSupabase)();
    const { data, error } = await db
        .from("mcp_roles")
        .select("*")
        .order("name", { ascending: true });
    if (error)
        throw new Error(`Failed to list roles: ${error.message}`);
    return (data || []);
}
/**
 * Get a single role by ID.
 */
async function getRole(id) {
    const db = (0, db_js_1.getSupabase)();
    const { data, error } = await db
        .from("mcp_roles")
        .select("*")
        .eq("id", id)
        .single();
    if (error)
        return null;
    return data;
}
/**
 * Create a new role.
 */
async function createRole(name, description, allowedTools) {
    const db = (0, db_js_1.getSupabase)();
    const { data, error } = await db
        .from("mcp_roles")
        .insert({ name, description, allowed_tools: allowedTools })
        .select("*")
        .single();
    if (error)
        throw new Error(`Failed to create role: ${error.message}`);
    return data;
}
/**
 * Update an existing role.
 */
async function updateRole(id, updates) {
    const db = (0, db_js_1.getSupabase)();
    const { data, error } = await db
        .from("mcp_roles")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();
    if (error)
        throw new Error(`Failed to update role: ${error.message}`);
    return data;
}
/**
 * Seed default roles if none exist.
 */
async function seedDefaultRoles() {
    const db = (0, db_js_1.getSupabase)();
    const { count, error: countError } = await db
        .from("mcp_roles")
        .select("*", { count: "exact", head: true });
    if (countError)
        throw new Error(`Failed to check roles: ${countError.message}`);
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
    if (error)
        throw new Error(`Failed to seed roles: ${error.message}`);
    return { created: defaults.map((d) => d.name), skipped: false };
}
