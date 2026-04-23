/**
 * Booking tools — get, search, create, update.
 */

import { ToolDefinition } from "./types.js";
import { tripleseatGet, tripleseatPost, tripleseatPut } from "../tripleseat.js";
import { summarizeList, truncateResponse, BOOKING_SUMMARY_FIELDS } from "./formatters.js";

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
      "Search bookings by date range or status. Returns summary fields only. Use get_booking for full details.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        from_date: { type: "string", description: "MM/DD/YYYY" },
        to_date: { type: "string", description: "MM/DD/YYYY" },
        page: { type: "number", default: 1 },
        order: { type: "string", default: "created_at" },
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
