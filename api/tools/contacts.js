"use strict";
/**
 * Contacts Tools
 *
 * TripleSeat Contacts = individual people (clients, vendors).
 * Every contact belongs to an Account.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerContactTools = registerContactTools;
const zod_1 = require("zod");
const tripleseat_js_1 = require("../tripleseat.js");
function registerContactTools(server) {
    // ── GET CONTACT BY ID ──
    server.tool("get_contact", "Get contact details — name, email, phone, associated account. Useful for looking up client info before a call or checking who's tied to an event.", {
        contact_id: zod_1.z.string().describe("The TripleSeat contact ID"),
    }, async ({ contact_id }) => {
        const { data } = await (0, tripleseat_js_1.tripleseatGet)(`/contacts/${contact_id}`);
        return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
    });
    // ── SEARCH CONTACTS ──
    server.tool("search_contacts", "Search contacts by name, email, or phone. Find a client, check if someone's already in the system, or look up vendor contact details.", {
        query: zod_1.z.string().describe("Search term — matches name, email, phone"),
        page: zod_1.z.number().optional().default(1),
    }, async ({ query, page }) => {
        const params = { query };
        if (page)
            params.page = String(page);
        const { data } = await (0, tripleseat_js_1.tripleseatGet)("/contacts/search", params);
        return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
    });
}
