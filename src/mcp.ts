/**
 * MCP JSON-RPC message handler.
 *
 * Processes initialize, ping, tools/list, tools/call, and notifications.
 * Separated from Express routing so it can be tested and reused independently.
 */

import express from "express";
import { getToolSchemas, executeTool } from "./tools/registry.js";
import { SERVER_INFO, SERVER_INSTRUCTIONS } from "./instructions.js";
import { logToolCall } from "./usage.js";

export function jsonrpcResponse(id: any, result: any) {
  return { jsonrpc: "2.0", id, result };
}

export function jsonrpcError(id: any, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export async function handleMessage(msg: any, req: express.Request): Promise<any> {
  const { method, id, params } = msg;

  switch (method) {
    case "initialize":
      return jsonrpcResponse(id, {
        protocolVersion: "2025-03-26",
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: SERVER_INSTRUCTIONS,
      });

    case "notifications/initialized":
      return null;

    case "ping":
      return jsonrpcResponse(id, {});

    case "tools/list": {
      let tools = getToolSchemas();
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
          return jsonrpcError(
            id,
            -32001,
            `Tool "${toolName}" is not allowed for your role "${req.user.role.name}"`
          );
        }
      }

      // Strip financials for roles without booking access
      if (req.user?.role?.allowed_tools && !req.user.role.allowed_tools.includes("get_booking")) {
        toolArgs.include_financials = false;
      }

      const startTime = Date.now();
      try {
        const result = await executeTool(toolName, toolArgs);
        const durationMs = Date.now() - startTime;

        logToolCall(req.user?.id || null, toolName, toolArgs, true, undefined, durationMs);

        return jsonrpcResponse(id, {
          content: [{ type: "text", text: result }],
        });
      } catch (error: any) {
        const durationMs = Date.now() - startTime;

        logToolCall(req.user?.id || null, toolName, toolArgs, false, error.message, durationMs);

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
