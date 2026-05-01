/**
 * Booking tools — get, search, create, update.
 */

import { ToolDefinition } from "./types.js";
import { tripleseatGet, tripleseatPost, tripleseatPut, formatDate } from "../tripleseat.js";
import { summarizeItem, summarizeList, truncateResponse, BOOKING_SUMMARY_FIELDS } from "./formatters.js";

function extractBookings(data: any): any[] {
  if (Array.isArray(data)) return data;
  return (data as any)?.results || (data as any)?.data || [];
}

function buildDefiniteDateResponse(
  matched: any[],
  scannedTotal: number,
  args: any,
  hitPageLimit: boolean,
): string {
  const summarized = matched.map((b) => summarizeItem(b, BOOKING_SUMMARY_FIELDS));
  const result: Record<string, any> = {
    definite_date_range: `${args.from_date} — ${args.to_date}`,
    booking_count: matched.length,
    bookings: summarized,
    scanned_total: scannedTotal,
  };
  if (hitPageLimit) {
    result.note = "Reached page limit during scan. Results may be incomplete — try a narrower date range.";
  }
  return truncateResponse(JSON.stringify(result, null, 2), "search_bookings_by_definite_date");
}

export const bookingTools: ToolDefinition[] = [
  {
    name: "get_booking",
    description: "Get booking details including financial data — payment status, balance due, package totals.",
    inputSchema: {
      type: "object",
      properties: {
        booking_id: { type: "string", description: "The TripleSeat booking ID" },
        include_financials: { type: "boolean", default: true },
      },
      required: ["booking_id"],
    },
    execute: async (args) => {
      const params: Record<string, string> = {};
      if (args.include_financials !== false) params.show_financial = "true";
      const { data } = await tripleseatGet(`/bookings/${args.booking_id}`, params);
      return JSON.stringify(data, null, 2);
    },
  },
  {
    name: "search_bookings",
    description:
      "Search bookings by event date range, status, or query. The from_date/to_date filter by EVENT date, not definite_date. To find bookings marked definite in a date range, use search_bookings_by_definite_date instead. Returns summary fields only — use get_booking for full details.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term (booking name, client name)" },
        status: {
          type: "string",
          enum: ["DEFINITE", "TENTATIVE", "PROSPECT", "CLOSED", "LOST"],
          description: "Filter by booking status",
        },
        from_date: { type: "string", description: "Event start date (MM/DD/YYYY) — filters by event date, NOT definite_date" },
        to_date: { type: "string", description: "Event end date (MM/DD/YYYY) — filters by event date, NOT definite_date" },
        page: { type: "number", default: 1 },
        order: {
          type: "string",
          enum: ["created_at", "definite_date", "updated_at"],
          default: "created_at",
          description: "Sort field",
        },
        sort_direction: { type: "string", enum: ["asc", "desc"], default: "desc" },
        include_financials: { type: "boolean", default: false },
      },
    },
    execute: async (args) => {
      const params: Record<string, string> = {
        order: args.order || "created_at",
        sort_direction: args.sort_direction || "desc",
      };
      if (args.query) params.query = args.query;
      if (args.status) params.status = args.status;
      if (args.from_date) params.booking_start_date = args.from_date;
      if (args.to_date) params.booking_end_date = args.to_date;
      if (args.page) params.page = String(args.page);
      if (args.include_financials) params.show_financial = "true";
      const { data } = await tripleseatGet("/bookings/search", params);
      const result = summarizeList(data, BOOKING_SUMMARY_FIELDS);
      return truncateResponse(JSON.stringify(result), "search_bookings");
    },
  },
  {
    name: "search_bookings_by_definite_date",
    description:
      "Find bookings that were marked DEFINITE within a specific date range. Use this when someone asks 'how many bookings did we have this week/month' — a 'booking' means an event marked definite. The 'week' is Monday through Sunday. Fetches bookings sorted by definite_date and filters to only those whose definite_date falls within the given range.",
    inputSchema: {
      type: "object",
      properties: {
        from_date: {
          type: "string",
          description: "Start of definite_date range (MM/DD/YYYY). Inclusive.",
        },
        to_date: {
          type: "string",
          description: "End of definite_date range (MM/DD/YYYY). Inclusive.",
        },
        location_id: {
          type: "string",
          description: "Filter to a specific venue location",
        },
        include_financials: { type: "boolean", default: false },
      },
      required: ["from_date", "to_date"],
    },
    execute: async (args) => {
      const rangeStart = new Date(args.from_date);
      rangeStart.setHours(0, 0, 0, 0);
      const rangeEnd = new Date(args.to_date);
      rangeEnd.setHours(23, 59, 59, 999);

      const matched: any[] = [];
      let page = 1;
      const maxPages = 10;
      let scannedTotal = 0;

      while (page <= maxPages) {
        const params: Record<string, string> = {
          order: "definite_date",
          sort_direction: "desc",
          page: String(page),
        };
        if (args.location_id) params.location_id = args.location_id;
        if (args.include_financials) params.show_financial = "true";

        const { data } = await tripleseatGet("/bookings/search", params);
        const bookings = extractBookings(data);
        if (bookings.length === 0) break;

        for (const booking of bookings) {
          scannedTotal++;

          const rawDate = booking.definite_date;
          if (!rawDate) continue;

          const defDate = new Date(rawDate);
          if (isNaN(defDate.getTime())) continue;

          if (defDate >= rangeStart && defDate <= rangeEnd) {
            matched.push(booking);
          } else if (defDate < rangeStart) {
            // sorted DESC — once we're before the range, we can stop
            return buildDefiniteDateResponse(matched, scannedTotal, args, false);
          }
        }

        page++;
      }

      const hitPageLimit = page > maxPages;
      return buildDefiniteDateResponse(matched, scannedTotal, args, hitPageLimit);
    },
  },
  {
    name: "create_booking",
    description: "Create a new booking in TripleSeat. Requires name, start_date, end_date, and location_id.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Booking name" },
        start_date: { type: "string", description: "Start date (MM/DD/YYYY)" },
        end_date: { type: "string", description: "End date (MM/DD/YYYY)" },
        location_id: { type: "number", description: "Location ID for the venue" },
        account_id: { type: "number", description: "Account ID to associate" },
        contact_id: { type: "number", description: "Primary contact ID" },
        status: { type: "string", description: "Booking status" },
        description: { type: "string", description: "Booking description or notes" },
      },
      required: ["name", "start_date", "end_date", "location_id"],
    },
    execute: async (args) => {
      const { data } = await tripleseatPost("/bookings", { booking: args });
      return JSON.stringify(data, null, 2);
    },
  },
  {
    name: "update_booking",
    description: "Update an existing booking in TripleSeat. Only include fields you want to change.",
    inputSchema: {
      type: "object",
      properties: {
        booking_id: { type: "string", description: "The TripleSeat booking ID to update" },
        name: { type: "string" },
        start_date: { type: "string", description: "MM/DD/YYYY" },
        end_date: { type: "string", description: "MM/DD/YYYY" },
        location_id: { type: "number" },
        status: { type: "string" },
        description: { type: "string" },
      },
      required: ["booking_id"],
    },
    execute: async (args) => {
      const { booking_id, ...bookingFields } = args;
      const { data } = await tripleseatPut(`/bookings/${booking_id}`, { booking: bookingFields });
      return JSON.stringify(data, null, 2);
    },
  },
];
