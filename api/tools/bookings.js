"use strict";
/**
 * Bookings Tools
 *
 * TripleSeat Bookings = the container tying events to a date range and location.
 * Financial data (revenue, payments, balance) available via show_financial=true.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBookingTools = registerBookingTools;
const zod_1 = require("zod");
const tripleseat_js_1 = require("../tripleseat.js");
function registerBookingTools(server) {
    // ── GET BOOKING BY ID ──
    server.tool("get_booking", "Get booking details including financial data — payment status, balance due, package totals. The financial view Zach needs without exporting to Excel.", {
        booking_id: zod_1.z.string().describe("The TripleSeat booking ID"),
        include_financials: zod_1.z.boolean().optional().default(true)
            .describe("Include payment and revenue details (default: true)"),
    }, async ({ booking_id, include_financials }) => {
        const params = {};
        if (include_financials)
            params.show_financial = "true";
        const { data } = await (0, tripleseat_js_1.tripleseatGet)(`/bookings/${booking_id}`, params);
        return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
    });
    // ── SEARCH BOOKINGS ──
    server.tool("search_bookings", "Search bookings by date range, status, or other criteria. Use for revenue reporting, finding bookings in a period, or checking payment status across events.", {
        query: zod_1.z.string().optional().describe("Search term"),
        from_date: zod_1.z.string().optional().describe("Bookings starting after this date (MM/DD/YYYY)"),
        to_date: zod_1.z.string().optional().describe("Bookings starting before this date (MM/DD/YYYY)"),
        page: zod_1.z.number().optional().default(1),
        order: zod_1.z.string().optional().default("created_at"),
        sort_direction: zod_1.z.enum(["asc", "desc"]).optional().default("desc"),
        include_financials: zod_1.z.boolean().optional().default(false),
    }, async ({ query, from_date, to_date, page, order, sort_direction, include_financials }) => {
        const params = {};
        if (query)
            params.query = query;
        if (from_date)
            params.from_date = from_date;
        if (to_date)
            params.to_date = to_date;
        if (page)
            params.page = String(page);
        if (order)
            params.order = order;
        if (sort_direction)
            params.sort_direction = sort_direction;
        if (include_financials)
            params.show_financial = "true";
        const { data } = await (0, tripleseat_js_1.tripleseatGet)("/bookings/search", params);
        return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
    });
}
