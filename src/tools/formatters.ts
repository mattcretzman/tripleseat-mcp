/**
 * Response formatting helpers — summarization, truncation, and field selection.
 * Keeps tool responses within context window limits.
 */

export const MAX_RESPONSE_CHARS = 12000;

export const EVENT_SUMMARY_FIELDS = [
  "id", "name", "status", "event_start", "event_end",
  "location", "location_id", "room", "guest_count", "created_at",
];

export const LEAD_SUMMARY_FIELDS = [
  "id", "first_name", "last_name", "email", "phone", "status",
  "location", "location_id", "event_date", "guest_count", "created_at", "lead_source",
];

export const BOOKING_SUMMARY_FIELDS = [
  "id", "event_id", "status", "total", "balance_due",
  "created_at", "location", "location_id",
];

export const CONTACT_SUMMARY_FIELDS = [
  "id", "first_name", "last_name", "email", "phone", "company", "account_id",
];

export const ACCOUNT_SUMMARY_FIELDS = [
  "id", "name", "email", "phone", "address",
];

export function summarizeItem(item: any, fields: string[]): any {
  if (!item || typeof item !== "object") return item;
  const summary: any = {};
  for (const f of fields) {
    if (item[f] !== undefined) summary[f] = item[f];
  }
  return summary;
}

export function summarizeList(
  data: any,
  fields: string[]
): { items: any[]; total?: number; page?: number; truncatedFields: boolean } {
  const items = Array.isArray(data)
    ? data
    : (data as any)?.results || (data as any)?.data || [];
  const summarized = items.map((item: any) => summarizeItem(item, fields));
  return {
    items: summarized,
    total: (data as any)?.total_count ?? items.length,
    page: (data as any)?.page,
    truncatedFields: true,
  };
}

export function truncateResponse(text: string, toolName: string): string {
  if (text.length <= MAX_RESPONSE_CHARS) return text;
  const hint = toolName.startsWith("search_") || toolName.startsWith("list_")
    ? `\n\n[Response truncated at ${MAX_RESPONSE_CHARS} chars. Use get_event, get_lead, get_booking, or get_contact for full details on specific items.]`
    : `\n\n[Response truncated at ${MAX_RESPONSE_CHARS} chars.]`;
  return text.substring(0, MAX_RESPONSE_CHARS) + hint;
}
