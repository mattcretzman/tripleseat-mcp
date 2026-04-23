"use strict";
/**
 * Event tools — get, search, list, availability, create, update.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventTools = void 0;
const tripleseat_js_1 = require("../tripleseat.js");
const formatters_js_1 = require("./formatters.js");
exports.eventTools = [
    {
        name: "get_event",
        description: "Get full event details from TripleSeat by event ID. Returns BEO data, packages, vendors, status, and optionally financial details.",
        inputSchema: {
            type: "object",
            properties: {
                event_id: { type: "string", description: "The TripleSeat event ID" },
                include_financials: { type: "boolean", description: "Include financial details", default: false },
            },
            required: ["event_id"],
        },
        execute: async (args) => {
            const params = {};
            if (args.include_financials)
                params.show_financial = "true";
            const { data } = await (0, tripleseat_js_1.tripleseatGet)(`/events/${args.event_id}`, params);
            return JSON.stringify(data, null, 2);
        },
    },
    {
        name: "search_events",
        description: "Search TripleSeat events by name, date range, status, or venue. Returns summary fields only (id, name, status, dates, location, guest count). Use get_event with the event ID for full details.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search term (event name, client name)" },
                status: {
                    type: "string",
                    enum: ["DEFINITE", "TENTATIVE", "PROSPECT", "CLOSED", "LOST"],
                    description: "Filter by status",
                },
                from_date: { type: "string", description: "Start date (MM/DD/YYYY)" },
                to_date: { type: "string", description: "End date (MM/DD/YYYY)" },
                location_id: { type: "string", description: "Filter by venue location ID" },
                page: { type: "number", description: "Page number", default: 1 },
                order: { type: "string", description: "Sort field", default: "event_start" },
                sort_direction: { type: "string", enum: ["asc", "desc"], default: "desc" },
                include_financials: { type: "boolean", default: false },
            },
        },
        execute: async (args) => {
            const params = {};
            if (args.query)
                params.query = args.query;
            if (args.status)
                params.status = args.status;
            if (args.from_date)
                params.event_start_date = args.from_date;
            if (args.to_date)
                params.event_end_date = args.to_date;
            if (args.location_id)
                params.location_id = args.location_id;
            if (args.page)
                params.page = String(args.page);
            if (args.order)
                params.order = args.order;
            if (args.sort_direction)
                params.sort_direction = args.sort_direction;
            if (args.include_financials)
                params.show_financial = "true";
            const { data } = await (0, tripleseat_js_1.tripleseatGet)("/events/search", params);
            const result = (0, formatters_js_1.summarizeList)(data, formatters_js_1.EVENT_SUMMARY_FIELDS);
            return (0, formatters_js_1.truncateResponse)(JSON.stringify(result), "search_events");
        },
    },
    {
        name: "list_upcoming_events",
        description: "List events in a date range. Returns summary fields only (id, name, status, dates, location, guest count). Use get_event for full details on any event.",
        inputSchema: {
            type: "object",
            properties: {
                from_date: { type: "string", description: "Start date (MM/DD/YYYY)" },
                to_date: { type: "string", description: "End date (MM/DD/YYYY)" },
                location_id: { type: "string", description: "Filter to specific venue" },
                include_financials: { type: "boolean", default: false },
            },
            required: ["from_date", "to_date"],
        },
        execute: async (args) => {
            const params = {
                event_start_date: args.from_date,
                event_end_date: args.to_date,
                order: "event_start",
                sort_direction: "asc",
            };
            if (args.location_id)
                params.location_id = args.location_id;
            if (args.include_financials)
                params.show_financial = "true";
            const { data } = await (0, tripleseat_js_1.tripleseatGet)("/events/search", params);
            const result = (0, formatters_js_1.summarizeList)(data, formatters_js_1.EVENT_SUMMARY_FIELDS);
            return (0, formatters_js_1.truncateResponse)(JSON.stringify(result), "list_upcoming_events");
        },
    },
    {
        name: "check_availability",
        description: "Check if a specific date is available at a venue by looking for existing events on that date.",
        inputSchema: {
            type: "object",
            properties: {
                date: { type: "string", description: "Date to check (MM/DD/YYYY)" },
                location_id: { type: "string", description: "Specific venue to check" },
            },
            required: ["date"],
        },
        execute: async (args) => {
            const params = {
                event_start_date: args.date,
                event_end_date: args.date,
                order: "event_start",
                sort_direction: "asc",
            };
            if (args.location_id)
                params.location_id = args.location_id;
            const { data } = await (0, tripleseat_js_1.tripleseatGet)("/events/search", params);
            const events = Array.isArray(data) ? data : data?.results || [];
            const summary = events.length === 0
                ? `No events found on ${args.date}. The date appears to be available.`
                : `Found ${events.length} event(s) on ${args.date}.`;
            const summarized = (0, formatters_js_1.summarizeList)(data, formatters_js_1.EVENT_SUMMARY_FIELDS);
            return (0, formatters_js_1.truncateResponse)(summary + "\n" + JSON.stringify(summarized), "check_availability");
        },
    },
    {
        name: "create_event",
        description: "Create a new event in TripleSeat. Requires name, event_start, event_end, account_id, contact_id, location_id, room_ids, and status.",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string", description: "Event name" },
                event_start: { type: "string", description: "Event start date/time (MM/DD/YYYY HH:MM AM/PM)" },
                event_end: { type: "string", description: "Event end date/time (MM/DD/YYYY HH:MM AM/PM)" },
                account_id: { type: "number", description: "Account ID" },
                contact_id: { type: "number", description: "Primary contact ID" },
                location_id: { type: "number", description: "Location ID" },
                room_ids: { type: "array", items: { type: "number" }, description: "Array of room IDs for the event" },
                status: {
                    type: "string",
                    enum: ["DEFINITE", "TENTATIVE", "PROSPECT", "CLOSED", "LOST"],
                    description: "Event status",
                },
                guest_count: { type: "number", description: "Expected guest count" },
                description: { type: "string", description: "Event description" },
            },
            required: ["name", "event_start", "event_end", "account_id", "contact_id", "location_id", "room_ids", "status"],
        },
        execute: async (args) => {
            const { data } = await (0, tripleseat_js_1.tripleseatPost)("/events", { event: args });
            return JSON.stringify(data, null, 2);
        },
    },
    {
        name: "update_event",
        description: "Update an existing event in TripleSeat. Only include fields you want to change.",
        inputSchema: {
            type: "object",
            properties: {
                event_id: { type: "string", description: "The TripleSeat event ID to update" },
                name: { type: "string" },
                event_start: { type: "string", description: "MM/DD/YYYY HH:MM AM/PM" },
                event_end: { type: "string", description: "MM/DD/YYYY HH:MM AM/PM" },
                status: { type: "string", enum: ["DEFINITE", "TENTATIVE", "PROSPECT", "CLOSED", "LOST"] },
                guest_count: { type: "number" },
                description: { type: "string" },
                room_ids: { type: "array", items: { type: "number" } },
            },
            required: ["event_id"],
        },
        execute: async (args) => {
            const { event_id, ...eventFields } = args;
            const { data } = await (0, tripleseat_js_1.tripleseatPut)(`/events/${event_id}`, { event: eventFields });
            return JSON.stringify(data, null, 2);
        },
    },
];
