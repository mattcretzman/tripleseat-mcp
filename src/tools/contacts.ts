/**
 * Contacts Tools
 * 
 * TripleSeat Contacts = individual people (clients, vendors).
 * Every contact belongs to an Account.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tripleseatGet } from "../tripleseat.js";

export function registerContactTools(server: McpServer): void {
  // ── GET CONTACT BY ID ──
  server.tool(
    "get_contact",
    "Get contact details — name, email, phone, associated account. Useful for looking up client info before a call or checking who's tied to an event.",
    {
      contact_id: z.string().describe("The TripleSeat contact ID"),
    },
    async ({ contact_id }) => {
      const { data } = await tripleseatGet(`/contacts/${contact_id}`);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ── SEARCH CONTACTS ──
  server.tool(
    "search_contacts",
    "Search contacts by name, email, or phone. Find a client, check if someone's already in the system, or look up vendor contact details.",
    {
      query: z.string().describe("Search term — matches name, email, phone"),
      page: z.number().optional().default(1),
    },
    async ({ query, page }) => {
      const params: Record<string, string> = { query };
      if (page) params.page = String(page);

      const { data } = await tripleseatGet("/contacts/search", params);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
