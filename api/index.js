"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const crypto_1 = require("crypto");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const server_js_1 = require("./server.js");
const auth_js_1 = require("./auth.js");
const app = (0, express_1.default)();
app.use(express_1.default.json());
// CORS
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, Mcp-Session-Id, Last-Event-ID");
    res.header("Access-Control-Expose-Headers", "Content-Type, Mcp-Session-Id");
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
        status: (0, auth_js_1.hasCredentials)() ? "ready" : "missing_credentials",
        transport: "streamable-http",
        endpoint: "/mcp",
    });
});
// Session store — persists across warm Vercel invocations
const sessions = new Map();
app.post("/mcp", async (req, res) => {
    try {
        const sessionId = req.headers["mcp-session-id"];
        let session = sessionId ? sessions.get(sessionId) : undefined;
        if (session) {
            // Existing session — reuse transport
            await session.transport.handleRequest(req, res, req.body);
            return;
        }
        // New session — create server + transport
        const server = (0, server_js_1.createServer)();
        const transport = new streamableHttp_js_1.StreamableHTTPServerTransport({
            sessionIdGenerator: () => (0, crypto_1.randomUUID)(),
        });
        transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid)
                sessions.delete(sid);
        };
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        // Store session after successful init
        const newSessionId = transport.sessionId;
        if (newSessionId) {
            sessions.set(newSessionId, { server, transport });
        }
    }
    catch (error) {
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
    const sessionId = req.headers["mcp-session-id"];
    const session = sessionId ? sessions.get(sessionId) : undefined;
    if (!session) {
        res.status(400).json({ jsonrpc: "2.0", error: { code: -32000, message: "No session. Send initialize first." }, id: null });
        return;
    }
    await session.transport.handleRequest(req, res);
});
app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"];
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
        console.log(`   Credentials: ${(0, auth_js_1.hasCredentials)() ? "✅ configured" : "❌ missing"}`);
        console.log();
    });
}
exports.default = app;
