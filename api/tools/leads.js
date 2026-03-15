"use strict";
/**
 * Leads Tools
 *
 * TripleSeat Leads = inbound inquiries before they become events.
 * Leads convert to Accounts/Contacts + Events/Bookings.
 * Banner gets ~700 leads/month, books ~40-50.
 * Rate limit: 10 req/sec on leads endpoints.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerLeadTools = registerLeadTools;
const zod_1 = require("zod");
const tripleseat_js_1 = require("../tripleseat.js");
function registerLeadTools(server) {
    // ── GET LEAD BY ID ──
    server.tool("get_lead", "Get full lead details from TripleSeat by lead ID. Returns contact info, event details, budget, date preferences, lead source, and qualification data.", {
        lead_id: zod_1.z.string().describe("The TripleSeat lead ID"),
    }, async ({ lead_id }) => {
        const { data } = await (0, tripleseat_js_1.tripleseatGet)(`/leads/${lead_id}`);
        return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
    });
    // ── SEARCH LEADS ──
    server.tool("search_leads", "Search TripleSeat leads by name, email, date, status, or location. Use for finding specific inquiries, checking lead pipeline, or filtering by venue.", {
        query: zod_1.z.string().optional().describe("Search term — matches name, email, phone, description"),
        status: zod_1.z.string().optional().describe("Lead status filter"),
        location_id: zod_1.z.string().optional().describe("Filter by venue location ID"),
        from_date: zod_1.z.string().optional().describe("Leads created after this date (MM/DD/YYYY)"),
        to_date: zod_1.z.string().optional().describe("Leads created before this date (MM/DD/YYYY)"),
        page: zod_1.z.number().optional().default(1).describe("Page number for pagination"),
    }, async ({ query, status, location_id, from_date, to_date, page }) => {
        const params = {};
        if (query)
            params.query = query;
        if (status)
            params.status = status;
        if (location_id)
            params.location_id = location_id;
        if (from_date)
            params.from_date = from_date;
        if (to_date)
            params.to_date = to_date;
        if (page)
            params.page = String(page);
        const { data } = await (0, tripleseat_js_1.tripleseatGet)("/leads/search", params);
        return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
    });
    // ── LIST RECENT LEADS ──
    server.tool("list_recent_leads", "Get the most recent leads (paginated). Good for checking the latest inquiries and making sure nothing's fallen through the cracks.", {
        page: zod_1.z.number().optional().default(1).describe("Page number"),
        location_id: zod_1.z.string().optional().describe("Filter by venue"),
    }, async ({ page, location_id }) => {
        const params = { page: String(page) };
        if (location_id)
            params.location_id = location_id;
        const { data } = await (0, tripleseat_js_1.tripleseatGet)("/leads", params);
        return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
    });
}
