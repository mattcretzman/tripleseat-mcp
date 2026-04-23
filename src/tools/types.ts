/**
 * Shared type for tool definitions across all tool modules.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  execute: (args: any) => Promise<string>;
}
