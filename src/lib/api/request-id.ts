import { NextRequest } from 'next/server';
import crypto from 'crypto';

export function resolveRequestId(req?: NextRequest | Headers): string {
  let incoming: string | null = null;

  if (req instanceof NextRequest) {
    incoming = req.headers.get('x-request-id');
  } else if (req) {
    incoming = req.get('x-request-id');
  }

  if (incoming && /^[a-zA-Z0-9_-]{8,64}$/.test(incoming)) {
    return incoming;
  }

  return `req_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}
