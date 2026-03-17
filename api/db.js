"use strict";
/**
 * Supabase client — singleton instance for all DB operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupabase = getSupabase;
const supabase_js_1 = require("@supabase/supabase-js");
let client = null;
function getSupabase() {
    if (client)
        return client;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error("Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.");
    }
    client = (0, supabase_js_1.createClient)(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    return client;
}
