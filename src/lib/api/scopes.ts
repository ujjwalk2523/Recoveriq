export enum ApiScope {
  TRANSACTIONS_READ = 'transactions:read',
  TRANSACTIONS_WRITE = 'transactions:write',
  RECOVERY_READ = 'recovery:read',
  RECOVERY_EXECUTE = 'recovery:execute',
  CUSTOMERS_READ = 'customers:read',
  INTELLIGENCE_READ = 'intelligence:read',
  ANALYTICS_READ = 'analytics:read',
  WEBHOOKS_READ = 'webhooks:read',
  DEVELOPER_READ = 'developer:read',
  DEVELOPER_WRITE = 'developer:write',
}

export const ALL_API_SCOPES: ApiScope[] = Object.values(ApiScope);

export class InsufficientScopeError extends Error {
  public readonly requiredScope: ApiScope;
  public readonly grantedScopes: string[];

  constructor(requiredScope: ApiScope, grantedScopes: string[] = []) {
    super(`The API key does not have the required scope '${requiredScope}'.`);
    this.name = 'InsufficientScopeError';
    this.requiredScope = requiredScope;
    this.grantedScopes = grantedScopes;
  }
}

/**
 * Checks if a set of granted scopes satisfies the required scope.
 */
export function hasScope(grantedScopes: string[] = [], requiredScope: ApiScope): boolean {
  if (!grantedScopes || !Array.isArray(grantedScopes)) return false;
  return grantedScopes.includes(requiredScope);
}

/**
 * Asserts that the granted scopes contain the required scope, throwing InsufficientScopeError otherwise.
 */
export function requireScope(grantedScopes: string[] = [], requiredScope: ApiScope): void {
  if (!hasScope(grantedScopes, requiredScope)) {
    throw new InsufficientScopeError(requiredScope, grantedScopes);
  }
}
