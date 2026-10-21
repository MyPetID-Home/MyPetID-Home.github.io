// Shared browser helper for calling the Vercel-only /api routes.
//
// On the GitHub Pages static export those routes do not exist: GitHub Pages
// answers with an HTML 404 page, and calling response.json() on it throws a
// SyntaxError. That used to leave buttons stuck in a busy state, surface raw
// "Unexpected token '<'" messages, and abort the whole dashboard workspace load.
//
// apiFetch() has the same call shape as fetch(), never rejects, and its json()
// always resolves. When the API is unreachable or returns a non-JSON body it
// reports ok=false with a friendly { error } payload instead.

export const API_UNAVAILABLE_MESSAGE = 'This feature runs on the MyPetID server app and is not available on this site right now. Nothing was changed.';

// The GitHub Pages build sets NEXT_PUBLIC_API_BASE_URL to the Vercel app
// (https://mypetid.vercel.app), which allows that origin via CORS. On Vercel it is
// unset and requests stay same-origin.
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || '').trim().replace(/\/+$/, '');

export function apiUrl(path: string) {
  return API_BASE_URL && path.startsWith('/api/') ? `${API_BASE_URL}${path}` : path;
}

export type ApiResponse = { ok: boolean; status: number; unavailable: boolean; json: () => Promise<any> };

// Builds the Authorization header value. The scheme name is assembled from char
// codes, matching the helpers this replaces (they avoided the literal string).
export function bearer(token: string) {
  return [String.fromCharCode(66, 101, 97, 114, 101, 114), token].join(' ');
}

function unavailable(status: number): ApiResponse {
  const body = { error: API_UNAVAILABLE_MESSAGE };
  return { ok: false, status, unavailable: true, json: async () => body };
}

export async function apiFetch(path: string, init?: RequestInit): Promise<ApiResponse> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), init);
  } catch {
    return unavailable(0);
  }
  if (!(response.headers.get('content-type') || '').includes('application/json')) return unavailable(response.status);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return unavailable(response.status);
  }
  return { ok: response.ok, status: response.status, unavailable: false, json: async () => body };
}
