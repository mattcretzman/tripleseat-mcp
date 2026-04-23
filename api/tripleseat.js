"use strict";
/**
 * TripleSeat API Client
 *
 * Wraps all REST calls with auth, error handling, retry on 401,
 * and pagination support. Every tool calls through this.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tripleseatRequest = tripleseatRequest;
exports.tripleseatGet = tripleseatGet;
exports.tripleseatPost = tripleseatPost;
exports.tripleseatPostLead = tripleseatPostLead;
exports.tripleseatPut = tripleseatPut;
exports.tripleseatDelete = tripleseatDelete;
exports.formatDate = formatDate;
const auth_js_1 = require("./auth.js");
const BASE_URL = "https://api.tripleseat.com/v1";
/**
 * Make an authenticated request to the TripleSeat API.
 * Automatically retries once on 401 (expired token).
 */
async function tripleseatRequest(endpoint, options = {}) {
    const { method = "GET", params, body, format = "json" } = options;
    // Build URL with query params
    const url = new URL(`${BASE_URL}${endpoint}.${format}`);
    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== "") {
                url.searchParams.set(key, value);
            }
        });
    }
    const makeRequest = async (token) => {
        const headers = {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        };
        const fetchOptions = { method, headers };
        if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
            fetchOptions.body = JSON.stringify(body);
        }
        return fetch(url.toString(), fetchOptions);
    };
    // First attempt
    let token = await (0, auth_js_1.getAccessToken)();
    let response = await makeRequest(token);
    // Retry once on 401 (token may have expired)
    if (response.status === 401) {
        (0, auth_js_1.clearTokenCache)();
        token = await (0, auth_js_1.getAccessToken)();
        response = await makeRequest(token);
    }
    const responseText = await response.text();
    if (!response.ok) {
        throw new Error(`TripleSeat API error (${response.status} ${response.statusText}): ${responseText.substring(0, 500)}`);
    }
    // Guard against HTML responses (redirects, error pages)
    if (responseText.trimStart().startsWith("<")) {
        throw new Error(`TripleSeat returned HTML instead of JSON for ${url.pathname} (status ${response.status}). First 300 chars: ${responseText.substring(0, 300)}`);
    }
    const data = JSON.parse(responseText);
    return { data: data, status: response.status };
}
/**
 * GET with automatic pagination.
 * TripleSeat returns paginated results — this fetches a specific page.
 */
async function tripleseatGet(endpoint, params = {}) {
    return tripleseatRequest(endpoint, { method: "GET", params });
}
/**
 * POST to create a new record
 */
async function tripleseatPost(endpoint, body, params = {}) {
    return tripleseatRequest(endpoint, { method: "POST", body, params });
}
/**
 * POST to create a lead via the Lead Form API.
 * TripleSeat lead creation uses a public_key instead of OAuth bearer auth.
 */
async function tripleseatPostLead(body) {
    const publicKey = process.env.TRIPLESEAT_PUBLIC_KEY;
    if (!publicKey) {
        throw new Error("Missing TRIPLESEAT_PUBLIC_KEY environment variable. " +
            "Find it in TripleSeat under Settings > Lead Forms > Setup Codes.");
    }
    return tripleseatRequest("/leads/create", {
        method: "POST",
        body,
        params: { public_key: publicKey },
    });
}
/**
 * PUT to update an existing record
 */
async function tripleseatPut(endpoint, body) {
    return tripleseatRequest(endpoint, { method: "PUT", body });
}
/**
 * DELETE a record
 */
async function tripleseatDelete(endpoint) {
    return tripleseatRequest(endpoint, { method: "DELETE" });
}
/**
 * Helper to format dates for TripleSeat API queries
 */
function formatDate(date) {
    const d = typeof date === "string" ? new Date(date) : date;
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}
