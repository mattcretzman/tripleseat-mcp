"use strict";
/**
 * Accounts Tools
 *
 * TripleSeat Accounts = businesses or organizations.
 * Accounts have contacts under them. Every contact needs an account.
 * Useful for multi-event clients and referral tracking.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAccountTools = registerAccountTools;
const zod_1 = require("zod");
const tripleseat_js_1 = require("../tripleseat.js");
function registerAccountTools(server) {
    // ── GET ACCOUNT BY ID ──
    server.tool("get_account", "Get account details — business name, description, contacts, and associated events. Useful for multi-event clients or seeing full history with an organization.", {
        account_id: zod_1.z.string().describe("The TripleSeat account ID"),
    }, async ({ account_id }) => {
        const { data } = await (0, tripleseat_js_1.tripleseatGet)(`/accounts/${account_id}`);
        return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
    });
    // ── SEARCH ACCOUNTS ──
    server.tool("search_accounts", "Search accounts by name or email. Find an organization, check if a business is already in the system, or look up account history.", {
        query: zod_1.z.string().describe("Search term — matches name, email"),
        page: zod_1.z.number().optional().default(1),
    }, async ({ query, page }) => {
        const params = { query };
        if (page)
            params.page = String(page);
        const { data } = await (0, tripleseat_js_1.tripleseatGet)("/accounts/search", params);
        return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
    });
}
