/**
 * Tool registry — central collection of all tool definitions.
 *
 * Each domain module exports a ToolDefinition[]. This file imports them all,
 * builds the lookup map, and exposes helpers for the MCP handler and roles system.
 *
 * To add new tools: create a new file in src/tools/, export a ToolDefinition[],
 * and add it to the ALL_TOOLS spread below.
 */

import { ToolDefinition } from "./types.js";
import { eventTools } from "./events.js";
import { leadTools } from "./leads.js";
import { bookingTools } from "./bookings.js";
import { contactTools } from "./contacts.js";
import { accountTools } from "./accounts.js";
import { venueTools } from "./venues.js";
import { taskTools } from "./tasks.js";
import { automationTools } from "./automation.js";

export type { ToolDefinition } from "./types.js";

const ALL_TOOLS: ToolDefinition[] = [
  ...eventTools,
  ...leadTools,
  ...bookingTools,
  ...contactTools,
  ...accountTools,
  ...venueTools,
  ...taskTools,
  ...automationTools,
];

const toolMap = new Map<string, ToolDefinition>(
  ALL_TOOLS.map((t) => [t.name, t])
);

/**
 * All tool names, in registration order. Used by roles for allow-lists.
 */
export function getAllToolNames(): string[] {
  return ALL_TOOLS.map((t) => t.name);
}

/**
 * Tool schemas for tools/list (strips the execute function).
 */
export function getToolSchemas(): Array<{
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}> {
  return ALL_TOOLS.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  }));
}

/**
 * Execute a tool by name with the given arguments.
 */
export function executeTool(name: string, args: any): Promise<string> {
  const tool = toolMap.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool.execute(args);
}
