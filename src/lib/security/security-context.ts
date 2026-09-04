import { NextRequest } from 'next/server';
import { UserRole } from '@/lib/auth/session';
import { getSessionFromRequest } from '@/lib/auth/session';
import { resolveRequestId } from '@/lib/observability/request-context';
import { getRuntimeEnvironment } from '@/lib/config/environment';
import { ApiKeyService } from '@/lib/api/auth/api-key-service';

export type PrincipalType =
  | 'USER_SESSION'
  | 'API_KEY'
  | 'INTERNAL_WORKER'
  | 'WEBHOOK_PROVIDER'
  | 'SYSTEM';

export type AuthenticationMethod =
  | 'COOKIE'
  | 'BEARER_TOKEN'
  | 'API_KEY'
  | 'HMAC'
  | 'INTERNAL'
  | 'NONE';

export interface SecurityContext {
  principal: string;
  principalType: PrincipalType;
  userId?: string;
  merchantId?: string;
  organizationId?: string;
  roles: UserRole[];
  scopes: string[];
  environment: string;
  requestId: string;
  authenticationMethod: AuthenticationMethod;
  isCsrfRequired: boolean;
  createdAt: Date;
}

/**
 * Resolves a strongly typed SecurityContext from an incoming Next.js HTTP request.
 * Discovers principal identity from:
 * 1. API Key header (`Authorization: Bearer rk_...` or `x-api-key: rk_...`)
 * 2. Razorpay Webhook header (`x-razorpay-signature`)
 * 3. Browser session cookie (`rcvq_session`)
 * 4. Internal worker / fallback
 */
export async function resolveSecurityContext(req: NextRequest): Promise<SecurityContext> {
  const requestId = resolveRequestId(req.headers.get('x-request-id'));
  const environment = getRuntimeEnvironment();
  const method = req.method.toUpperCase();
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  // 1. API Key Authentication
  const authHeader = req.headers.get('authorization') || '';
  const apiKeyHeader = req.headers.get('x-api-key') || '';
  const rawApiKey = apiKeyHeader || (authHeader.startsWith('Bearer rk_') ? authHeader.slice(7) : '');

  if (rawApiKey && rawApiKey.startsWith('rk_')) {
    const verifiedKey = await ApiKeyService.verifyKey(rawApiKey);
    if (verifiedKey) {
      return {
        principal: verifiedKey.id,
        principalType: 'API_KEY',
        merchantId: verifiedKey.merchantId,
        organizationId: verifiedKey.merchantId,
        roles: [],
        scopes: verifiedKey.scopes,
        environment: verifiedKey.environment,
        requestId,
        authenticationMethod: 'API_KEY',
        isCsrfRequired: false, // API keys are not subject to browser CSRF
        createdAt: new Date(),
      };
    }
  }

  // 2. Razorpay Webhook Authentication (delegated to HMAC verifier)
  const webhookSignature = req.headers.get('x-razorpay-signature');
  const path = req.nextUrl.pathname;
  if (webhookSignature && path.startsWith('/api/webhooks/')) {
    return {
      principal: 'provider:razorpay',
      principalType: 'WEBHOOK_PROVIDER',
      roles: [],
      scopes: ['webhooks:receive'],
      environment,
      requestId,
      authenticationMethod: 'HMAC',
      isCsrfRequired: false, // External server-to-server webhooks do not use browser CSRF
      createdAt: new Date(),
    };
  }

  // 3. Browser User Session
  const session = await getSessionFromRequest(req);
  if (session) {
    return {
      principal: session.userId,
      principalType: 'USER_SESSION',
      userId: session.userId,
      merchantId: session.merchantId,
      organizationId: session.organizationId || session.merchantId,
      roles: [session.role],
      scopes: ['*'], // Interactive UI user has roles rather than granular API scopes
      environment,
      requestId,
      authenticationMethod: 'COOKIE',
      isCsrfRequired: isStateChanging, // Browser sessions modifying state require CSRF
      createdAt: new Date(),
    };
  }

  // 4. Unauthenticated / Anonymous Context
  return {
    principal: 'anonymous',
    principalType: 'SYSTEM',
    roles: [],
    scopes: [],
    environment,
    requestId,
    authenticationMethod: 'NONE',
    isCsrfRequired: false,
    createdAt: new Date(),
  };
}

/**
 * Creates an internal worker security context for background processing.
 */
export function createWorkerSecurityContext(params: {
  workerId: string;
  merchantId?: string;
  requestId?: string;
}): SecurityContext {
  return {
    principal: `worker:${params.workerId}`,
    principalType: 'INTERNAL_WORKER',
    merchantId: params.merchantId,
    roles: ['ADMIN'],
    scopes: ['recovery:execute', 'recovery:read', 'transactions:read'],
    environment: getRuntimeEnvironment(),
    requestId: params.requestId || `req_worker_${Date.now()}`,
    authenticationMethod: 'INTERNAL',
    isCsrfRequired: false,
    createdAt: new Date(),
  };
}
