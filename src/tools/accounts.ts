/**
 * Accounts Tools
 * 
 * TripleSeat Accounts = businesses or organizations.
 * Accounts have contacts under them. Every contact needs an account.
 * Useful for multi-event clients and referral tracking.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tripleseatGet } from "../tripleseat.js";

export function registerAccountTools(server: McpServer): void {
  // ── GET ACCOUNT BY ID ──
  server.tool(
    "get_account",
    "Get account details — business name, description, contacts, and associated events. Useful for multi-event clients or seeing full history with an organization.",
    {
      account_id: z.string().describe("The TripleSeat account ID"),
    },
    async ({ account_id }) => {
      const { data } = await tripleseatGet(`/accounts/${account_id}`);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ── SEARCH ACCOUNTS ──
  server.tool(
    "search_accounts",
    "Search accounts by name or email. Find an organization, check if a business is already in the system, or look up account history.",
    {
      query: z.string().describe("Search term — matches name, email"),
      page: z.number().optional().default(1),
    },
    async ({ query, page }) => {
      const params: Record<string, string> = { query };
      if (page) params.page = String(page);

      const { data } = await tripleseatGet("/accounts/search", params);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
