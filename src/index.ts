import express from "express";
import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";
import { hasCredentials } from "./auth.js";

const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, Mcp-Session-Id, Last-Event-ID");
  res.header("Access-Control-Expose-Headers", "Content-Type, Mcp-Session-Id");
  if (req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

// Health check
app.get("/", (_req, res) => {
  res.json({
    name: "tripleseat-mcp",
    version: "1.0.0",
    status: hasCredentials() ? "ready" : "missing_credentials",
    transport: "streamable-http",
    endpoint: "/mcp",
  });
});

// Session store — persists across warm Vercel invocations
const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();

app.post("/mcp", async (req, res) => {
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let session = sessionId ? sessions.get(sessionId) : undefined;

    if (session) {
      // Existing session — reuse transport
      await session.transport.handleRequest(req, res, req.body);
      return;
    }

    // New session — create server + transport
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) sessions.delete(sid);
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    // Store session after successful init
    const newSessionId = transport.sessionId;
    if (newSessionId) {
      sessions.set(newSessionId, { server, transport });
    }
  } catch (error) {
    console.error("[MCP Error]", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const session = sessionId ? sessions.get(sessionId) : undefined;
  if (!session) {
    res.status(400).json({ jsonrpc: "2.0", error: { code: -32000, message: "No session. Send initialize first." }, id: null });
    return;
  }
  await session.transport.handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
      await session.transport.close();
      sessions.delete(sessionId);
    }
  }
  res.status(200).json({ ok: true });
});

const PORT = process.env.PORT || 3000;
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log(`\n🔌 TripleSeat MCP Server running on http://localhost:${PORT}`);
    console.log(`   MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log(`   Credentials: ${hasCredentials() ? "✅ configured" : "❌ missing"}`);
    console.log();
  });
}

export default app;
