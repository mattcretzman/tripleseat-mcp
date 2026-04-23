/**
 * Venue tools — sites, locations, users.
 */

import { ToolDefinition } from "./types.js";
import { tripleseatGet } from "../tripleseat.js";

export const venueTools: ToolDefinition[] = [
  {
    name: "list_sites",
    description: "List all sites (top-level venue groups).",
    inputSchema: { type: "object", properties: {} },
    execute: async () => {
      const { data } = await tripleseatGet("/sites");
      return JSON.stringify(data, null, 2);
    },
  },
  {
    name: "list_locations",
    description:
      "List all venue locations and their rooms/areas. Returns Knotting Hill Place and Brighton Abbey with spaces and capacities.",
    inputSchema: { type: "object", properties: {} },
    execute: async () => {
      const { data } = await tripleseatGet("/locations");
      return JSON.stringify(data, null, 2);
    },
  },
  {
    name: "get_location",
    description: "Get details for a specific venue location — address, rooms, capacity.",
    inputSchema: {
      type: "object",
      properties: { location_id: { type: "string" } },
      required: ["location_id"],
    },
    execute: async (args) => {
      const { data } = await tripleseatGet(`/locations/${args.location_id}`);
      return JSON.stringify(data, null, 2);
    },
  },
  {
    name: "list_users",
    description: "List all TripleSeat users (team members).",
    inputSchema: { type: "object", properties: {} },
    execute: async () => {
      const { data } = await tripleseatGet("/users");
      return JSON.stringify(data, null, 2);
    },
  },
];
