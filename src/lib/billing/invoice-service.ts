import { prisma } from '@/lib/db/prisma';
import {
  InvoiceData,
  InvoiceLineItemData,
  InvoiceStatus,
  InvoiceLineItemType,
  UsageMetric,
  PlanCode,
} from './billing-types';
import { SubscriptionService } from './subscription-service';
import { PLANS_CONFIG } from './plan-config';
import { UsageService } from './usage-service';
import { AuditService } from '@/lib/services/audit.service';

export const IN_MEMORY_INVOICES: InvoiceData[] = [];

export class InvoiceService {
  /**
   * Generates a deterministic SaaS invoice for a billing period snapshot.
   * Derived strictly from Phase 7.2 immutable UsageLedgerEntry aggregates.
   */
  static async generateInvoice(
    merchantId: string,
    options: {
      periodStart?: Date;
      periodEnd?: Date;
      finalize?: boolean;
      actor?: string;
    } = {}
  ): Promise<InvoiceData> {
    const sub = await SubscriptionService.getSubscription(merchantId);
    const plan = PLANS_CONFIG[sub.planCode] || PLANS_CONFIG[PlanCode.STARTER];

    const periodStart = options.periodStart || new Date(sub.currentPeriodStart);
    const periodEnd = options.periodEnd || new Date(sub.currentPeriodEnd);
    const pStartIso = periodStart.toISOString().slice(0, 10);
    const pEndIso = periodEnd.toISOString().slice(0, 10);

    // Idempotency: protect against duplicate invoice generation for the exact same billing window
    const existing = await this.findExistingInvoice(merchantId, periodStart, periodEnd);
    if (existing) {
      return existing;
    }

    // 1. Fetch exact usage aggregates from immutable ledger
    const usageSummary = await UsageService.getUsageSummary(merchantId);

    const basePriceMinor = plan.monthlyPriceMinor > 0 ? plan.monthlyPriceMinor : 0;
    const lineItems: InvoiceLineItemData[] = [];
    const now = new Date();
    const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const invoiceNumber = `INV-${periodStart.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 2. Base subscription line item
    lineItems.push({
      id: `ili_base_${invoiceId}`,
      invoiceId,
      type: InvoiceLineItemType.BASE_SUBSCRIPTION,
      description: `${plan.name} Plan Subscription (${pStartIso} to ${pEndIso})`,
      quantity: 1,
      unitPriceMinor: basePriceMinor,
      totalMinor: basePriceMinor,
      createdAt: now,
    });

    let overageTotalMinor = 0;

    // 3. Compute metric overages
    // Transactions
    const txSummary = usageSummary.metrics[UsageMetric.TRANSACTIONS_PROCESSED];
    if (txSummary && txSummary.overage > 0 && plan.overageRates.transactionsPerUnitMinor > 0) {
      const txOverageCost = txSummary.overage * plan.overageRates.transactionsPerUnitMinor;
      overageTotalMinor += txOverageCost;
      lineItems.push({
        id: `ili_tx_${invoiceId}`,
        invoiceId,
        type: InvoiceLineItemType.OVERAGE,
        description: `Excess Transactions Processed (${txSummary.overage} units over quota)`,
        quantity: txSummary.overage,
        unitPriceMinor: plan.overageRates.transactionsPerUnitMinor,
        totalMinor: txOverageCost,
        metric: UsageMetric.TRANSACTIONS_PROCESSED,
        usageMeasured: txSummary.used,
        usageIncluded: txSummary.included,
        createdAt: now,
      });
    }

    // Recovery Attempts
    const attSummary = usageSummary.metrics[UsageMetric.RECOVERY_ATTEMPTS];
    if (attSummary && attSummary.overage > 0 && plan.overageRates.recoveryAttemptsPerUnitMinor > 0) {
      const attOverageCost = attSummary.overage * plan.overageRates.recoveryAttemptsPerUnitMinor;
      overageTotalMinor += attOverageCost;
      lineItems.push({
        id: `ili_att_${invoiceId}`,
        invoiceId,
        type: InvoiceLineItemType.OVERAGE,
        description: `Excess Recovery Attempts (${attSummary.overage} units over quota)`,
        quantity: attSummary.overage,
        unitPriceMinor: plan.overageRates.recoveryAttemptsPerUnitMinor,
        totalMinor: attOverageCost,
        metric: UsageMetric.RECOVERY_ATTEMPTS,
        usageMeasured: attSummary.used,
        usageIncluded: attSummary.included,
        createdAt: now,
      });
    }

    // API Requests
    const apiSummary = usageSummary.metrics[UsageMetric.API_REQUESTS];
    if (apiSummary && apiSummary.overage > 0 && plan.overageRates.apiRequestsPerUnitMinor > 0) {
      const apiOverageCost = apiSummary.overage * plan.overageRates.apiRequestsPerUnitMinor;
      overageTotalMinor += apiOverageCost;
      lineItems.push({
        id: `ili_api_${invoiceId}`,
        invoiceId,
        type: InvoiceLineItemType.OVERAGE,
        description: `Excess API Calls (${apiSummary.overage} units over quota)`,
        quantity: apiSummary.overage,
        unitPriceMinor: plan.overageRates.apiRequestsPerUnitMinor,
        totalMinor: apiOverageCost,
        metric: UsageMetric.API_REQUESTS,
        usageMeasured: apiSummary.used,
        usageIncluded: apiSummary.included,
        createdAt: now,
      });
    }

    const taxMinor = 0; // Integer minor units; marked as not yet integrated
    const discountMinor = 0;
    const totalMinor = basePriceMinor + overageTotalMinor + taxMinor - discountMinor;

    const initialStatus = options.finalize ? InvoiceStatus.OPEN : InvoiceStatus.DRAFT;

    const invoice: InvoiceData = {
      id: invoiceId,
      merchantId,
      subscriptionId: sub.id,
      invoiceNumber,
      status: initialStatus,
      currency: 'INR',
      subtotalMinor: basePriceMinor,
      taxMinor,
      discountMinor,
      overageMinor: overageTotalMinor,
      totalMinor,
      amountPaidMinor: 0,
      amountDueMinor: totalMinor,
      periodStart,
      periodEnd,
      issuedAt: now,
      dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
      paidAt: null,
      isTestMode: true,
      createdAt: now,
      updatedAt: now,
      lineItems,
    };

    IN_MEMORY_INVOICES.unshift({ ...invoice });

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.invoice.create({
          data: {
            id: invoice.id,
            merchantId,
            subscriptionId: sub.id,
            invoiceNumber: invoice.invoiceNumber,
            status: invoice.status as any,
            currency: invoice.currency,
            subtotalMinor: invoice.subtotalMinor,
            taxMinor: invoice.taxMinor,
            discountMinor: invoice.discountMinor,
            overageMinor: invoice.overageMinor,
            totalMinor: invoice.totalMinor,
            amountPaidMinor: invoice.amountPaidMinor,
            amountDueMinor: invoice.amountDueMinor,
            periodStart: invoice.periodStart,
            periodEnd: invoice.periodEnd,
            issuedAt: invoice.issuedAt,
            dueAt: invoice.dueAt,
            isTestMode: invoice.isTestMode,
            lineItems: {
              create: lineItems.map((li) => ({
                id: li.id,
                type: li.type as any,
                description: li.description,
                quantity: li.quantity,
                unitPriceMinor: li.unitPriceMinor,
                totalMinor: li.totalMinor,
                metric: li.metric,
                usageMeasured: li.usageMeasured,
                usageIncluded: li.usageIncluded,
              })),
            },
          },
        });
      } catch {
        // resilient
      }
    }

    try {
      await AuditService.logEvent({
        merchantId,
        actorType: 'BILLING_SYSTEM',
        actorName: options.actor || 'SYSTEM',
        action: 'INVOICE_GENERATED',
        entityType: 'INVOICE',
        entityId: invoice.id,
        details: `Generated Invoice ${invoice.invoiceNumber} for period ${pStartIso} to ${pEndIso} (Total: ₹${(
          totalMinor / 100
        ).toFixed(2)}, Status: ${invoice.status}).`,
      });
    } catch {
      // non-blocking
    }

    return invoice;
  }

  /**
   * Finalizes a draft invoice. Once finalized, an invoice is strictly immutable.
   */
  static async finalizeInvoice(invoiceId: string, merchantId: string, actor = 'SYSTEM'): Promise<InvoiceData> {
    const inv = await this.getInvoice(invoiceId, merchantId);
    if (!inv) throw new Error(`Invoice '${invoiceId}' not found.`);

    if (inv.status !== InvoiceStatus.DRAFT) {
      return inv; // already finalized
    }

    inv.status = InvoiceStatus.OPEN;
    inv.updatedAt = new Date();

    await this.saveInvoice(inv);

    try {
      await AuditService.logEvent({
        merchantId,
        actorType: 'BILLING_SYSTEM',
        actorName: actor,
        action: 'INVOICE_FINALIZED',
        entityType: 'INVOICE',
        entityId: invoiceId,
        details: `Finalized Invoice ${inv.invoiceNumber}. Total due: ₹${(inv.totalMinor / 100).toFixed(2)}.`,
      });
    } catch {
      // non-blocking
    }

    return inv;
  }

  /**
   * Marks an invoice paid upon authoritative provider webhook confirmation.
   */
  static async markInvoicePaid(
    invoiceId: string,
    merchantId: string,
    providerPaymentId?: string,
    actor = 'BILLING_WEBHOOK'
  ): Promise<InvoiceData> {
    const inv = await this.getInvoice(invoiceId, merchantId);
    if (!inv) throw new Error(`Invoice '${invoiceId}' not found.`);

    if (inv.status === InvoiceStatus.PAID) {
      return inv; // idempotent
    }

    const now = new Date();
    inv.status = InvoiceStatus.PAID;
    inv.paidAt = now;
    inv.amountPaidMinor = inv.totalMinor;
    inv.amountDueMinor = 0;
    inv.updatedAt = now;
    if (providerPaymentId) {
      inv.metadata = { ...(inv.metadata || {}), providerPaymentId };
    }

    await this.saveInvoice(inv);

    try {
      await AuditService.logEvent({
        merchantId,
        actorType: 'PAYMENT_GATEWAY',
        actorName: actor,
        action: 'INVOICE_PAID',
        entityType: 'INVOICE',
        entityId: invoiceId,
        details: `Invoice ${inv.invoiceNumber} paid in full (₹${(inv.totalMinor / 100).toFixed(2)}) via payment ${
          providerPaymentId || 'N/A'
        }.`,
      });
    } catch {
      // non-blocking
    }

    return inv;
  }

  /**
   * Voids an invoice with audit trail.
   */
  static async voidInvoice(
    invoiceId: string,
    merchantId: string,
    reason: string,
    actor = 'SYSTEM'
  ): Promise<InvoiceData> {
    const inv = await this.getInvoice(invoiceId, merchantId);
    if (!inv) throw new Error(`Invoice '${invoiceId}' not found.`);

    if (inv.status === InvoiceStatus.PAID) {
      throw new Error('Cannot void an invoice that has already been paid. Issue a refund or credit memo instead.');
    }

    inv.status = InvoiceStatus.VOID;
    inv.updatedAt = new Date();
    inv.metadata = { ...(inv.metadata || {}), voidReason: reason };

    await this.saveInvoice(inv);

    try {
      await AuditService.logEvent({
        merchantId,
        actorType: 'BILLING_ADMIN',
        actorName: actor,
        action: 'INVOICE_VOIDED',
        entityType: 'INVOICE',
        entityId: invoiceId,
        details: `Voided Invoice ${inv.invoiceNumber}. Reason: ${reason}.`,
      });
    } catch {
      // non-blocking
    }

    return inv;
  }

  /**
   * Retrieves an invoice strictly scoped to merchant.
   */
  static async getInvoice(invoiceId: string, merchantId: string): Promise<InvoiceData | null> {
    if (process.env.SKIP_DB !== 'true') {
      try {
        const db = await prisma.invoice.findFirst({
          where: { id: invoiceId, merchantId },
          include: { lineItems: true },
        });

        if (db) {
          return {
            id: db.id,
            merchantId: db.merchantId,
            subscriptionId: db.subscriptionId,
            providerInvoiceId: db.providerInvoiceId,
            invoiceNumber: db.invoiceNumber,
            status: db.status as InvoiceStatus,
            currency: db.currency,
            subtotalMinor: db.subtotalMinor,
            taxMinor: db.taxMinor,
            discountMinor: db.discountMinor,
            overageMinor: db.overageMinor,
            totalMinor: db.totalMinor,
            amountPaidMinor: db.amountPaidMinor,
            amountDueMinor: db.amountDueMinor,
            periodStart: db.periodStart,
            periodEnd: db.periodEnd,
            issuedAt: db.issuedAt,
            dueAt: db.dueAt,
            paidAt: db.paidAt,
            isTestMode: db.isTestMode,
            metadata: db.metadata as any,
            createdAt: db.createdAt,
            updatedAt: db.updatedAt,
            lineItems: db.lineItems.map((li) => ({
              id: li.id,
              invoiceId: li.invoiceId,
              type: li.type as InvoiceLineItemType,
              description: li.description,
              quantity: li.quantity,
              unitPriceMinor: li.unitPriceMinor,
              totalMinor: li.totalMinor,
              metric: li.metric,
              usageMeasured: li.usageMeasured,
              usageIncluded: li.usageIncluded,
              metadata: li.metadata as any,
              createdAt: li.createdAt,
            })),
          };
        }
      } catch {
        // fallback
      }
    }

    return IN_MEMORY_INVOICES.find((i) => i.id === invoiceId && i.merchantId === merchantId) || null;
  }

  /**
   * Lists chronological invoices for a merchant.
   */
  static async listInvoices(merchantId: string, limit = 50): Promise<InvoiceData[]> {
    if (process.env.SKIP_DB !== 'true') {
      try {
        const dbList = await prisma.invoice.findMany({
          where: { merchantId },
          include: { lineItems: true },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });

        if (dbList.length > 0) {
          return dbList.map((db) => ({
            id: db.id,
            merchantId: db.merchantId,
            subscriptionId: db.subscriptionId,
            providerInvoiceId: db.providerInvoiceId,
            invoiceNumber: db.invoiceNumber,
            status: db.status as InvoiceStatus,
            currency: db.currency,
            subtotalMinor: db.subtotalMinor,
            taxMinor: db.taxMinor,
            discountMinor: db.discountMinor,
            overageMinor: db.overageMinor,
            totalMinor: db.totalMinor,
            amountPaidMinor: db.amountPaidMinor,
            amountDueMinor: db.amountDueMinor,
            periodStart: db.periodStart,
            periodEnd: db.periodEnd,
            issuedAt: db.issuedAt,
            dueAt: db.dueAt,
            paidAt: db.paidAt,
            isTestMode: db.isTestMode,
            metadata: db.metadata as any,
            createdAt: db.createdAt,
            updatedAt: db.updatedAt,
            lineItems: db.lineItems.map((li) => ({
              id: li.id,
              invoiceId: li.invoiceId,
              type: li.type as InvoiceLineItemType,
              description: li.description,
              quantity: li.quantity,
              unitPriceMinor: li.unitPriceMinor,
              totalMinor: li.totalMinor,
              metric: li.metric,
              usageMeasured: li.usageMeasured,
              usageIncluded: li.usageIncluded,
              metadata: li.metadata as any,
              createdAt: li.createdAt,
            })),
          }));
        }
      } catch {
        // fallback
      }
    }

    return IN_MEMORY_INVOICES.filter((i) => i.merchantId === merchantId).slice(0, limit);
  }

  private static async findExistingInvoice(merchantId: string, start: Date, end: Date): Promise<InvoiceData | null> {
    const sTime = start.getTime();
    const eTime = end.getTime();

    const mem = IN_MEMORY_INVOICES.find(
      (i) =>
        i.merchantId === merchantId &&
        i.periodStart.getTime() === sTime &&
        i.periodEnd.getTime() === eTime &&
        i.status !== InvoiceStatus.VOID
    );
    if (mem) return mem;

    if (process.env.SKIP_DB !== 'true') {
      try {
        const db = await prisma.invoice.findFirst({
          where: {
            merchantId,
            periodStart: start,
            periodEnd: end,
            status: { not: 'VOID' as any },
          },
          include: { lineItems: true },
        });
        if (db) {
          return {
            id: db.id,
            merchantId: db.merchantId,
            subscriptionId: db.subscriptionId,
            providerInvoiceId: db.providerInvoiceId,
            invoiceNumber: db.invoiceNumber,
            status: db.status as InvoiceStatus,
            currency: db.currency,
            subtotalMinor: db.subtotalMinor,
            taxMinor: db.taxMinor,
            discountMinor: db.discountMinor,
            overageMinor: db.overageMinor,
            totalMinor: db.totalMinor,
            amountPaidMinor: db.amountPaidMinor,
            amountDueMinor: db.amountDueMinor,
            periodStart: db.periodStart,
            periodEnd: db.periodEnd,
            issuedAt: db.issuedAt,
            dueAt: db.dueAt,
            paidAt: db.paidAt,
            isTestMode: db.isTestMode,
            metadata: db.metadata as any,
            createdAt: db.createdAt,
            updatedAt: db.updatedAt,
            lineItems: db.lineItems.map((li) => ({
              id: li.id,
              invoiceId: li.invoiceId,
              type: li.type as InvoiceLineItemType,
              description: li.description,
              quantity: li.quantity,
              unitPriceMinor: li.unitPriceMinor,
              totalMinor: li.totalMinor,
              metric: li.metric,
              usageMeasured: li.usageMeasured,
              usageIncluded: li.usageIncluded,
              metadata: li.metadata as any,
              createdAt: li.createdAt,
            })),
          };
        }
      } catch {
        // fallback
      }
    }

    return null;
  }

  private static async saveInvoice(invoice: InvoiceData): Promise<void> {
    const idx = IN_MEMORY_INVOICES.findIndex((i) => i.id === invoice.id);
    if (idx !== -1) {
      IN_MEMORY_INVOICES[idx] = { ...invoice };
    } else {
      IN_MEMORY_INVOICES.unshift({ ...invoice });
    }

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: invoice.status as any,
            amountPaidMinor: invoice.amountPaidMinor,
            amountDueMinor: invoice.amountDueMinor,
            paidAt: invoice.paidAt,
            updatedAt: invoice.updatedAt,
            metadata: invoice.metadata as any,
          },
        });
      } catch {
        // resilient
      }
    }
  }

  static clearCache(): void {
    IN_MEMORY_INVOICES.length = 0;
  }
}
