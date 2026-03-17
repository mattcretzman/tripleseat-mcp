"use strict";
/**
 * TripleSeat OAuth 2.0 Authentication — Authorization Code Flow
 *
 * TripleSeat requires the Authorization Code flow (not client_credentials)
 * because API calls need a "resource owner" (user) context.
 *
 * Setup flow (one-time):
 * 1. Visit /auth/login on the deployed server
 * 2. Log in to TripleSeat and authorize the app
 * 3. The callback captures a refresh_token
 * 4. Store the refresh_token in Vercel env as TRIPLESEAT_REFRESH_TOKEN
 *
 * Runtime flow:
 * - Uses the stored refresh_token to get fresh access_tokens
 * - Access tokens are cached and refreshed 5 min before expiry
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthorizeUrl = getAuthorizeUrl;
exports.exchangeCodeForTokens = exchangeCodeForTokens;
exports.getAccessToken = getAccessToken;
exports.clearTokenCache = clearTokenCache;
exports.hasCredentials = hasCredentials;
exports.hasRefreshToken = hasRefreshToken;
const TOKEN_URL = "https://api.tripleseat.com/oauth2/token";
// Authorize endpoint is on login.tripleseat.com
const AUTHORIZE_URL = "https://login.tripleseat.com/oauth2/authorize";
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
 * Build the authorization URL for the one-time OAuth setup.
 */
function getAuthorizeUrl(redirectUri) {
    const { clientId } = getCredentials();
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "read",
    });
    return AUTHORIZE_URL + "?" + params.toString();
}
/**
 * Exchange an authorization code for access + refresh tokens.
 */
async function exchangeCodeForTokens(code, redirectUri) {
    const { clientId, clientSecret } = getCredentials();
    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
        }),
    });
    const responseText = await response.text();
    if (!response.ok) {
        throw new Error("Token exchange failed (" + response.status + "): " + responseText.substring(0, 500));
    }
    return JSON.parse(responseText);
}
/**
 * Get a valid access token using the stored refresh_token.
 * Caches the access token and refreshes 5 min before expiry.
 */
async function getAccessToken() {
    // Return cached token if still valid
    if (cachedToken && Date.now() < cachedToken.expires_at - 300_000) {
        return cachedToken.access_token;
    }
    const refreshToken = process.env.TRIPLESEAT_REFRESH_TOKEN;
    if (!refreshToken) {
        throw new Error("Missing TRIPLESEAT_REFRESH_TOKEN. Visit /auth/login on the server to complete the one-time OAuth setup.");
    }
    const { clientId, clientSecret } = getCredentials();
    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
        }),
    });
    const responseText = await response.text();
    if (!response.ok) {
        throw new Error("TripleSeat token refresh failed (" + response.status + "): " + responseText.substring(0, 500));
    }
    if (responseText.trimStart().startsWith("<")) {
        throw new Error("TripleSeat returned HTML instead of JSON during token refresh (status " +
            response.status + ")");
    }
    let data;
    try {
        data = JSON.parse(responseText);
    }
    catch (e) {
        throw new Error("TripleSeat returned invalid JSON during token refresh: " +
            responseText.substring(0, 300));
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
function hasRefreshToken() {
    return !!process.env.TRIPLESEAT_REFRESH_TOKEN;
}
