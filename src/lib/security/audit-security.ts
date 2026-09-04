import { TenantBoundaryViolationError } from './authorization';

/**
 * Tenant-scoped query & mutation safety helper.
 * Asserts that any tenant-owned mutation explicitly includes the target merchantId.
 */
export class TenantSecurityGuard {
  /**
   * Asserts that a where clause includes the authorized merchant ID.
   */
  static assertTenantScope<T extends { merchantId?: string }>(
    authorizedMerchantId: string,
    queryWhere: T
  ): T {
    if (!queryWhere.merchantId || queryWhere.merchantId !== authorizedMerchantId) {
      throw new TenantBoundaryViolationError(queryWhere.merchantId || 'missing');
    }
    return queryWhere;
  }

  /**
   * Guarantees an object is stamped with the authenticated tenant ID before insert/create.
   */
  static stampTenant<T extends Record<string, any>>(
    authorizedMerchantId: string,
    data: T
  ): T & { merchantId: string } {
    return {
      ...data,
      merchantId: authorizedMerchantId,
    };
  }
}
