"use strict";
/**
 * Usage logging and analytics.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logToolCall = logToolCall;
exports.getRecentUsage = getRecentUsage;
exports.getUsageStats = getUsageStats;
const db_js_1 = require("./db.js");
/**
 * Log a tool call (fire and forget — caller should not await).
 */
function logToolCall(userId, toolName, args, success, errorMessage, durationMs) {
    (0, db_js_1.query)(`INSERT INTO mcp_usage_logs (user_id, tool_name, args, success, error_message, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6)`, [userId, toolName, JSON.stringify(args), success, errorMessage || null, durationMs || null]).catch((err) => {
        console.error("[Usage Log Error]", err.message);
    });
}
/**
 * Get recent usage log entries.
 */
async function getRecentUsage(limit = 100, filters) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    if (filters?.user_id) {
        conditions.push(`l.user_id = $${paramIndex++}`);
        params.push(filters.user_id);
    }
    if (filters?.tool_name) {
        conditions.push(`l.tool_name = $${paramIndex++}`);
        params.push(filters.tool_name);
    }
    if (filters?.days) {
        conditions.push(`l.created_at >= NOW() - INTERVAL '${filters.days} days'`);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await (0, db_js_1.query)(`SELECT l.id, l.user_id, l.tool_name, l.args, l.success, l.error_message,
            l.duration_ms, l.created_at,
            u.name AS user_name, u.email AS user_email
     FROM mcp_usage_logs l
     LEFT JOIN mcp_users u ON u.id = l.user_id
     ${whereClause}
     ORDER BY l.created_at DESC
     LIMIT $${paramIndex}`, [...params, limit]);
    return rows.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        tool_name: row.tool_name,
        args: row.args,
        success: row.success,
        error_message: row.error_message,
        duration_ms: row.duration_ms,
        created_at: row.created_at,
        user: row.user_name
            ? { name: row.user_name, email: row.user_email }
            : null,
    }));
}
/**
 * Get aggregate usage statistics.
 */
async function getUsageStats(dateRange) {
    const totalRow = await (0, db_js_1.queryOne)(`SELECT COUNT(*)::text AS count FROM mcp_usage_logs`);
    const totalCalls = parseInt(totalRow?.count || "0", 10);
    const todayRow = await (0, db_js_1.queryOne)(`SELECT COUNT(*)::text AS count FROM mcp_usage_logs WHERE created_at >= CURRENT_DATE`);
    const callsToday = parseInt(todayRow?.count || "0", 10);
    const weekRow = await (0, db_js_1.queryOne)(`SELECT COUNT(*)::text AS count FROM mcp_usage_logs WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'`);
    const callsThisWeek = parseInt(weekRow?.count || "0", 10);
    const now = new Date();
    const rangeStart = dateRange?.from || new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30).toISOString();
    const rangeEnd = dateRange?.to || now.toISOString();
    const topTools = await (0, db_js_1.query)(`SELECT tool_name, COUNT(*)::text AS count
     FROM mcp_usage_logs
     WHERE created_at >= $1 AND created_at <= $2
     GROUP BY tool_name
     ORDER BY COUNT(*) DESC
     LIMIT 10`, [rangeStart, rangeEnd]);
    const topUsers = await (0, db_js_1.query)(`SELECT COALESCE(u.name, 'unknown') AS name, COUNT(*)::text AS count
     FROM mcp_usage_logs l
     LEFT JOIN mcp_users u ON u.id = l.user_id
     WHERE l.created_at >= $1 AND l.created_at <= $2
     GROUP BY u.name
     ORDER BY COUNT(*) DESC
     LIMIT 10`, [rangeStart, rangeEnd]);
    const callsPerDay = await (0, db_js_1.query)(`SELECT created_at::date::text AS date, COUNT(*)::text AS count
     FROM mcp_usage_logs
     WHERE created_at >= $1 AND created_at <= $2
     GROUP BY created_at::date
     ORDER BY created_at::date`, [rangeStart, rangeEnd]);
    return {
        total_calls: totalCalls,
        calls_today: callsToday,
        calls_this_week: callsThisWeek,
        top_tools: topTools.map((r) => ({ tool_name: r.tool_name, count: parseInt(r.count, 10) })),
        top_users: topUsers.map((r) => ({ name: r.name, count: parseInt(r.count, 10) })),
        calls_per_day: callsPerDay.map((r) => ({ date: r.date, count: parseInt(r.count, 10) })),
    };
}
