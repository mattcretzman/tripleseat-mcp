/**
 * Usage logging and analytics.
 */

import { query, queryOne } from "./db.js";

/**
 * Log a tool call (fire and forget — caller should not await).
 */
export function logToolCall(
  userId: string | null,
  toolName: string,
  args: Record<string, any>,
  success: boolean,
  errorMessage?: string,
  durationMs?: number
): void {
  query(
    `INSERT INTO mcp_usage_logs (user_id, tool_name, args, success, error_message, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, toolName, JSON.stringify(args), success, errorMessage || null, durationMs || null]
  ).catch((err) => {
    console.error("[Usage Log Error]", err.message);
  });
}

export interface UsageFilters {
  user_id?: string;
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

  const rows = await query(
    `SELECT l.id, l.user_id, l.tool_name, l.args, l.success, l.error_message,
            l.duration_ms, l.created_at,
            u.name AS user_name, u.email AS user_email
     FROM mcp_usage_logs l
     LEFT JOIN mcp_users u ON u.id = l.user_id
     ${whereClause}
     ORDER BY l.created_at DESC
     LIMIT $${paramIndex}`,
    [...params, limit]
  );

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

export interface UsageStats {
  total_calls: number;
  calls_today: number;
  calls_this_week: number;
  error_count: number;
  error_rate: number;
  avg_duration_ms: number;
  top_tools: { tool_name: string; count: number }[];
  top_users: { name: string; count: number }[];
  calls_per_day: { date: string; count: number }[];
}

/**
 * Get aggregate usage statistics.
 */
export async function getUsageStats(dateRange?: { from?: string; to?: string }): Promise<UsageStats> {
  const now = new Date();
  const rangeStart = dateRange?.from || new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30).toISOString();
  const rangeEnd = dateRange?.to || now.toISOString();

  const [totalRow, todayRow, weekRow, errorRow, avgRow, topTools, topUsers, callsPerDay] =
    await Promise.all([
      queryOne<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM mcp_usage_logs`
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM mcp_usage_logs WHERE created_at >= CURRENT_DATE`
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM mcp_usage_logs WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'`
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM mcp_usage_logs WHERE success = false`
      ),
      queryOne<{ avg: string }>(
        `SELECT COALESCE(ROUND(AVG(duration_ms)), 0)::text AS avg FROM mcp_usage_logs WHERE duration_ms IS NOT NULL`
      ),
      query<{ tool_name: string; count: string }>(
        `SELECT tool_name, COUNT(*)::text AS count
         FROM mcp_usage_logs
         WHERE created_at >= $1 AND created_at <= $2
         GROUP BY tool_name
         ORDER BY COUNT(*) DESC
         LIMIT 10`,
        [rangeStart, rangeEnd]
      ),
      query<{ name: string; count: string }>(
        `SELECT COALESCE(u.name, 'unknown') AS name, COUNT(*)::text AS count
         FROM mcp_usage_logs l
         LEFT JOIN mcp_users u ON u.id = l.user_id
         WHERE l.created_at >= $1 AND l.created_at <= $2
         GROUP BY u.name
         ORDER BY COUNT(*) DESC
         LIMIT 10`,
        [rangeStart, rangeEnd]
      ),
      query<{ date: string; count: string }>(
        `SELECT created_at::date::text AS date, COUNT(*)::text AS count
         FROM mcp_usage_logs
         WHERE created_at >= $1 AND created_at <= $2
         GROUP BY created_at::date
         ORDER BY created_at::date`,
        [rangeStart, rangeEnd]
      ),
    ]);

  const totalCalls = parseInt(totalRow?.count || "0", 10);
  const errorCount = parseInt(errorRow?.count || "0", 10);

  return {
    total_calls: totalCalls,
    calls_today: parseInt(todayRow?.count || "0", 10),
    calls_this_week: parseInt(weekRow?.count || "0", 10),
    error_count: errorCount,
    error_rate: totalCalls > 0 ? Math.round((errorCount / totalCalls) * 1000) / 10 : 0,
    avg_duration_ms: parseInt(avgRow?.avg || "0", 10),
    top_tools: topTools.map((r) => ({ tool_name: r.tool_name, count: parseInt(r.count, 10) })),
    top_users: topUsers.map((r) => ({ name: r.name, count: parseInt(r.count, 10) })),
    calls_per_day: callsPerDay.map((r) => ({ date: r.date, count: parseInt(r.count, 10) })),
  };
}
