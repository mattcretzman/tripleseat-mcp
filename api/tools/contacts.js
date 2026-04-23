"use strict";
/**
 * Contact tools — get, search, create, update.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactTools = void 0;
const tripleseat_js_1 = require("../tripleseat.js");
const formatters_js_1 = require("./formatters.js");
exports.contactTools = [
    {
        name: "get_contact",
        description: "Get contact details — name, email, phone, associated account.",
        inputSchema: {
            type: "object",
            properties: { contact_id: { type: "string" } },
            required: ["contact_id"],
        },
        execute: async (args) => {
            const { data } = await (0, tripleseat_js_1.tripleseatGet)(`/contacts/${args.contact_id}`);
            return JSON.stringify(data, null, 2);
        },
    },
    {
        name: "search_contacts",
        description: "Search contacts by name, email, or phone. Returns summary fields only. Use get_contact for full details.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string" },
                page: { type: "number", default: 1 },
            },
            required: ["query"],
        },
        execute: async (args) => {
            const params = { query: args.query };
            if (args.page)
                params.page = String(args.page);
            const { data } = await (0, tripleseat_js_1.tripleseatGet)("/contacts/search", params);
            const result = (0, formatters_js_1.summarizeList)(data, formatters_js_1.CONTACT_SUMMARY_FIELDS);
            return (0, formatters_js_1.truncateResponse)(JSON.stringify(result), "search_contacts");
        },
    },
    {
        name: "create_contact",
        description: "Create a new contact in TripleSeat. Requires first_name and account_id. Include site_id if there are multiple sites.",
        inputSchema: {
            type: "object",
            properties: {
                first_name: { type: "string", description: "Contact first name" },
                last_name: { type: "string", description: "Contact last name" },
                account_id: { type: "number", description: "Account to associate the contact with" },
                site_id: { type: "number", description: "Site ID (only required if multiple sites exist)" },
                email: { type: "string", description: "Email address" },
                phone: { type: "string", description: "Phone number" },
                title: { type: "string", description: "Job title" },
            },
            required: ["first_name", "account_id"],
        },
        execute: async (args) => {
            const { site_id, ...contactFields } = args;
            const body = { contact: contactFields };
            if (site_id)
                body.site_id = site_id;
            const { data } = await (0, tripleseat_js_1.tripleseatPost)("/contacts", body);
            return JSON.stringify(data, null, 2);
        },
    },
    {
        name: "update_contact",
        description: "Update an existing contact in TripleSeat. Only include fields you want to change.",
        inputSchema: {
            type: "object",
            properties: {
                contact_id: { type: "string", description: "The TripleSeat contact ID to update" },
                first_name: { type: "string" },
                last_name: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" },
                title: { type: "string" },
                company: { type: "string" },
            },
            required: ["contact_id"],
        },
        execute: async (args) => {
            const { contact_id, ...contactFields } = args;
            const { data } = await (0, tripleseat_js_1.tripleseatPut)(`/contacts/${contact_id}`, { contact: contactFields });
            return JSON.stringify(data, null, 2);
        },
    },
];
