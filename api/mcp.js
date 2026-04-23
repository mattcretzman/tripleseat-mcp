"use strict";
/**
 * MCP JSON-RPC message handler.
 *
 * Processes initialize, ping, tools/list, tools/call, and notifications.
 * Separated from Express routing so it can be tested and reused independently.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonrpcResponse = jsonrpcResponse;
exports.jsonrpcError = jsonrpcError;
exports.handleMessage = handleMessage;
const registry_js_1 = require("./tools/registry.js");
const instructions_js_1 = require("./instructions.js");
const usage_js_1 = require("./usage.js");
function jsonrpcResponse(id, result) {
    return { jsonrpc: "2.0", id, result };
}
function jsonrpcError(id, code, message) {
    return { jsonrpc: "2.0", id, error: { code, message } };
}
async function handleMessage(msg, req) {
    const { method, id, params } = msg;
    switch (method) {
        case "initialize":
            return jsonrpcResponse(id, {
                protocolVersion: "2025-03-26",
                capabilities: { tools: { listChanged: false } },
                serverInfo: instructions_js_1.SERVER_INFO,
                instructions: instructions_js_1.SERVER_INSTRUCTIONS,
            });
        case "notifications/initialized":
            return null;
        case "ping":
            return jsonrpcResponse(id, {});
        case "tools/list": {
            let tools = (0, registry_js_1.getToolSchemas)();
            if (req.user?.role?.allowed_tools) {
                const allowed = new Set(req.user.role.allowed_tools);
                tools = tools.filter((t) => allowed.has(t.name));
            }
            return jsonrpcResponse(id, { tools });
        }
        case "tools/call": {
            const toolName = params?.name;
            const toolArgs = params?.arguments || {};
            if (req.user?.role?.allowed_tools) {
                if (!req.user.role.allowed_tools.includes(toolName)) {
                    return jsonrpcError(id, -32001, `Tool "${toolName}" is not allowed for your role "${req.user.role.name}"`);
                }
            }
            // Strip financials for roles without booking access
            if (req.user?.role?.allowed_tools && !req.user.role.allowed_tools.includes("get_booking")) {
                toolArgs.include_financials = false;
            }
            const startTime = Date.now();
            try {
                const result = await (0, registry_js_1.executeTool)(toolName, toolArgs);
                const durationMs = Date.now() - startTime;
                (0, usage_js_1.logToolCall)(req.user?.id || null, toolName, toolArgs, true, undefined, durationMs);
                return jsonrpcResponse(id, {
                    content: [{ type: "text", text: result }],
                });
            }
            catch (error) {
                const durationMs = Date.now() - startTime;
                (0, usage_js_1.logToolCall)(req.user?.id || null, toolName, toolArgs, false, error.message, durationMs);
                return jsonrpcResponse(id, {
                    content: [{ type: "text", text: `Error: ${error.message}` }],
                    isError: true,
                });
            }
        }
        default:
            return jsonrpcError(id, -32601, `Method not found: ${method}`);
    }
}
