/**
 * Locations Tools
 * 
 * TripleSeat hierarchy: Sites → Locations → Rooms/Areas
 * - Sites = the group (Banner's overall business)
 * - Locations = individual venues (Knotting Hill Place, Brighton Abbey)
 * - Rooms/Areas = spaces within venues
 * All read-only via API. No create/update/delete.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tripleseatGet } from "../tripleseat.js";

export function registerLocationTools(server: McpServer): void {
  // ── LIST SITES ──
  server.tool(
    "list_sites",
    "List all sites (top-level groups of venues). Returns site info including all associated locations.",
    {},
    async () => {
      const { data } = await tripleseatGet("/sites");
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ── LIST LOCATIONS ──
  server.tool(
    "list_locations",
    "List all venue locations and their rooms/areas. Returns Knotting Hill Place and Brighton Abbey with their available spaces, capacities, and details.",
    {},
    async () => {
      const { data } = await tripleseatGet("/locations");
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ── GET LOCATION BY ID ──
  server.tool(
    "get_location",
    "Get details for a specific venue location — address, rooms, capacity, and configuration.",
    {
      location_id: z.string().describe("The TripleSeat location ID"),
    },
    async ({ location_id }) => {
      const { data } = await tripleseatGet(`/locations/${location_id}`);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ── LIST USERS ──
  server.tool(
    "list_users",
    "List all TripleSeat users (team members). Useful for checking who's assigned to events or understanding team structure.",
    {},
    async () => {
      const { data } = await tripleseatGet("/users");
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
