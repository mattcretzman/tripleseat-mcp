const TOKEN_URL = "https://api.tripleseat.com/oauth2/token";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  created_at: number;
}

interface CachedToken {
  access_token: string;
  expires_at: number;
}

let cachedToken: CachedToken | null = null;

function getCredentials() {
  const clientId = process.env.TRIPLESEAT_CLIENT_ID;
  const clientSecret = process.env.TRIPLESEAT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing TripleSeat API credentials. Set TRIPLESEAT_CLIENT_ID and TRIPLESEAT_CLIENT_SECRET environment variables.");
  }
  return { clientId, clientSecret };
}

export async function getAccessToken(): Promise<string> {
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
  const data: TokenResponse = await response.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.access_token;
}

export function clearTokenCache(): void {
  cachedToken = null;
}

export function hasCredentials(): boolean {
  return !!(process.env.TRIPLESEAT_CLIENT_ID && process.env.TRIPLESEAT_CLIENT_SECRET);
}
