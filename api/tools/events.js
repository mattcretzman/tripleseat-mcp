"use strict";
/**
 * Events Tools
 *
 * TripleSeat Events = time blocks at a venue location.
 * Every event has at least: booking, account, contact, location, room.
 * Financial data available via show_financial=true.
 * Rate limit: 10 req/sec on events endpoints.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerEventTools = registerEventTools;
const zod_1 = require("zod");
const tripleseat_js_1 = require("../tripleseat.js");
function registerEventTools(server) {
    // ── GET EVENT BY ID ──
    server.tool("get_event", "Get full event details from TripleSeat by event ID. Returns BEO data, packages, vendors, floor plan, status, and optionally financial details.", {
        event_id: zod_1.z.string().describe("The TripleSeat event ID"),
        include_financials: zod_1.z.boolean().optional().default(false)
            .describe("Include financial details (revenue, payments, balance)")
    }, async ({ event_id, include_financials }) => {
        const params = {};
        if (include_financials)
            params.show_financial = "true";
        const { data } = await (0, tripleseat_js_1.tripleseatGet)(`/events/${event_id}`, params);
        return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
    });
    // ── SEARCH EVENTS ──
    server.tool("search_events", "Search TripleSeat events by name, date range, status, or other criteria. Useful for finding specific weddings or checking what's happening in a time period.", {
        query: zod_1.z.string().optional().describe("Search term (event name, client name, etc.)"),
        status: zod_1.z.enum(["DEFINITE", "TENTATIVE", "PROSPECT", "CLOSED", "LOST"]).optional()
            .describe("Filter by event status"),
        from_date: zod_1.z.string().optional().describe("Start date filter (MM/DD/YYYY)"),
        to_date: zod_1.z.string().optional().describe("End date filter (MM/DD/YYYY)"),
        location_id: zod_1.z.string().optional().describe("Filter by venue location ID (Knotting Hill or Brighton Abbey)"),
        room_id: zod_1.z.string().optional().describe("Filter by specific room/area"),
        page: zod_1.z.number().optional().default(1).describe("Page number for pagination"),
        order: zod_1.z.string().optional().default("event_start")
            .describe("Sort field: event_start, created_at, updated_at"),
        sort_direction: zod_1.z.enum(["asc", "desc"]).optional().default("desc")
            .describe("Sort direction"),
        include_financials: zod_1.z.boolean().optional().default(false)
            .describe("Include financial details for each event"),
    }, async ({ query, status, from_date, to_date, location_id, room_id, page, order, sort_direction, include_financials }) => {
        const params = {};
        if (query)
            params.query = query;
        if (status)
            params.status = status;
        if (from_date)
            params.from_date = from_date;
        if (to_date)
            params.to_date = to_date;
        if (location_id)
            params.location_id = location_id;
        if (room_id)
            params.room_id = room_id;
        if (page)
            params.page = String(page);
        if (order)
            params.order = order;
        if (sort_direction)
            params.sort_direction = sort_direction;
        if (include_financials)
            params.show_financial = "true";
        const { data } = await (0, tripleseat_js_1.tripleseatGet)("/events/search", params);
        return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
    });
    // ── LIST UPCOMING EVENTS ──
    server.tool("list_upcoming_events", "List all events in a date range. Great for 'what's coming up this week/month', staffing planning, and scheduling overviews.", {
        from_date: zod_1.z.string().describe("Start date (MM/DD/YYYY) — defaults to today if not set"),
        to_date: zod_1.z.string().describe("End date (MM/DD/YYYY)"),
        location_id: zod_1.z.string().optional().describe("Filter to specific venue"),
        include_financials: zod_1.z.boolean().optional().default(false),
    }, async ({ from_date, to_date, location_id, include_financials }) => {
        const params = {
            from_date,
            to_date,
            order: "event_start",
            sort_direction: "asc",
        };
        if (location_id)
            params.location_id = location_id;
        if (include_financials)
            params.show_financial = "true";
        const { data } = await (0, tripleseat_js_1.tripleseatGet)("/events/search", params);
        return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
    });
    // ── CHECK AVAILABILITY ──
    server.tool("check_availability", "Check if a specific date is available at a venue by looking for existing events. Returns any events booked on that date so you can see what's open.", {
        date: zod_1.z.string().describe("Date to check (MM/DD/YYYY)"),
        location_id: zod_1.z.string().optional().describe("Specific venue location to check"),
    }, async ({ date, location_id }) => {
        const params = {
            from_date: date,
            to_date: date,
            order: "event_start",
            sort_direction: "asc",
        };
        if (location_id)
            params.location_id = location_id;
        const { data } = await (0, tripleseat_js_1.tripleseatGet)("/events/search", params);
        // Provide a clear availability summary
        const events = Array.isArray(data) ? data : data?.results || [];
        const summary = events.length === 0
            ? `No events found on ${date}. The date appears to be available.`
            : `Found ${events.length} event(s) on ${date}. Review details below to confirm availability.`;
        return {
            content: [
                { type: "text", text: summary },
                { type: "text", text: JSON.stringify(data, null, 2) },
            ],
        };
    });
}
