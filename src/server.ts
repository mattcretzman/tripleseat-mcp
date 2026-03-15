/**
 * TripleSeat MCP Server
 * 
 * Creates the McpServer instance and registers all tools.
 * This is the brain — index.ts is just the transport wrapper.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEventTools } from "./tools/events.js";
import { registerLeadTools } from "./tools/leads.js";
import { registerBookingTools } from "./tools/bookings.js";
import { registerContactTools } from "./tools/contacts.js";
import { registerAccountTools } from "./tools/accounts.js";
import { registerLocationTools } from "./tools/locations.js";

export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: "tripleseat",
      version: "1.0.0",
    },
    {
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
    }
  );

  // Register all tool domains
  registerEventTools(server);
  registerLeadTools(server);
  registerBookingTools(server);
  registerContactTools(server);
  registerAccountTools(server);
  registerLocationTools(server);

  return server;
}
