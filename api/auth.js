"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccessToken = getAccessToken;
exports.clearTokenCache = clearTokenCache;
exports.hasCredentials = hasCredentials;
const TOKEN_URL = "https://api.tripleseat.com/oauth2/token";
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
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "client_credentials",
            scope: "read"
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error("TripleSeat OAuth failed (" + response.status + "): " + errorText);
    }
    const data = await response.json();
    cachedToken = {
        access_token: data.access_token,
        expires_at: Date.now() + data.expires_in * 1000,
    };
    return cachedToken.access_token;
}
function clearTokenCache() {
    cachedToken = null;
}
function hasCredentials() {
    return !!(process.env.TRIPLESEAT_CLIENT_ID && process.env.TRIPLESEAT_CLIENT_SECRET);
}
