"use strict";
/**
 * PostgreSQL client — singleton pool for all DB operations.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = query;
exports.queryOne = queryOne;
exports.migrate = migrate;
const pg_1 = __importDefault(require("pg"));
const { Pool } = pg_1.default;
let pool = null;
function getPool() {
    if (pool)
        return pool;
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("Missing DATABASE_URL environment variable.");
    }
    pool = new Pool({
        connectionString,
        max: 3,
        ssl: { rejectUnauthorized: false },
    });
    return pool;
}
async function query(text, params) {
    const result = await getPool().query(text, params);
    return result.rows;
}
async function queryOne(text, params) {
    const rows = await query(text, params);
    return rows[0] || null;
}
/**
 * Run schema migrations. Idempotent — safe to call on every cold start.
 * Non-destructive: adds new tables and columns without dropping existing data.
 */
async function migrate() {
    // ── Existing tables we keep untouched ──
    // mcp_roles, mcp_api_keys, tripleseat_tokens — left as-is
    await query(`
    CREATE TABLE IF NOT EXISTS mcp_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      allowed_tools TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    await query(`
    CREATE TABLE IF NOT EXISTS mcp_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role_id UUID REFERENCES mcp_roles(id),
      is_admin BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      last_active_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    await query(`
    CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
      client_id TEXT PRIMARY KEY,
      client_name TEXT,
      redirect_uris TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    await query(`
    CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
      code TEXT PRIMARY KEY,
      user_id UUID REFERENCES mcp_users(id) ON DELETE CASCADE,
      client_id TEXT,
      redirect_uri TEXT NOT NULL,
      code_challenge TEXT NOT NULL,
      code_challenge_method TEXT DEFAULT 'S256',
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN DEFAULT false
    )
  `);
    await query(`
    CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id UUID REFERENCES mcp_users(id) ON DELETE CASCADE,
      client_id TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      refresh_token_hash TEXT UNIQUE,
      refresh_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    await query(`
    CREATE TABLE IF NOT EXISTS tripleseat_tokens (
      id TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    // ── Upgrade existing tables in-place (add columns, don't drop data) ──
    // mcp_admin_sessions: add user_id if missing
    const hasSessionUserCol = await queryOne(`SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'mcp_admin_sessions' AND column_name = 'user_id'
    ) AS exists`);
    if (!hasSessionUserCol?.exists) {
        const sessionExists = await queryOne(`SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'mcp_admin_sessions'
      ) AS exists`);
        if (sessionExists?.exists) {
            console.log("[DB] Adding user_id column to mcp_admin_sessions...");
            await query(`ALTER TABLE mcp_admin_sessions ADD COLUMN user_id UUID REFERENCES mcp_users(id) ON DELETE CASCADE`);
        }
        else {
            await query(`
        CREATE TABLE mcp_admin_sessions (
          id TEXT PRIMARY KEY,
          user_id UUID REFERENCES mcp_users(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL
        )
      `);
        }
    }
    // mcp_usage_logs: add user_id if missing, keep existing api_key_id data
    const hasLogsUserCol = await queryOne(`SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'mcp_usage_logs' AND column_name = 'user_id'
    ) AS exists`);
    if (!hasLogsUserCol?.exists) {
        const logsExists = await queryOne(`SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'mcp_usage_logs'
      ) AS exists`);
        if (logsExists?.exists) {
            console.log("[DB] Adding user_id column to mcp_usage_logs...");
            await query(`ALTER TABLE mcp_usage_logs ADD COLUMN user_id UUID REFERENCES mcp_users(id) ON DELETE SET NULL`);
        }
        else {
            await query(`
        CREATE TABLE mcp_usage_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES mcp_users(id) ON DELETE SET NULL,
          tool_name TEXT NOT NULL,
          args JSONB DEFAULT '{}',
          success BOOLEAN DEFAULT true,
          error_message TEXT,
          duration_ms INTEGER,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
        }
    }
    console.log("[DB] Schema migration complete");
}
