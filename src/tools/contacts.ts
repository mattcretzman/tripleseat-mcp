/**
 * Contact tools — get, search, create, update.
 */

import { ToolDefinition } from "./types.js";
import { tripleseatGet, tripleseatPost, tripleseatPut } from "../tripleseat.js";
import { summarizeList, truncateResponse, CONTACT_SUMMARY_FIELDS } from "./formatters.js";

export const contactTools: ToolDefinition[] = [
  {
    name: "get_contact",
    description: "Get contact details — name, email, phone, associated account.",
    inputSchema: {
      type: "object",
      properties: { contact_id: { type: "string" } },
      required: ["contact_id"],
    },
    execute: async (args) => {
      const { data } = await tripleseatGet(`/contacts/${args.contact_id}`);
      return JSON.stringify(data, null, 2);
    },
  },
  {
    name: "search_contacts",
    description:
      "Search contacts by name, email, or phone. Returns summary fields only. Use get_contact for full details.",
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
      const { data } = await tripleseatGet("/contacts/search", params);
      const result = summarizeList(data, CONTACT_SUMMARY_FIELDS);
      return truncateResponse(JSON.stringify(result), "search_contacts");
    },
  },
  {
    name: "create_contact",
    description:
      "Create a new contact in TripleSeat. Requires first_name and account_id. Include site_id if there are multiple sites.",
    inputSchema: {
      type: "object",
      properties: {
        first_name: { type: "string", description: "Contact first name" },
        last_name: { type: "string", description: "Contact last name" },
        account_id: { type: "number", description: "Account to associate the contact with" },
        site_id: { type: "number", description: "Site ID (only required if multiple sites exist)" },
        email: { type: "string", description: "Email address" },
        phone: { type: "string", description: "Phone number" },
        title: { type: "string", description: "Job title" },
      },
      required: ["first_name", "account_id"],
    },
    execute: async (args) => {
      const { site_id, ...contactFields } = args;
      const body: Record<string, any> = { contact: contactFields };
      if (site_id) body.site_id = site_id;
      const { data } = await tripleseatPost("/contacts", body);
      return JSON.stringify(data, null, 2);
    },
  },
  {
    name: "update_contact",
    description: "Update an existing contact in TripleSeat. Only include fields you want to change.",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "The TripleSeat contact ID to update" },
        first_name: { type: "string" },
        last_name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        title: { type: "string" },
        company: { type: "string" },
      },
      required: ["contact_id"],
    },
    execute: async (args) => {
      const { contact_id, ...contactFields } = args;
      const { data } = await tripleseatPut(`/contacts/${contact_id}`, { contact: contactFields });
      return JSON.stringify(data, null, 2);
    },
  },
];
