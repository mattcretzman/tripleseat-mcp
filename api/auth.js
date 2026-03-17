"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccessToken = getAccessToken;
exports.clearTokenCache = clearTokenCache;
exports.hasCredentials = hasCredentials;
// Per TripleSeat docs: https://support.tripleseat.com/hc/en-us/articles/19394408627479
// The correct endpoint is /oauth/token (NOT /oauth2/token)
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
async function getAccessToken() {
    if (cachedToken && Date.now() < cachedToken.expires_at - 300000) {
        return cachedToken.access_token;
    }
    const { clientId, clientSecret } = getCredentials();
    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Per TripleSeat docs: only client_id, client_secret, grant_type — no scope
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "client_credentials",
        }),
    });
    const responseText = await response.text();
    if (!response.ok) {
        throw new Error("TripleSeat OAuth failed (" + response.status + "): " + responseText.substring(0, 500));
    }
    if (responseText.trimStart().startsWith("<")) {
        throw new Error("TripleSeat OAuth returned HTML instead of JSON (status " + response.status + "). URL: " + TOKEN_URL + ". First 300 chars: " + responseText.substring(0, 300));
    }
    let data;
    try {
        data = JSON.parse(responseText);
    }
    catch (e) {
        throw new Error("TripleSeat OAuth returned invalid JSON (status " + response.status + "): " + responseText.substring(0, 300));
    }
    cachedToken = {
        access_token: data.access_token,
        expires_at: Date.now() + (data.expires_in || 7200) * 1000,
    };
    return cachedToken.access_token;
}
function clearTokenCache() {
    cachedToken = null;
}
function hasCredentials() {
    return !!(process.env.TRIPLESEAT_CLIENT_ID && process.env.TRIPLESEAT_CLIENT_SECRET);
}
