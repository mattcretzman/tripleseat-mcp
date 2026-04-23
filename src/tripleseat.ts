/**
 * TripleSeat API Client
 * 
 * Wraps all REST calls with auth, error handling, retry on 401,
 * and pagination support. Every tool calls through this.
 */

import { getAccessToken, clearTokenCache } from "./auth.js";

const BASE_URL = "https://api.tripleseat.com/v1";

export interface ApiResponse<T = any> {
  data: T;
  status: number;
}

export interface PaginatedResponse<T = any> {
  results: T[];
  total_count?: number;
  page?: number;
}

/**
 * Make an authenticated request to the TripleSeat API.
 * Automatically retries once on 401 (expired token).
 */
export async function tripleseatRequest<T = any>(
  endpoint: string,
  options: {
    method?: string;
    params?: Record<string, string>;
    body?: Record<string, any>;
    format?: "json" | "xml";
  } = {}
): Promise<ApiResponse<T>> {
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

  const makeRequest = async (token: string): Promise<Response> => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const fetchOptions: RequestInit = { method, headers };
    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      fetchOptions.body = JSON.stringify(body);
    }

    return fetch(url.toString(), fetchOptions);
  };

  // First attempt
  let token = await getAccessToken();
  let response = await makeRequest(token);

  // Retry once on 401 (token may have expired)
  if (response.status === 401) {
    clearTokenCache();
    token = await getAccessToken();
    response = await makeRequest(token);
  }

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `TripleSeat API error (${response.status} ${response.statusText}): ${responseText.substring(0, 500)}`
    );
  }

  // Guard against HTML responses (redirects, error pages)
  if (responseText.trimStart().startsWith("<")) {
    throw new Error(
      `TripleSeat returned HTML instead of JSON for ${url.pathname} (status ${response.status}). First 300 chars: ${responseText.substring(0, 300)}`
    );
  }

  const data = JSON.parse(responseText);
  return { data: data as T, status: response.status };
}

/**
 * GET with automatic pagination.
 * TripleSeat returns paginated results — this fetches a specific page.
 */
export async function tripleseatGet<T = any>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<ApiResponse<T>> {
  return tripleseatRequest<T>(endpoint, { method: "GET", params });
}

/**
 * POST to create a new record
 */
export async function tripleseatPost<T = any>(
  endpoint: string,
  body: Record<string, any>,
  params: Record<string, string> = {}
): Promise<ApiResponse<T>> {
  return tripleseatRequest<T>(endpoint, { method: "POST", body, params });
}

/**
 * POST to create a lead via the Lead Form API.
 * TripleSeat lead creation uses a public_key instead of OAuth bearer auth.
 */
export async function tripleseatPostLead<T = any>(
  body: Record<string, any>
): Promise<ApiResponse<T>> {
  const publicKey = process.env.TRIPLESEAT_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error(
      "Missing TRIPLESEAT_PUBLIC_KEY environment variable. " +
      "Find it in TripleSeat under Settings > Lead Forms > Setup Codes."
    );
  }
  return tripleseatRequest<T>("/leads/create", {
    method: "POST",
    body,
    params: { public_key: publicKey },
  });
}

/**
 * PUT to update an existing record
 */
export async function tripleseatPut<T = any>(
  endpoint: string,
  body: Record<string, any>
): Promise<ApiResponse<T>> {
  return tripleseatRequest<T>(endpoint, { method: "PUT", body });
}

/**
 * DELETE a record
 */
export async function tripleseatDelete<T = any>(
  endpoint: string
): Promise<ApiResponse<T>> {
  return tripleseatRequest<T>(endpoint, { method: "DELETE" });
}

/**
 * Helper to format dates for TripleSeat API queries
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}
