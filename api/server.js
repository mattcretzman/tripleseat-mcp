"use strict";
/**
 * TripleSeat MCP Server
 *
 * Creates the McpServer instance and registers all tools.
 * This is the brain — index.ts is just the transport wrapper.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const events_js_1 = require("./tools/events.js");
const leads_js_1 = require("./tools/leads.js");
const bookings_js_1 = require("./tools/bookings.js");
const contacts_js_1 = require("./tools/contacts.js");
const accounts_js_1 = require("./tools/accounts.js");
const locations_js_1 = require("./tools/locations.js");
function createServer() {
    const server = new mcp_js_1.McpServer({
        name: "tripleseat",
        version: "1.0.0",
    }, {
        capabilities: {
            tools: {},
        },
        instructions: `You are connected to TripleSeat, a CRM and event management platform for wedding and event venues. This server provides live read access to event data, leads, bookings, contacts, accounts, and venue locations.

Key context for this installation:
- Two venues: Knotting Hill Place and Brighton Abbey (both in the DFW area, ~10 minutes apart)
- The team handles ~700 inbound leads per month, booking 40-50 weddings
- Events always have at least: a booking, account, contact, location, and room
- Financial data is available on events and bookings when requested
- Use location IDs to filter results by venue when the user asks about a specific property

When answering questions:
- Be specific with dates, names, and numbers pulled from the data
- Flag any missing or incomplete fields — data quality visibility is a feature
- If a search returns no results, suggest broadening the query
- For availability checks, always check both venues unless told otherwise`,
    });
    // Register all tool domains
    (0, events_js_1.registerEventTools)(server);
    (0, leads_js_1.registerLeadTools)(server);
    (0, bookings_js_1.registerBookingTools)(server);
    (0, contacts_js_1.registerContactTools)(server);
    (0, accounts_js_1.registerAccountTools)(server);
    (0, locations_js_1.registerLocationTools)(server);
    return server;
}
