"use strict";
/**
 * Response formatting helpers — summarization, truncation, and field selection.
 * Keeps tool responses within context window limits.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACCOUNT_SUMMARY_FIELDS = exports.CONTACT_SUMMARY_FIELDS = exports.BOOKING_SUMMARY_FIELDS = exports.LEAD_SUMMARY_FIELDS = exports.EVENT_SUMMARY_FIELDS = exports.MAX_RESPONSE_CHARS = void 0;
exports.summarizeItem = summarizeItem;
exports.summarizeList = summarizeList;
exports.truncateResponse = truncateResponse;
exports.MAX_RESPONSE_CHARS = 12000;
exports.EVENT_SUMMARY_FIELDS = [
    "id", "name", "status", "event_start", "event_end",
    "location", "location_id", "room", "guest_count", "created_at",
];
exports.LEAD_SUMMARY_FIELDS = [
    "id", "first_name", "last_name", "email", "phone", "status",
    "location", "location_id", "event_date", "guest_count", "created_at", "lead_source",
];
exports.BOOKING_SUMMARY_FIELDS = [
    "id", "event_id", "status", "total", "balance_due",
    "created_at", "location", "location_id",
];
exports.CONTACT_SUMMARY_FIELDS = [
    "id", "first_name", "last_name", "email", "phone", "company", "account_id",
];
exports.ACCOUNT_SUMMARY_FIELDS = [
    "id", "name", "email", "phone", "address",
];
function summarizeItem(item, fields) {
    if (!item || typeof item !== "object")
        return item;
    const summary = {};
    for (const f of fields) {
        if (item[f] !== undefined)
            summary[f] = item[f];
    }
    return summary;
}
function summarizeList(data, fields) {
    const items = Array.isArray(data)
        ? data
        : data?.results || data?.data || [];
    const summarized = items.map((item) => summarizeItem(item, fields));
    return {
        items: summarized,
        total: data?.total_count ?? items.length,
        page: data?.page,
        truncatedFields: true,
    };
}
function truncateResponse(text, toolName) {
    if (text.length <= exports.MAX_RESPONSE_CHARS)
        return text;
    const hint = toolName.startsWith("search_") || toolName.startsWith("list_")
        ? `\n\n[Response truncated at ${exports.MAX_RESPONSE_CHARS} chars. Use get_event, get_lead, get_booking, or get_contact for full details on specific items.]`
        : `\n\n[Response truncated at ${exports.MAX_RESPONSE_CHARS} chars.]`;
    return text.substring(0, exports.MAX_RESPONSE_CHARS) + hint;
}
