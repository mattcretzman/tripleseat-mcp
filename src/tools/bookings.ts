/**
 * Bookings Tools
 * 
 * TripleSeat Bookings = the container tying events to a date range and location.
 * Financial data (revenue, payments, balance) available via show_financial=true.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tripleseatGet } from "../tripleseat.js";

export function registerBookingTools(server: McpServer): void {
  // ── GET BOOKING BY ID ──
  server.tool(
    "get_booking",
    "Get booking details including financial data — payment status, balance due, package totals. The financial view Zach needs without exporting to Excel.",
    {
      booking_id: z.string().describe("The TripleSeat booking ID"),
      include_financials: z.boolean().optional().default(true)
        .describe("Include payment and revenue details (default: true)"),
    },
    async ({ booking_id, include_financials }) => {
      const params: Record<string, string> = {};
      if (include_financials) params.show_financial = "true";

      const { data } = await tripleseatGet(`/bookings/${booking_id}`, params);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ── SEARCH BOOKINGS ──
  server.tool(
    "search_bookings",
    "Search bookings by date range, status, or other criteria. Use for revenue reporting, finding bookings in a period, or checking payment status across events.",
    {
      query: z.string().optional().describe("Search term"),
      from_date: z.string().optional().describe("Bookings starting after this date (MM/DD/YYYY)"),
      to_date: z.string().optional().describe("Bookings starting before this date (MM/DD/YYYY)"),
      page: z.number().optional().default(1),
      order: z.string().optional().default("created_at"),
      sort_direction: z.enum(["asc", "desc"]).optional().default("desc"),
      include_financials: z.boolean().optional().default(false),
    },
    async ({ query, from_date, to_date, page, order, sort_direction, include_financials }) => {
      const params: Record<string, string> = {};
      if (query) params.query = query;
      if (from_date) params.from_date = from_date;
      if (to_date) params.to_date = to_date;
      if (page) params.page = String(page);
      if (order) params.order = order;
      if (sort_direction) params.sort_direction = sort_direction;
      if (include_financials) params.show_financial = "true";

      const { data } = await tripleseatGet("/bookings/search", params);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
