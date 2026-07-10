// Single Operator Mode: no session/JWT to attach — every request hits the
// API as-is and the server resolves DEFAULT_WORKSPACE_ID itself.
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(init?.headers ?? {}),
  };
  const res = await fetch(`/api${path}`, { ...init, headers });

  if (res.status === 204) return undefined as T;

  // `vite dev` alone doesn't run Vercel Functions — an unmatched /api/* path
  // falls back to index.html (200, text/html) instead of a JSON 404. Surface
  // that clearly instead of silently coercing to `{}` and letting callers
  // trip over a missing `data` field. Use `vercel dev`, or deploy, to
  // exercise /api/** routes for real.
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new ApiError(
      res.status,
      `Expected JSON from /api${path} but got "${contentType}". If you're running "npm run dev", API routes aren't served — use "vercel dev" instead.`,
    );
  }

  const body = await res.json();
  if (!res.ok) {
    throw new ApiError(res.status, body.error ?? `Request failed with ${res.status}`);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
