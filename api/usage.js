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
function logToolCall(apiKeyId, toolName, args, success, errorMessage, durationMs) {
    const db = (0, db_js_1.getSupabase)();
    db.from("mcp_usage_logs")
        .insert({
        api_key_id: apiKeyId,
        tool_name: toolName,
        args,
        success,
        error_message: errorMessage || null,
        duration_ms: durationMs || null,
    })
        .then(({ error }) => {
        if (error)
            console.error("[Usage Log Error]", error.message);
    });
}
/**
 * Get recent usage log entries.
 */
async function getRecentUsage(limit = 100, filters) {
    const db = (0, db_js_1.getSupabase)();
    let query = db
        .from("mcp_usage_logs")
        .select("id, api_key_id, tool_name, args, success, error_message, duration_ms, created_at, api_key:mcp_api_keys(label, key_prefix)")
        .order("created_at", { ascending: false })
        .limit(limit);
    if (filters?.key_id) {
        query = query.eq("api_key_id", filters.key_id);
    }
    if (filters?.tool_name) {
        query = query.eq("tool_name", filters.tool_name);
    }
    if (filters?.days) {
        const since = new Date();
        since.setDate(since.getDate() - filters.days);
        query = query.gte("created_at", since.toISOString());
    }
    const { data, error } = await query;
    if (error)
        throw new Error(`Failed to get usage: ${error.message}`);
    return data || [];
}
/**
 * Get aggregate usage statistics.
 */
async function getUsageStats(dateRange) {
    const db = (0, db_js_1.getSupabase)();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
    // Total calls
    const { count: totalCalls } = await db
        .from("mcp_usage_logs")
        .select("*", { count: "exact", head: true });
    // Calls today
    const { count: callsToday } = await db
        .from("mcp_usage_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart);
    // Calls this week
    const { count: callsThisWeek } = await db
        .from("mcp_usage_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", weekStart);
    // Get recent logs for aggregation (last 30 days by default)
    const rangeStart = dateRange?.from || new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30).toISOString();
    const rangeEnd = dateRange?.to || now.toISOString();
    const { data: recentLogs } = await db
        .from("mcp_usage_logs")
        .select("tool_name, created_at, api_key:mcp_api_keys(label)")
        .gte("created_at", rangeStart)
        .lte("created_at", rangeEnd)
        .order("created_at", { ascending: false })
        .limit(10000);
    const logs = recentLogs || [];
    // Aggregate top tools
    const toolCounts = new Map();
    const userCounts = new Map();
    const dayCounts = new Map();
    for (const log of logs) {
        // Top tools
        toolCounts.set(log.tool_name, (toolCounts.get(log.tool_name) || 0) + 1);
        // Top users
        const label = log.api_key?.label || "unknown";
        userCounts.set(label, (userCounts.get(label) || 0) + 1);
        // Calls per day
        const day = log.created_at.substring(0, 10);
        dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    }
    const topTools = [...toolCounts.entries()]
        .map(([tool_name, count]) => ({ tool_name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    const topUsers = [...userCounts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    const callsPerDay = [...dayCounts.entries()]
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
    return {
        total_calls: totalCalls || 0,
        calls_today: callsToday || 0,
        calls_this_week: callsThisWeek || 0,
        top_tools: topTools,
        top_users: topUsers,
        calls_per_day: callsPerDay,
    };
}
