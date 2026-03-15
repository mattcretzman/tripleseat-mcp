/**
 * TripleSeat MCP Server — Entry Point
 * 
 * Express app exposing a single /mcp endpoint via Streamable HTTP transport.
 * Stateless mode for Vercel serverless compatibility.
 * 
 * Local: node dist/index.js (listens on PORT, default 3000)
 * Vercel: auto-detected via serverless function export
 */

import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";
import { hasCredentials } from "./auth.js";

const app = express();

// Parse JSON bodies for POST requests
app.use(express.json());

// CORS — Claude.ai needs this to talk to our server
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, DELETE, OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Authorization, Mcp-Session-Id, Last-Event-ID"
  );
  res.header(
    "Access-Control-Expose-Headers",
    "Content-Type, Mcp-Session-Id"
  );
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
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

// ── MCP Endpoint ──
// Stateless: each request gets a fresh transport + server connection.
// This is the pattern for serverless (Vercel, Cloudflare, etc.)

app.post("/mcp", async (req, res) => {
  try {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless — no sessions
    });

    // Wire up error logging
    transport.onerror = (error) => {
      console.error("[MCP Transport Error]", error);
    };

    // Connect server to transport
    await server.connect(transport);

    // Let the transport handle the request
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("[MCP Request Error]", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

app.get("/mcp", async (req, res) => {
  try {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("[MCP GET Error]", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

app.delete("/mcp", async (req, res) => {
  // Stateless mode — no sessions to terminate
  res.status(200).json({ ok: true });
});

// ── Start (local dev) ──
const PORT = process.env.PORT || 3000;

// Only listen when running directly (not imported by Vercel)
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log(`\n🔌 TripleSeat MCP Server running on http://localhost:${PORT}`);
    console.log(`   MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log(
      `   Credentials: ${hasCredentials() ? "✅ configured" : "❌ missing — set TRIPLESEAT_CLIENT_ID and TRIPLESEAT_CLIENT_SECRET"}`
    );
    console.log();
  });
}

// Export for Vercel serverless
export default app;
