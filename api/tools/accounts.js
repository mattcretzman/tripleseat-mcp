"use strict";
/**
 * Account tools — get, search, create, update.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountTools = void 0;
const tripleseat_js_1 = require("../tripleseat.js");
const formatters_js_1 = require("./formatters.js");
exports.accountTools = [
    {
        name: "get_account",
        description: "Get account details — business name, contacts, associated events.",
        inputSchema: {
            type: "object",
            properties: { account_id: { type: "string" } },
            required: ["account_id"],
        },
        execute: async (args) => {
            const { data } = await (0, tripleseat_js_1.tripleseatGet)(`/accounts/${args.account_id}`);
            return JSON.stringify(data, null, 2);
        },
    },
    {
        name: "search_accounts",
        description: "Search accounts by name or email. Returns summary fields only. Use get_account for full details.",
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
            const { data } = await (0, tripleseat_js_1.tripleseatGet)("/accounts/search", params);
            const result = (0, formatters_js_1.summarizeList)(data, formatters_js_1.ACCOUNT_SUMMARY_FIELDS);
            return (0, formatters_js_1.truncateResponse)(JSON.stringify(result), "search_accounts");
        },
    },
    {
        name: "create_account",
        description: "Create a new account in TripleSeat. Requires name. Include site_id if there are multiple sites.",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string", description: "Account/business name" },
                site_id: { type: "number", description: "Site ID (only required if multiple sites exist)" },
                description: { type: "string", description: "Account description" },
                email: { type: "string", description: "Account email" },
                phone: { type: "string", description: "Account phone number" },
            },
            required: ["name"],
        },
        execute: async (args) => {
            const { site_id, ...accountFields } = args;
            const body = { account: accountFields };
            if (site_id)
                body.site_id = site_id;
            const { data } = await (0, tripleseat_js_1.tripleseatPost)("/accounts", body);
            return JSON.stringify(data, null, 2);
        },
    },
    {
        name: "update_account",
        description: "Update an existing account in TripleSeat. Only include fields you want to change.",
        inputSchema: {
            type: "object",
            properties: {
                account_id: { type: "string", description: "The TripleSeat account ID to update" },
                name: { type: "string" },
                description: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" },
            },
            required: ["account_id"],
        },
        execute: async (args) => {
            const { account_id, ...accountFields } = args;
            const { data } = await (0, tripleseat_js_1.tripleseatPut)(`/accounts/${account_id}`, { account: accountFields });
            return JSON.stringify(data, null, 2);
        },
    },
];
