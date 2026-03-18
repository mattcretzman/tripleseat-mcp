/**
 * Usage logging and analytics.
 */

import { query, queryOne } from "./db.js";

/**
 * Log a tool call (fire and forget — caller should not await).
 */
export function logToolCall(
  apiKeyId: string | null,
  toolName: string,
  args: Record<string, any>,
  success: boolean,
  errorMessage?: string,
  durationMs?: number
): void {
  query(
    `INSERT INTO mcp_usage_logs (api_key_id, tool_name, args, success, error_message, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [apiKeyId, toolName, JSON.stringify(args), success, errorMessage || null, durationMs || null]
  ).catch((err) => {
    console.error("[Usage Log Error]", err.message);
  });
}

export interface UsageFilters {
  key_id?: string;
  tool_name?: string;
  days?: number;
}

/**
 * Get recent usage log entries.
 */
export async function getRecentUsage(
  limit: number = 100,
  filters?: UsageFilters
): Promise<any[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters?.key_id) {
    conditions.push(`l.api_key_id = $${paramIndex++}`);
    params.push(filters.key_id);
  }
  if (filters?.tool_name) {
    conditions.push(`l.tool_name = $${paramIndex++}`);
    params.push(filters.tool_name);
  }
  if (filters?.days) {
    conditions.push(`l.created_at >= NOW() - INTERVAL '${filters.days} days'`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await query(
    `SELECT l.id, l.api_key_id, l.tool_name, l.args, l.success, l.error_message,
            l.duration_ms, l.created_at,
            k.label AS api_key_label, k.key_prefix AS api_key_prefix
     FROM mcp_usage_logs l
     LEFT JOIN mcp_api_keys k ON k.id = l.api_key_id
     ${whereClause}
     ORDER BY l.created_at DESC
     LIMIT $${paramIndex}`,
    [...params, limit]
  );

  return rows.map((row) => ({
    id: row.id,
    api_key_id: row.api_key_id,
    tool_name: row.tool_name,
    args: row.args,
    success: row.success,
    error_message: row.error_message,
    duration_ms: row.duration_ms,
    created_at: row.created_at,
    api_key: row.api_key_label
      ? { label: row.api_key_label, key_prefix: row.api_key_prefix }
      : null,
  }));
}

export interface UsageStats {
  total_calls: number;
  calls_today: number;
  calls_this_week: number;
  top_tools: { tool_name: string; count: number }[];
  top_users: { label: string; count: number }[];
  calls_per_day: { date: string; count: number }[];
}

/**
 * Get aggregate usage statistics.
 */
export async function getUsageStats(dateRange?: { from?: string; to?: string }): Promise<UsageStats> {
  // Total calls
  const totalRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM mcp_usage_logs`
  );
  const totalCalls = parseInt(totalRow?.count || "0", 10);

  // Calls today
  const todayRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM mcp_usage_logs WHERE created_at >= CURRENT_DATE`
  );
  const callsToday = parseInt(todayRow?.count || "0", 10);

  // Calls this week
  const weekRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM mcp_usage_logs WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'`
  );
  const callsThisWeek = parseInt(weekRow?.count || "0", 10);

  // Date range for aggregations (default last 30 days)
  const now = new Date();
  const rangeStart = dateRange?.from || new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30).toISOString();
  const rangeEnd = dateRange?.to || now.toISOString();

  // Top tools
  const topTools = await query<{ tool_name: string; count: string }>(
    `SELECT tool_name, COUNT(*)::text AS count
     FROM mcp_usage_logs
     WHERE created_at >= $1 AND created_at <= $2
     GROUP BY tool_name
     ORDER BY COUNT(*) DESC
     LIMIT 10`,
    [rangeStart, rangeEnd]
  );

  // Top users
  const topUsers = await query<{ label: string; count: string }>(
    `SELECT COALESCE(k.label, 'unknown') AS label, COUNT(*)::text AS count
     FROM mcp_usage_logs l
     LEFT JOIN mcp_api_keys k ON k.id = l.api_key_id
     WHERE l.created_at >= $1 AND l.created_at <= $2
     GROUP BY k.label
     ORDER BY COUNT(*) DESC
     LIMIT 10`,
    [rangeStart, rangeEnd]
  );

  // Calls per day
  const callsPerDay = await query<{ date: string; count: string }>(
    `SELECT created_at::date::text AS date, COUNT(*)::text AS count
     FROM mcp_usage_logs
     WHERE created_at >= $1 AND created_at <= $2
     GROUP BY created_at::date
     ORDER BY created_at::date`,
    [rangeStart, rangeEnd]
  );

  return {
    total_calls: totalCalls,
    calls_today: callsToday,
    calls_this_week: callsThisWeek,
    top_tools: topTools.map((r) => ({ tool_name: r.tool_name, count: parseInt(r.count, 10) })),
    top_users: topUsers.map((r) => ({ label: r.label, count: parseInt(r.count, 10) })),
    calls_per_day: callsPerDay.map((r) => ({ date: r.date, count: parseInt(r.count, 10) })),
  };
}
