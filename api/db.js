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
