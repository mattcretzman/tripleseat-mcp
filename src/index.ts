/**
 * TripleSeat MCP Server — Vercel Serverless Edition
 *
 * Handles JSON-RPC directly instead of using the SDK transport.
 * Every request is self-contained — no sessions needed.
 * This is the correct pattern for stateless serverless (Vercel, Lambda, etc.)
 */

import express from "express";
import cookieParser from "cookie-parser";
import {
  hasCredentials,
  hasRefreshToken,
  getAuthorizeUrl,
  exchangeCodeForTokens,
} from "./auth.js";
import { tripleseatGet } from "./tripleseat.js";
import { apiKeyAuth } from "./middleware.js";
import { adminRouter } from "./admin/routes.js";
import { logToolCall } from "./usage.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS, PATCH");
  res.header("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, Mcp-Session-Id, Last-Event-ID");
  res.header("Access-Control-Expose-Headers", "Content-Type, Mcp-Session-Id");
  if (req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

// Health check
app.get("/", (_req, res) => {
  const status = !hasCredentials()
    ? "missing_credentials"
    : !hasRefreshToken()
    ? "needs_oauth_setup"
    : "ready";
  res.json({
    name: "tripleseat-mcp",
    version: "2.0.0",
    status,
    transport: "streamable-http",
    endpoint: "/mcp",
    setup: status === "needs_oauth_setup" ? "/auth/login" : undefined,
  });
});

// ── Admin Dashboard ──
app.use("/admin", adminRouter);

// ── OAuth Setup Routes (one-time) ──

// Step 1: Redirect user to TripleSeat to authorize
app.get("/auth/login", (req, res) => {
  const host = req.headers.host || "tripleseat-mcp.vercel.app";
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const redirectUri = protocol + "://" + host + "/auth/callback";
  const authorizeUrl = getAuthorizeUrl(redirectUri);
  res.redirect(authorizeUrl);
});

// Step 2: TripleSeat redirects back here with a code
app.get("/auth/callback", async (req, res) => {
  const code = req.query.code as string;
  const error = req.query.error as string;

  if (error) {
    res.status(400).send(
      "<h1>Authorization Failed</h1><p>Error: " + error + "</p>" +
      "<p>" + (req.query.error_description || "") + "</p>"
    );
    return;
  }

  if (!code) {
    res.status(400).send("<h1>Missing authorization code</h1>");
    return;
  }

  try {
    const host = req.headers.host || "tripleseat-mcp.vercel.app";
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const redirectUri = protocol + "://" + host + "/auth/callback";

    const tokens = await exchangeCodeForTokens(code, redirectUri);

    // Show the refresh token for the user to copy into Vercel env vars
    res.send(`<!DOCTYPE html>
<html><head><title>TripleSeat MCP - OAuth Setup Complete</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; }
  .token-box { background: #f0f0f0; padding: 16px; border-radius: 8px; word-break: break-all; font-family: monospace; font-size: 14px; margin: 12px 0; }
  .success { color: #16a34a; }
  .step { margin: 20px 0; padding: 16px; background: #f8f8f8; border-left: 4px solid #0057ff; }
  h1 { color: #111; }
  code { background: #e5e5e5; padding: 2px 6px; border-radius: 4px; }
</style></head>
<body>
  <h1 class="success">OAuth Setup Complete!</h1>
  <p>TripleSeat authorized the Stormbreaker app. Here are your tokens:</p>

  <h3>Refresh Token (save this):</h3>
  <div class="token-box">${tokens.refresh_token || "NOT PROVIDED"}</div>

  <h3>Access Token (for testing, expires in ${tokens.expires_in || "?"}s):</h3>
  <div class="token-box">${tokens.access_token}</div>

  <h3>Scope:</h3>
  <div class="token-box">${tokens.scope || "not specified"}</div>

  <hr style="margin: 30px 0;">
  <h2>Next Step: Add to Vercel</h2>
  <div class="step">
    <p><strong>1.</strong> Go to <a href="https://vercel.com/mcretzman-9359s-projects/tripleseat-mcp/settings/environment-variables" target="_blank">Vercel Environment Variables</a></p>
    <p><strong>2.</strong> Add (or update) this variable:</p>
    <p><code>TRIPLESEAT_REFRESH_TOKEN</code> = the refresh token above</p>
    <p><strong>3.</strong> Redeploy the project (push a commit or click "Redeploy" in Vercel)</p>
  </div>
</body></html>`);
  } catch (err: any) {
    res.status(500).send(
      "<h1>Token Exchange Failed</h1><pre>" + err.message + "</pre>"
    );
  }
});

// ── Tool Definitions ──
const TOOLS = [
  {
    name: "get_event",
    description: "Get full event details from TripleSeat by event ID. Returns BEO data, packages, vendors, status, and optionally financial details.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string", description: "The TripleSeat event ID" },
        include_financials: { type: "boolean", description: "Include financial details", default: false }
      },
      required: ["event_id"]
    }
  },
  {
    name: "search_events",
    description: "Search TripleSeat events by name, date range, status, or venue. Useful for finding specific weddings or checking what's happening in a time period.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term (event name, client name)" },
        status: { type: "string", enum: ["DEFINITE", "TENTATIVE", "PROSPECT", "CLOSED", "LOST"], description: "Filter by status" },
        from_date: { type: "string", description: "Start date (MM/DD/YYYY)" },
        to_date: { type: "string", description: "End date (MM/DD/YYYY)" },
        location_id: { type: "string", description: "Filter by venue location ID" },
        page: { type: "number", description: "Page number", default: 1 },
        order: { type: "string", description: "Sort field", default: "event_start" },
        sort_direction: { type: "string", enum: ["asc", "desc"], default: "desc" },
        include_financials: { type: "boolean", default: false }
      }
    }
  },
  {
    name: "list_upcoming_events",
    description: "List all events in a date range. Great for 'what's coming up this week/month' and staffing planning.",
    inputSchema: {
      type: "object",
      properties: {
        from_date: { type: "string", description: "Start date (MM/DD/YYYY)" },
        to_date: { type: "string", description: "End date (MM/DD/YYYY)" },
        location_id: { type: "string", description: "Filter to specific venue" },
        include_financials: { type: "boolean", default: false }
      },
      required: ["from_date", "to_date"]
    }
  },
  {
    name: "check_availability",
    description: "Check if a specific date is available at a venue by looking for existing events on that date.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date to check (MM/DD/YYYY)" },
        location_id: { type: "string", description: "Specific venue to check" }
      },
      required: ["date"]
    }
  },
  {
    name: "get_lead",
    description: "Get full lead details — contact info, budget, date preferences, lead source, qualification data.",
    inputSchema: {
      type: "object",
      properties: { lead_id: { type: "string", description: "The TripleSeat lead ID" } },
      required: ["lead_id"]
    }
  },
  {
    name: "search_leads",
    description: "Search leads by name, email, date, status, or location. For finding inquiries and checking the lead pipeline.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term — name, email, phone" },
        status: { type: "string", description: "Lead status filter" },
        location_id: { type: "string", description: "Filter by venue" },
        from_date: { type: "string", description: "Created after (MM/DD/YYYY)" },
        to_date: { type: "string", description: "Created before (MM/DD/YYYY)" },
        page: { type: "number", default: 1 }
      }
    }
  },
  {
    name: "list_recent_leads",
    description: "Get the most recent leads. Good for checking latest inquiries and making sure nothing's fallen through the cracks.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", default: 1 },
        location_id: { type: "string", description: "Filter by venue" }
      }
    }
  },
  {
    name: "get_booking",
    description: "Get booking details including financial data — payment status, balance due, package totals.",
    inputSchema: {
      type: "object",
      properties: {
        booking_id: { type: "string", description: "The TripleSeat booking ID" },
        include_financials: { type: "boolean", default: true }
      },
      required: ["booking_id"]
    }
  },
  {
    name: "search_bookings",
    description: "Search bookings by date range or status. Use for revenue reporting and payment tracking.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        from_date: { type: "string", description: "MM/DD/YYYY" },
        to_date: { type: "string", description: "MM/DD/YYYY" },
        page: { type: "number", default: 1 },
        order: { type: "string", default: "created_at" },
        sort_direction: { type: "string", enum: ["asc", "desc"], default: "desc" },
        include_financials: { type: "boolean", default: false }
      }
    }
  },
  {
    name: "get_contact",
    description: "Get contact details — name, email, phone, associated account.",
    inputSchema: {
      type: "object",
      properties: { contact_id: { type: "string" } },
      required: ["contact_id"]
    }
  },
  {
    name: "search_contacts",
    description: "Search contacts by name, email, or phone.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, page: { type: "number", default: 1 } },
      required: ["query"]
    }
  },
  {
    name: "get_account",
    description: "Get account details — business name, contacts, associated events.",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "string" } },
      required: ["account_id"]
    }
  },
  {
    name: "search_accounts",
    description: "Search accounts by name or email.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, page: { type: "number", default: 1 } },
      required: ["query"]
    }
  },
  {
    name: "list_sites",
    description: "List all sites (top-level venue groups).",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "list_locations",
    description: "List all venue locations and their rooms/areas. Returns Knotting Hill Place and Brighton Abbey with spaces and capacities.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "get_location",
    description: "Get details for a specific venue location — address, rooms, capacity.",
    inputSchema: {
      type: "object",
      properties: { location_id: { type: "string" } },
      required: ["location_id"]
    }
  },
  {
    name: "list_users",
    description: "List all TripleSeat users (team members).",
    inputSchema: { type: "object", properties: {} }
  }
];

// ── Tool Execution ──
async function executeTool(name: string, args: any): Promise<string> {
  const params: Record<string, string> = {};

  switch (name) {
    case "get_event": {
      if (args.include_financials) params.show_financial = "true";
      const { data } = await tripleseatGet(`/events/${args.event_id}`, params);
      return JSON.stringify(data, null, 2);
    }
    case "search_events": {
      if (args.query) params.query = args.query;
      if (args.status) params.status = args.status;
      if (args.from_date) params.from_date = args.from_date;
      if (args.to_date) params.to_date = args.to_date;
      if (args.location_id) params.location_id = args.location_id;
      if (args.page) params.page = String(args.page);
      if (args.order) params.order = args.order;
      if (args.sort_direction) params.sort_direction = args.sort_direction;
      if (args.include_financials) params.show_financial = "true";
      const { data } = await tripleseatGet("/events/search", params);
      return JSON.stringify(data, null, 2);
    }
    case "list_upcoming_events": {
      params.from_date = args.from_date;
      params.to_date = args.to_date;
      params.order = "event_start";
      params.sort_direction = "asc";
      if (args.location_id) params.location_id = args.location_id;
      if (args.include_financials) params.show_financial = "true";
      const { data } = await tripleseatGet("/events/search", params);
      return JSON.stringify(data, null, 2);
    }
    case "check_availability": {
      params.from_date = args.date;
      params.to_date = args.date;
      params.order = "event_start";
      params.sort_direction = "asc";
      if (args.location_id) params.location_id = args.location_id;
      const { data } = await tripleseatGet("/events/search", params);
      const events = Array.isArray(data) ? data : (data as any)?.results || [];
      const summary = events.length === 0
        ? `No events found on ${args.date}. The date appears to be available.`
        : `Found ${events.length} event(s) on ${args.date}.`;
      return summary + "\n" + JSON.stringify(data, null, 2);
    }
    case "get_lead": {
      const { data } = await tripleseatGet(`/leads/${args.lead_id}`);
      return JSON.stringify(data, null, 2);
    }
    case "search_leads": {
      if (args.query) params.query = args.query;
      if (args.status) params.status = args.status;
      if (args.location_id) params.location_id = args.location_id;
      if (args.from_date) params.from_date = args.from_date;
      if (args.to_date) params.to_date = args.to_date;
      if (args.page) params.page = String(args.page);
      const { data } = await tripleseatGet("/leads/search", params);
      return JSON.stringify(data, null, 2);
    }
    case "list_recent_leads": {
      if (args.page) params.page = String(args.page);
      if (args.location_id) params.location_id = args.location_id;
      const { data } = await tripleseatGet("/leads", params);
      return JSON.stringify(data, null, 2);
    }
    case "get_booking": {
      if (args.include_financials !== false) params.show_financial = "true";
      const { data } = await tripleseatGet(`/bookings/${args.booking_id}`, params);
      return JSON.stringify(data, null, 2);
    }
    case "search_bookings": {
      if (args.query) params.query = args.query;
      if (args.from_date) params.from_date = args.from_date;
      if (args.to_date) params.to_date = args.to_date;
      if (args.page) params.page = String(args.page);
      if (args.order) params.order = args.order;
      if (args.sort_direction) params.sort_direction = args.sort_direction;
      if (args.include_financials) params.show_financial = "true";
      const { data } = await tripleseatGet("/bookings/search", params);
      return JSON.stringify(data, null, 2);
    }
    case "get_contact": {
      const { data } = await tripleseatGet(`/contacts/${args.contact_id}`);
      return JSON.stringify(data, null, 2);
    }
    case "search_contacts": {
      params.query = args.query;
      if (args.page) params.page = String(args.page);
      const { data } = await tripleseatGet("/contacts/search", params);
      return JSON.stringify(data, null, 2);
    }
    case "get_account": {
      const { data } = await tripleseatGet(`/accounts/${args.account_id}`);
      return JSON.stringify(data, null, 2);
    }
    case "search_accounts": {
      params.query = args.query;
      if (args.page) params.page = String(args.page);
      const { data } = await tripleseatGet("/accounts/search", params);
      return JSON.stringify(data, null, 2);
    }
    case "list_sites": {
      const { data } = await tripleseatGet("/sites");
      return JSON.stringify(data, null, 2);
    }
    case "list_locations": {
      const { data } = await tripleseatGet("/locations");
      return JSON.stringify(data, null, 2);
    }
    case "get_location": {
      const { data } = await tripleseatGet(`/locations/${args.location_id}`);
      return JSON.stringify(data, null, 2);
    }
    case "list_users": {
      const { data } = await tripleseatGet("/users");
      return JSON.stringify(data, null, 2);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── Server Info ──
const SERVER_INFO = {
  name: "tripleseat",
  version: "1.0.0",
};

const SERVER_INSTRUCTIONS = `You are connected to TripleSeat, a CRM and event management platform for wedding and event venues. This server provides live read access to event data, leads, bookings, contacts, accounts, and venue locations.

Key context for this installation:
- Two venues: Knotting Hill Place and Brighton Abbey (both in the DFW area, ~10 minutes apart)
- The team handles ~700 inbound leads per month, booking 40-50 weddings
- Events always have at least: a booking, account, contact, location, and room
- Financial data is available on events and bookings when requested
- Use location IDs to filter results by venue when the user asks about a specific property

When answering questions:
- Be specific with dates, names, and numbers pulled from the data
- Flag any missing or incomplete fields — data quality visibility is a feature
- If a search returns no results, suggest broadening the query
- For availability checks, always check both venues unless told otherwise`;

// ── JSON-RPC Handler ──
function jsonrpcResponse(id: any, result: any) {
  return { jsonrpc: "2.0", id, result };
}

function jsonrpcError(id: any, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function handleMessage(msg: any, req: express.Request): Promise<any> {
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
      return null; // Notification — no response

    case "ping":
      return jsonrpcResponse(id, {});

    case "tools/list": {
      let tools = TOOLS;
      // If request has an API key with role, filter tools to allowed_tools
      if (req.hasApiKey && req.role?.allowed_tools) {
        const allowed = new Set(req.role.allowed_tools);
        tools = TOOLS.filter((t) => allowed.has(t.name));
      }
      return jsonrpcResponse(id, { tools });
    }

    case "tools/call": {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      // Check tool access if API key is present
      if (req.hasApiKey && req.role?.allowed_tools) {
        if (!req.role.allowed_tools.includes(toolName)) {
          return jsonrpcError(id, -32001, `Tool "${toolName}" is not allowed for your role "${req.role.name}"`);
        }
      }

      const startTime = Date.now();
      try {
        const result = await executeTool(toolName, toolArgs);
        const durationMs = Date.now() - startTime;

        // Fire-and-forget usage logging
        logToolCall(req.apiKeyId || null, toolName, toolArgs, true, undefined, durationMs);

        return jsonrpcResponse(id, {
          content: [{ type: "text", text: result }],
        });
      } catch (error: any) {
        const durationMs = Date.now() - startTime;

        // Fire-and-forget usage logging
        logToolCall(req.apiKeyId || null, toolName, toolArgs, false, error.message, durationMs);

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

// ── MCP Endpoint ──
app.post("/mcp", apiKeyAuth, async (req, res) => {
  try {
    const body = req.body;

    // Handle batch requests
    if (Array.isArray(body)) {
      const results = await Promise.all(body.map((msg: any) => handleMessage(msg, req)));
      const responses = results.filter((r) => r !== null);
      if (responses.length === 0) {
        res.status(202).end();
      } else {
        res.json(responses);
      }
      return;
    }

    // Single request
    const result = await handleMessage(body, req);
    if (result === null) {
      res.status(202).end();
    } else {
      res.json(result);
    }
  } catch (error: any) {
    console.error("[MCP Error]", error);
    res.status(500).json(jsonrpcError(null, -32603, "Internal server error"));
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).json(jsonrpcError(null, -32000, "Use POST for MCP requests"));
});

app.delete("/mcp", (_req, res) => {
  res.status(200).json({ ok: true });
});

// ── Start ──
const PORT = process.env.PORT || 3000;
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log(`\n🔌 TripleSeat MCP Server running on http://localhost:${PORT}`);
    console.log(`   MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log(`   Admin panel: http://localhost:${PORT}/admin/login`);
    console.log(`   Credentials: ${hasCredentials() ? "✅ configured" : "❌ missing"}`);
    console.log();
  });
}

export default app;
