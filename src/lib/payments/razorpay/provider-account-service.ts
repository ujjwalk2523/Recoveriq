import { PaymentProviderAccount, PaymentProviderAccountStatus, RazorpayCredentials, RazorpayEnvironment } from './types';
import { SecretStore } from './secret-store';
import { getRazorpayConfig } from './config';

export class PaymentProviderAccountService {
  private static inMemoryAccounts = new Map<string, PaymentProviderAccount>();

  private static getAccountKey(merchantId: string, environment: RazorpayEnvironment): string {
    return `${merchantId}:${environment}`;
  }

  /**
   * Registers or updates a merchant's Razorpay credentials securely.
   * Credentials are encrypted using authenticated AES-256-GCM before storage.
   */
  static async registerAccount(params: {
    merchantId: string;
    environment: RazorpayEnvironment;
    credentials: RazorpayCredentials;
    accountName?: string;
  }): Promise<PaymentProviderAccount> {
    const { merchantId, environment, credentials, accountName } = params;
    const credRef = `sec_ref_rzp_${merchantId}_${environment}_${Date.now()}`;

    // Store encrypted credentials in SecretStore
    await SecretStore.setSecret(credRef, JSON.stringify(credentials));

    const account: PaymentProviderAccount = {
      id: `ppa_${merchantId}_${environment}`,
      merchantId,
      provider: 'RAZORPAY',
      environment,
      status: 'ACTIVE',
      credentialsRef: credRef,
      accountName: accountName || `${merchantId} Razorpay (${environment})`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.inMemoryAccounts.set(this.getAccountKey(merchantId, environment), account);
    return account;
  }

  /**
   * Retrieves a merchant's PaymentProviderAccount.
   * Returns default platform fallback credentials if merchant has not connected a custom account.
   */
  static async getAccount(
    merchantId: string,
    environment: RazorpayEnvironment
  ): Promise<PaymentProviderAccount | null> {
    const account = this.inMemoryAccounts.get(this.getAccountKey(merchantId, environment));
    if (account) return account;

    // Platform default account fallback
    const systemConfig = getRazorpayConfig();
    const systemCreds = systemConfig.merchantCredentials;

    const defaultRef = `sec_ref_system_default_${environment}`;
    await SecretStore.setSecret(defaultRef, JSON.stringify(systemCreds));

    return {
      id: `ppa_${merchantId}_default_${environment}`,
      merchantId,
      provider: 'RAZORPAY',
      environment,
      status: 'ACTIVE',
      credentialsRef: defaultRef,
      accountName: `Platform Default (${environment})`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Resolves decrypted Razorpay credentials for a merchant account.
   * Server-only; credentials must never be returned to client components.
   */
  static async resolveCredentials(
    merchantId: string,
    environment: RazorpayEnvironment
  ): Promise<RazorpayCredentials> {
    const account = await this.getAccount(merchantId, environment);
    if (!account) {
      throw new Error(`[ProviderAccountError] No Razorpay provider account found for merchant ${merchantId} in ${environment}.`);
    }

    if (account.status !== 'ACTIVE') {
      throw new Error(`[ProviderAccountError] Provider account for merchant ${merchantId} is ${account.status}.`);
    }

    const raw = await SecretStore.getSecret(account.credentialsRef);
    if (!raw) {
      throw new Error(`[ProviderAccountError] Failed to resolve encrypted credentials for reference ${account.credentialsRef}.`);
    }

    return JSON.parse(raw);
  }

  /**
   * Rotates credentials for a merchant provider account without changing business identifiers.
   */
  static async rotateCredentials(
    merchantId: string,
    environment: RazorpayEnvironment,
    newCredentials: RazorpayCredentials
  ): Promise<PaymentProviderAccount> {
    const account = await this.getAccount(merchantId, environment);
    if (!account) {
      throw new Error(`[ProviderAccountError] Account not found for rotation.`);
    }

    await SecretStore.rotateSecret(account.credentialsRef, JSON.stringify(newCredentials));
    account.updatedAt = new Date().toISOString();
    this.inMemoryAccounts.set(this.getAccountKey(merchantId, environment), account);
    return account;
  }

  /**
   * Updates provider account status (e.g. SUSPENDED, DISCONNECTED)
   */
  static async updateAccountStatus(
    merchantId: string,
    environment: RazorpayEnvironment,
    status: PaymentProviderAccountStatus
  ): Promise<PaymentProviderAccount> {
    const account = await this.getAccount(merchantId, environment);
    if (!account) {
      throw new Error(`[ProviderAccountError] Account not found.`);
    }

    account.status = status;
    account.updatedAt = new Date().toISOString();
    this.inMemoryAccounts.set(this.getAccountKey(merchantId, environment), account);
    return account;
  }

  /**
   * Clears in-memory accounts (for testing).
   */
  static clearForTesting() {
    this.inMemoryAccounts.clear();
  }
}
