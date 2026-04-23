/**
 * Account tools — get, search, create, update.
 */

import { ToolDefinition } from "./types.js";
import { tripleseatGet, tripleseatPost, tripleseatPut } from "../tripleseat.js";
import { summarizeList, truncateResponse, ACCOUNT_SUMMARY_FIELDS } from "./formatters.js";

export const accountTools: ToolDefinition[] = [
  {
    name: "get_account",
    description: "Get account details — business name, contacts, associated events.",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "string" } },
      required: ["account_id"],
    },
    execute: async (args) => {
      const { data } = await tripleseatGet(`/accounts/${args.account_id}`);
      return JSON.stringify(data, null, 2);
    },
  },
  {
    name: "search_accounts",
    description:
      "Search accounts by name or email. Returns summary fields only. Use get_account for full details.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        page: { type: "number", default: 1 },
      },
      required: ["query"],
    },
    execute: async (args) => {
      const params: Record<string, string> = { query: args.query };
      if (args.page) params.page = String(args.page);
      const { data } = await tripleseatGet("/accounts/search", params);
      const result = summarizeList(data, ACCOUNT_SUMMARY_FIELDS);
      return truncateResponse(JSON.stringify(result), "search_accounts");
    },
  },
  {
    name: "create_account",
    description:
      "Create a new account in TripleSeat. Requires name. Include site_id if there are multiple sites.",
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
      const body: Record<string, any> = { account: accountFields };
      if (site_id) body.site_id = site_id;
      const { data } = await tripleseatPost("/accounts", body);
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
      const { data } = await tripleseatPut(`/accounts/${account_id}`, { account: accountFields });
      return JSON.stringify(data, null, 2);
    },
  },
];
