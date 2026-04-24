"use strict";
/**
 * Tool registry — central collection of all tool definitions.
 *
 * Each domain module exports a ToolDefinition[]. This file imports them all,
 * builds the lookup map, and exposes helpers for the MCP handler and roles system.
 *
 * To add new tools: create a new file in src/tools/, export a ToolDefinition[],
 * and add it to the ALL_TOOLS spread below.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllToolNames = getAllToolNames;
exports.getToolSchemas = getToolSchemas;
exports.executeTool = executeTool;
const events_js_1 = require("./events.js");
const leads_js_1 = require("./leads.js");
const bookings_js_1 = require("./bookings.js");
const contacts_js_1 = require("./contacts.js");
const accounts_js_1 = require("./accounts.js");
const venues_js_1 = require("./venues.js");
const tasks_js_1 = require("./tasks.js");
const automation_js_1 = require("./automation.js");
const workflows_js_1 = require("./workflows.js");
const ALL_TOOLS = [
    ...events_js_1.eventTools,
    ...leads_js_1.leadTools,
    ...bookings_js_1.bookingTools,
    ...contacts_js_1.contactTools,
    ...accounts_js_1.accountTools,
    ...venues_js_1.venueTools,
    ...tasks_js_1.taskTools,
    ...automation_js_1.automationTools,
    ...workflows_js_1.workflowTools,
];
const toolMap = new Map(ALL_TOOLS.map((t) => [t.name, t]));
/**
 * All tool names, in registration order. Used by roles for allow-lists.
 */
function getAllToolNames() {
    return ALL_TOOLS.map((t) => t.name);
}
/**
 * Tool schemas for tools/list (strips the execute function).
 */
function getToolSchemas() {
    return ALL_TOOLS.map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
    }));
}
/**
 * Execute a tool by name with the given arguments.
 */
function executeTool(name, args) {
    const tool = toolMap.get(name);
    if (!tool)
        throw new Error(`Unknown tool: ${name}`);
    return tool.execute(args);
}
