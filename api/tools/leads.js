"use strict";
/**
 * Lead tools — get, search, list, create, update.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.leadTools = void 0;
const tripleseat_js_1 = require("../tripleseat.js");
const formatters_js_1 = require("./formatters.js");
exports.leadTools = [
    {
        name: "get_lead",
        description: "Get full lead details — contact info, budget, date preferences, lead source, qualification data.",
        inputSchema: {
            type: "object",
            properties: { lead_id: { type: "string", description: "The TripleSeat lead ID" } },
            required: ["lead_id"],
        },
        execute: async (args) => {
            const { data } = await (0, tripleseat_js_1.tripleseatGet)(`/leads/${args.lead_id}`);
            return JSON.stringify(data, null, 2);
        },
    },
    {
        name: "search_leads",
        description: "Search leads by name, email, date, status, or location. Returns summary fields only. Use get_lead for full details.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search term — name, email, phone" },
                status: { type: "string", description: "Lead status filter" },
                location_id: { type: "string", description: "Filter by venue" },
                from_date: { type: "string", description: "Created after (MM/DD/YYYY)" },
                to_date: { type: "string", description: "Created before (MM/DD/YYYY)" },
                page: { type: "number", default: 1 },
            },
        },
        execute: async (args) => {
            const params = {
                order: "created_at",
                sort_direction: "desc",
            };
            if (args.query)
                params.query = args.query;
            if (args.status)
                params.status = args.status;
            if (args.location_id)
                params.location_id = args.location_id;
            if (args.from_date)
                params.from_date = args.from_date;
            if (args.to_date)
                params.to_date = args.to_date;
            if (args.page)
                params.page = String(args.page);
            const { data } = await (0, tripleseat_js_1.tripleseatGet)("/leads/search", params);
            const result = (0, formatters_js_1.summarizeList)(data, formatters_js_1.LEAD_SUMMARY_FIELDS);
            return (0, formatters_js_1.truncateResponse)(JSON.stringify(result), "search_leads");
        },
    },
    {
        name: "list_recent_leads",
        description: "Get the most recent leads (summary fields). Use get_lead for full details on any lead.",
        inputSchema: {
            type: "object",
            properties: {
                page: { type: "number", default: 1 },
                location_id: { type: "string", description: "Filter by venue" },
            },
        },
        execute: async (args) => {
            const params = {
                order: "created_at",
                sort_direction: "desc",
            };
            if (args.page)
                params.page = String(args.page);
            if (args.location_id)
                params.location_id = args.location_id;
            const { data } = await (0, tripleseat_js_1.tripleseatGet)("/leads/search", params);
            const result = (0, formatters_js_1.summarizeList)(data, formatters_js_1.LEAD_SUMMARY_FIELDS);
            return (0, formatters_js_1.truncateResponse)(JSON.stringify(result), "list_recent_leads");
        },
    },
    {
        name: "create_lead",
        description: "Create a new lead in TripleSeat. Requires first_name, last_name, email_address, and phone_number at minimum.",
        inputSchema: {
            type: "object",
            properties: {
                first_name: { type: "string", description: "Contact first name" },
                last_name: { type: "string", description: "Contact last name" },
                email_address: { type: "string", description: "Contact email" },
                phone_number: { type: "string", description: "Contact phone number" },
                company: { type: "string", description: "Company or organization name" },
                event_description: { type: "string", description: "Nature of event (becomes the event name when converted)" },
                event_date: { type: "string", description: "Requested event date (MM/DD/YYYY)" },
                start_time: { type: "string", description: "Requested start time (e.g. 3:00 PM)" },
                end_time: { type: "string", description: "Requested end time (e.g. 5:00 PM)" },
                guest_count: { type: "number", description: "Expected number of guests" },
                location_id: { type: "number", description: "Location ID (required if multiple locations)" },
                additional_information: { type: "string", description: "Additional details or notes" },
                contact_preference: { type: "string", enum: ["Email", "Phone"], description: "Preferred contact method" },
            },
            required: ["first_name", "last_name", "email_address", "phone_number"],
        },
        execute: async (args) => {
            const { lead_id, ...leadFields } = args;
            const { data } = await (0, tripleseat_js_1.tripleseatPost)("/leads", { lead: leadFields });
            return JSON.stringify(data, null, 2);
        },
    },
    {
        name: "update_lead",
        description: "Update an existing lead in TripleSeat. Only include fields you want to change.",
        inputSchema: {
            type: "object",
            properties: {
                lead_id: { type: "string", description: "The TripleSeat lead ID to update" },
                first_name: { type: "string" },
                last_name: { type: "string" },
                email_address: { type: "string" },
                phone_number: { type: "string" },
                company: { type: "string" },
                event_description: { type: "string" },
                event_date: { type: "string", description: "MM/DD/YYYY" },
                start_time: { type: "string" },
                end_time: { type: "string" },
                guest_count: { type: "number" },
                location_id: { type: "number" },
                additional_information: { type: "string" },
                status: { type: "string" },
            },
            required: ["lead_id"],
        },
        execute: async (args) => {
            const { lead_id, ...leadFields } = args;
            const { data } = await (0, tripleseat_js_1.tripleseatPut)(`/leads/${lead_id}`, { lead: leadFields });
            return JSON.stringify(data, null, 2);
        },
    },
];
