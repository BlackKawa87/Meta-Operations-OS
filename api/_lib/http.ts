import type { VercelRequest, VercelResponse } from '@vercel/node';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function sendError(res: VercelResponse, err: unknown) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}

export function methodGuard(req: VercelRequest, res: VercelResponse, allowed: string[]): boolean {
  if (!req.method || !allowed.includes(req.method)) {
    res.setHeader('Allow', allowed.join(', '));
    res.status(405).json({ error: `Method ${req.method} not allowed` });
    return false;
  }
  return true;
}
