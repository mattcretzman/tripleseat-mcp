"use strict";
/**
 * TripleSeat OAuth 2.0 Authentication
 *
 * Handles token acquisition and refresh using client_credentials grant.
 * OAuth 1.0 sunsets July 1, 2026 — this is built on 2.0 from day one.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccessToken = getAccessToken;
exports.clearTokenCache = clearTokenCache;
exports.hasCredentials = hasCredentials;
const TOKEN_URL = "https://api.tripleseat.com/oauth/token";
let cachedToken = null;
function getCredentials() {
    const clientId = process.env.TRIPLESEAT_CLIENT_ID;
    const clientSecret = process.env.TRIPLESEAT_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error("Missing TripleSeat API credentials. Set TRIPLESEAT_CLIENT_ID and TRIPLESEAT_CLIENT_SECRET environment variables.");
    }
    return { clientId, clientSecret };
}
/**
 * Get a valid access token, refreshing if expired.
 * Caches token in memory with a 5-minute buffer before expiry.
 */
async function getAccessToken() {
    // Return cached token if still valid (with 5 min buffer)
    if (cachedToken && Date.now() < cachedToken.expires_at - 300_000) {
        return cachedToken.access_token;
    }
    const { clientId, clientSecret } = getCredentials();
    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "client_credentials",
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TripleSeat OAuth failed (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    cachedToken = {
        access_token: data.access_token,
        expires_at: Date.now() + data.expires_in * 1000,
    };
    return cachedToken.access_token;
}
/**
 * Clear the cached token (useful for retry logic on 401s)
 */
function clearTokenCache() {
    cachedToken = null;
}
/**
 * Check if credentials are configured (without making a network call)
 */
function hasCredentials() {
    return !!(process.env.TRIPLESEAT_CLIENT_ID && process.env.TRIPLESEAT_CLIENT_SECRET);
}
