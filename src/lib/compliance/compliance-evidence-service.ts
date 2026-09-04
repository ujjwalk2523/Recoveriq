/**
 * Phase 8.7.3 — Enterprise Compliance Evidence Service
 *
 * Generates reproducible, integrity-verifiable evidence packages derived from
 * authoritative RecoverIQ records (AuditLog, Organization, ApiKey, Subscriptions,
 * UsageLedger, and RecoveryAttempts).
 *
 * INVARIANTS:
 * 1. Evidence packages strictly reference authoritative source records.
 * 2. Deep recursive secret redaction via AuditRedactor.
 * 3. Deterministic SHA-256 item and package manifest hashing.
 * 4. Audit hash chain verification required for audit-derived evidence.
 * 5. Multi-tenant boundary enforced: zero cross-tenant evidence generation or retrieval.
 * 6. Evidence generation does NOT constitute external certification.
 */

import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { AuditRepository, IN_MEMORY_AUDIT_LEDGER } from '../audit/audit-repository';
import { AuditCanonicalizer } from '../audit/audit-canonicalizer';
import { AuditRedactor } from '../audit/audit-redactor';
import {
  COMPLIANCE_CONTROLS,
  ComplianceControlDefinition,
  ComplianceEvidenceItem,
  ComplianceEvidencePackage,
  GenerateEvidenceParams,
  EvidenceVerificationResult,
  EvidenceExportPayload,
  EvidenceStatus,
  AuditChainStatus,
} from './compliance-types';

export class ComplianceEvidenceService {
  private static readonly GENERATOR_VERSION = 'RecoverIQ-Evidence-v1.0';
  private static readonly SCHEMA_VERSION = 1;
  private static readonly MAX_PERIOD_DAYS = 180;

  // In-memory fallback stores for non-DB / testing environments
  private static memoryPackages = new Map<string, ComplianceEvidencePackage>();
  private static memoryItems = new Map<string, ComplianceEvidenceItem[]>();

  /**
   * Helper to retrieve scoped audit events within date range (from DB or memory fallback).
   */
  private static async getScopedAuditEvents(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    if (process.env.SKIP_DB !== 'true') {
      try {
        const rows = await prisma.auditLog.findMany({
          where: {
            organizationId,
            occurredAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          orderBy: { sequenceNumber: 'asc' },
          take: 100000,
        });

        if (rows.length > 0) {
          return rows.map(r => ({
            id: r.id,
            organizationId: r.organizationId,
            merchantId: r.merchantId,
            actor: {
              type: r.actorType,
              id: r.actorId,
              displayName: r.actorDisplayName || r.actorName,
              email: r.actorEmail,
            },
            action: r.action,
            category: r.category || 'SYSTEM',
            severity: r.severity || 'INFO',
            result: r.result || 'SUCCESS',
            resource: {
              type: r.resourceType || r.entityType,
              id: r.resourceId || r.entityId,
            },
            requestId: r.requestId,
            sessionId: r.sessionId,
            ipHash: r.ipHash,
            userAgentSummary: r.userAgentSummary,
            metadata: r.metadata ? JSON.parse(r.metadata) : null,
            previousState: r.previousState ? JSON.parse(r.previousState) : null,
            newState: r.newState ? JSON.parse(r.newState) : null,
            integrity: {
              sequenceNumber: r.sequenceNumber ?? 0,
              eventHash: r.eventHash || r.integrityHash || '',
              previousEventHash: r.previousEventHash,
              schemaVersion: r.schemaVersion ?? 1,
            },
            occurredAt: (r.occurredAt || r.timestamp).toISOString(),
            createdAt: (r.createdAt || r.timestamp).toISOString(),
          }));
        }
      } catch {
        // Fall back to memory
      }
    }

    return IN_MEMORY_AUDIT_LEDGER.filter(e => {
      if (e.organizationId !== organizationId) return false;
      const t = new Date(e.occurredAt).getTime();
      return t >= startDate.getTime() && t <= endDate.getTime();
    });
  }

  /**
   * Reset in-memory storage for automated tests.
   */
  static clearMemoryForTesting(): void {
    this.memoryPackages.clear();
    this.memoryItems.clear();
  }

  /**
   * Manually insert a package into memory for testing edge cases / tampering.
   */
  static injectMemoryPackageForTesting(
    pkg: ComplianceEvidencePackage,
    items: ComplianceEvidenceItem[]
  ): void {
    this.memoryPackages.set(pkg.id, pkg);
    this.memoryItems.set(pkg.id, items);
  }

  /**
   * Validates organization scope and date period bounds.
   */
  private static validateScopeAndPeriod(params: {
    organizationId: string;
    periodStart: string;
    periodEnd: string;
  }): { start: Date; end: Date } {
    if (!params.organizationId || typeof params.organizationId !== 'string') {
      throw new Error('Invalid organizationId: must be a non-empty string');
    }

    const start = new Date(params.periodStart);
    const end = new Date(params.periodEnd);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format: periodStart and periodEnd must be valid ISO 8601 strings');
    }

    if (start.getTime() >= end.getTime()) {
      throw new Error('Invalid period: periodStart must be strictly before periodEnd');
    }

    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > this.MAX_PERIOD_DAYS) {
      throw new Error(`Period exceeds maximum limit of ${this.MAX_PERIOD_DAYS} days (requested: ${Math.round(diffDays)} days)`);
    }

    return { start, end };
  }

  /**
   * Computes deterministic SHA-256 hash for an individual evidence item.
   */
  static computeItemHash(item: {
    evidenceType: string;
    sourceType: string;
    sourceId: string;
    occurredAt: string;
    metadata: Record<string, any>;
  }): string {
    const canonical = AuditCanonicalizer.canonicalize({
      evidenceType: item.evidenceType,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      occurredAt: item.occurredAt,
      metadata: item.metadata,
    });
    return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  }

  /**
   * Computes deterministic SHA-256 hash for the composite package manifest.
   */
  static computePackageHash(pkg: {
    organizationId: string;
    controlId: string;
    packageType: string;
    periodStart: string;
    periodEnd: string;
    auditChainStatus: string;
    manifest: any;
  }): string {
    const canonical = AuditCanonicalizer.canonicalize({
      organizationId: pkg.organizationId,
      controlId: pkg.controlId,
      packageType: pkg.packageType,
      periodStart: pkg.periodStart,
      periodEnd: pkg.periodEnd,
      auditChainStatus: pkg.auditChainStatus,
      manifest: pkg.manifest,
    });
    return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  }

  /**
   * Generates a reproducible, integrity-verifiable compliance evidence package.
   */
  static async generateEvidencePackage(
    params: GenerateEvidenceParams
  ): Promise<ComplianceEvidencePackage> {
    const { start, end } = this.validateScopeAndPeriod({
      organizationId: params.organizationId,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
    });

    const control = COMPLIANCE_CONTROLS[params.controlId];
    if (!control) {
      throw new Error(`Unknown compliance control: ${params.controlId}`);
    }

    const packageId = `evpkg_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const generatedAt = new Date().toISOString();
    const periodStartIso = start.toISOString();
    const periodEndIso = end.toISOString();

    // 1. Check underlying AuditLog hash chain integrity if control depends on audit evidence
    let auditChainStatus: AuditChainStatus = 'NOT_APPLICABLE';
    let checkedAuditEvents = 0;
    let initialStatus: EvidenceStatus = 'READY';

    if (control.evidenceSources.includes('AuditLog')) {
      const chainVerification = await AuditRepository.verifyChain(params.organizationId);
      checkedAuditEvents = chainVerification.checkedEvents;
      if (!chainVerification.valid) {
        auditChainStatus = 'TAMPER_DETECTED';
        initialStatus = 'INTEGRITY_FAILED';
      } else {
        auditChainStatus = 'VERIFIED';
      }
    }

    // 2. Query authoritative records matching control criteria
    const rawItems: Array<{
      evidenceType: string;
      sourceType: ComplianceEvidenceItem['sourceType'];
      sourceId: string;
      description: string;
      occurredAt: string;
      metadata: Record<string, any>;
    }> = [];

    const sourceCounts: Record<string, number> = {};

    // Collect AuditLog authoritative evidence
    if (control.evidenceSources.includes('AuditLog')) {
      const allEvents = await this.getScopedAuditEvents(params.organizationId, start, end);

      const matchedLogs = allEvents.filter(ev => {
        if (control.requiredEvents && control.requiredEvents.length > 0) {
          return control.requiredEvents.includes(ev.action);
        }
        return true;
      });

      sourceCounts['AuditLog'] = matchedLogs.length;

      for (const log of matchedLogs) {
        rawItems.push({
          evidenceType: 'AUDIT_EVENT',
          sourceType: 'AuditLog',
          sourceId: log.id,
          description: `Authoritative audit event: ${log.action} on ${log.resource.type}:${log.resource.id}`,
          occurredAt: log.occurredAt,
          metadata: {
            action: log.action,
            category: log.category,
            severity: log.severity,
            result: log.result,
            actorType: log.actor.type,
            actorId: log.actor.id,
            sequenceNumber: log.sequenceNumber,
            eventHash: log.eventHash,
            previousEventHash: log.previousEventHash,
            details: log.details,
            metadata: log.metadata,
          },
        });
      }
    }

    // Collect Organization & Member evidence snapshots if relevant
    if (control.evidenceSources.includes('Organization') || control.evidenceSources.includes('OrganizationMember')) {
      try {
        if (process.env.SKIP_DB !== 'true') {
          const org = await prisma.organization.findUnique({
            where: { id: params.organizationId },
            include: { members: true, teams: true },
          });

          if (org) {
            rawItems.push({
              evidenceType: 'RESOURCE_SNAPSHOT',
              sourceType: 'Organization',
              sourceId: org.id,
              description: `Organization governance baseline: ${org.name} (${org.slug})`,
              occurredAt: org.createdAt.toISOString(),
              metadata: {
                name: org.name,
                slug: org.slug,
                status: org.status,
                memberCount: org.members.length,
                teamCount: org.teams.length,
              },
            });
            sourceCounts['Organization'] = 1;
            sourceCounts['OrganizationMember'] = org.members.length;
          }
        } else {
          // Synthetic baseline for test environments
          rawItems.push({
            evidenceType: 'RESOURCE_SNAPSHOT',
            sourceType: 'Organization',
            sourceId: params.organizationId,
            description: `Organization governance baseline for ${params.organizationId}`,
            occurredAt: periodStartIso,
            metadata: {
              organizationId: params.organizationId,
              status: 'ACTIVE',
            },
          });
          sourceCounts['Organization'] = 1;
        }
      } catch {
        // Fallback gracefully
      }
    }

    // Sort items deterministically by occurredAt then sourceId
    rawItems.sort((a, b) => {
      const tDiff = new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime();
      if (tDiff !== 0) return tDiff;
      return a.sourceId.localeCompare(b.sourceId);
    });

    // 3. Redact all metadata recursively and compute SHA-256 item hashes
    const items: ComplianceEvidenceItem[] = rawItems.map((item, idx) => {
      const sanitizedMetadata = AuditRedactor.redact(item.metadata);
      const itemId = `evitem_${packageId}_${idx + 1}`;
      const evidenceHash = this.computeItemHash({
        evidenceType: item.evidenceType,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        occurredAt: item.occurredAt,
        metadata: sanitizedMetadata,
      });

      return {
        id: itemId,
        packageId,
        evidenceType: item.evidenceType,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        description: item.description,
        occurredAt: item.occurredAt,
        metadata: sanitizedMetadata,
        evidenceHash,
        sequence: idx + 1,
      };
    });

    // 4. Construct manifest and compute composite package hash
    const manifest = {
      itemHashes: items.map(i => i.evidenceHash),
      sourceTypes: Object.keys(sourceCounts),
      schemaVersion: this.SCHEMA_VERSION,
      generatorVersion: this.GENERATOR_VERSION,
      controlVersion: control.version,
    };

    const packageHash = this.computePackageHash({
      organizationId: params.organizationId,
      controlId: params.controlId,
      packageType: control.category,
      periodStart: periodStartIso,
      periodEnd: periodEndIso,
      auditChainStatus,
      manifest,
    });

    const pkg: ComplianceEvidencePackage = {
      id: packageId,
      organizationId: params.organizationId,
      packageType: control.category,
      controlId: params.controlId,
      title: params.title || `${control.controlId} Evidence Package (${periodStartIso.split('T')[0]} to ${periodEndIso.split('T')[0]})`,
      description: params.description || control.description,
      periodStart: periodStartIso,
      periodEnd: periodEndIso,
      status: initialStatus,
      auditChainStatus,
      checkedAuditEvents,
      totalItems: items.length,
      sourceCounts,
      packageHash,
      manifest,
      generatedBy: params.generatedBy,
      generatorVersion: this.GENERATOR_VERSION,
      schemaVersion: this.SCHEMA_VERSION,
      generatedAt,
      items,
    };

    // 5. Persist to Database or In-Memory Store
    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.complianceEvidencePackage.create({
          data: {
            id: pkg.id,
            organizationId: pkg.organizationId,
            packageType: pkg.packageType,
            controlId: pkg.controlId,
            title: pkg.title,
            description: pkg.description,
            periodStart: new Date(pkg.periodStart),
            periodEnd: new Date(pkg.periodEnd),
            status: pkg.status,
            auditChainStatus: pkg.auditChainStatus,
            checkedAuditEvents: pkg.checkedAuditEvents,
            totalItems: pkg.totalItems,
            sourceCounts: pkg.sourceCounts,
            packageHash: pkg.packageHash,
            manifest: pkg.manifest,
            generatedBy: pkg.generatedBy,
            generatorVersion: pkg.generatorVersion,
            schemaVersion: pkg.schemaVersion,
            generatedAt: new Date(pkg.generatedAt),
          },
        });

        // Insert items in batches
        if (items.length > 0) {
          const itemInserts = items.map(i => ({
            id: i.id,
            packageId: pkg.id,
            evidenceType: i.evidenceType,
            sourceType: i.sourceType,
            sourceId: i.sourceId,
            description: i.description,
            occurredAt: new Date(i.occurredAt),
            metadata: i.metadata,
            evidenceHash: i.evidenceHash,
            sequence: i.sequence,
          }));

          // Batch insert up to 200 items at a time
          for (let b = 0; b < itemInserts.length; b += 200) {
            await prisma.complianceEvidenceItem.createMany({
              data: itemInserts.slice(b, b + 200),
            });
          }
        }
      } catch (err) {
        console.warn('[ComplianceEvidenceService] DB persistence failed; fallback to memory:', err);
        this.memoryPackages.set(pkg.id, pkg);
        this.memoryItems.set(pkg.id, items);
      }
    } else {
      this.memoryPackages.set(pkg.id, pkg);
      this.memoryItems.set(pkg.id, items);
    }

    return pkg;
  }

  /**
   * Retrieves an evidence package by ID with strict tenant boundary enforcement.
   */
  static async getEvidencePackage(
    packageId: string,
    organizationId: string
  ): Promise<ComplianceEvidencePackage | null> {
    if (!packageId || !organizationId) return null;

    if (process.env.SKIP_DB !== 'true') {
      try {
        const pkg = await prisma.complianceEvidencePackage.findFirst({
          where: { id: packageId, organizationId },
          include: {
            items: {
              orderBy: { sequence: 'asc' },
            },
          },
        });

        if (!pkg) return null;

        return {
          id: pkg.id,
          organizationId: pkg.organizationId,
          packageType: pkg.packageType as any,
          controlId: pkg.controlId,
          title: pkg.title,
          description: pkg.description,
          periodStart: pkg.periodStart.toISOString(),
          periodEnd: pkg.periodEnd.toISOString(),
          status: pkg.status as any,
          auditChainStatus: pkg.auditChainStatus as any,
          checkedAuditEvents: pkg.checkedAuditEvents,
          totalItems: pkg.totalItems,
          sourceCounts: pkg.sourceCounts as any,
          packageHash: pkg.packageHash,
          manifest: pkg.manifest as any,
          generatedBy: pkg.generatedBy,
          generatorVersion: pkg.generatorVersion,
          schemaVersion: pkg.schemaVersion,
          generatedAt: pkg.generatedAt.toISOString(),
          items: pkg.items.map(i => ({
            id: i.id,
            packageId: i.packageId,
            evidenceType: i.evidenceType,
            sourceType: i.sourceType as any,
            sourceId: i.sourceId,
            description: i.description,
            occurredAt: i.occurredAt.toISOString(),
            metadata: i.metadata as any,
            evidenceHash: i.evidenceHash,
            sequence: i.sequence,
          })),
        };
      } catch {
        // Fallback to memory
      }
    }

    const memPkg = this.memoryPackages.get(packageId);
    if (!memPkg || memPkg.organizationId !== organizationId) return null;

    const items = this.memoryItems.get(packageId) || [];
    return {
      ...memPkg,
      items,
    };
  }

  /**
   * Lists compliance evidence packages for an organization.
   */
  static async listEvidencePackages(params: {
    organizationId: string;
    controlId?: string;
    limit?: number;
  }): Promise<ComplianceEvidencePackage[]> {
    if (!params.organizationId) return [];
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);

    if (process.env.SKIP_DB !== 'true') {
      try {
        const pkgs = await prisma.complianceEvidencePackage.findMany({
          where: {
            organizationId: params.organizationId,
            ...(params.controlId ? { controlId: params.controlId } : {}),
          },
          orderBy: { generatedAt: 'desc' },
          take: limit,
        });

        return pkgs.map(pkg => ({
          id: pkg.id,
          organizationId: pkg.organizationId,
          packageType: pkg.packageType as any,
          controlId: pkg.controlId,
          title: pkg.title,
          description: pkg.description,
          periodStart: pkg.periodStart.toISOString(),
          periodEnd: pkg.periodEnd.toISOString(),
          status: pkg.status as any,
          auditChainStatus: pkg.auditChainStatus as any,
          checkedAuditEvents: pkg.checkedAuditEvents,
          totalItems: pkg.totalItems,
          sourceCounts: pkg.sourceCounts as any,
          packageHash: pkg.packageHash,
          manifest: pkg.manifest as any,
          generatedBy: pkg.generatedBy,
          generatorVersion: pkg.generatorVersion,
          schemaVersion: pkg.schemaVersion,
          generatedAt: pkg.generatedAt.toISOString(),
        }));
      } catch {
        // Fallback to memory
      }
    }

    const results: ComplianceEvidencePackage[] = [];
    for (const pkg of this.memoryPackages.values()) {
      if (pkg.organizationId === params.organizationId) {
        if (!params.controlId || pkg.controlId === params.controlId) {
          results.push(pkg);
        }
      }
    }

    return results
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
      .slice(0, limit);
  }

  /**
   * Independently verifies the cryptographic integrity of an evidence package.
   *
   * Verifies:
   * 1. Recomputed hash of each evidence item against item.evidenceHash.
   * 2. Recomputed manifest hash against package.packageHash.
   * 3. Underlying AuditLog hash chain integrity for the organization.
   */
  static async verifyEvidencePackage(params: {
    packageId: string;
    organizationId: string;
  }): Promise<EvidenceVerificationResult> {
    const pkg = await this.getEvidencePackage(params.packageId, params.organizationId);
    if (!pkg) {
      return {
        valid: false,
        packageId: params.packageId,
        checkedItems: 0,
        packageHashValid: false,
        itemHashesValid: false,
        auditChainValid: false,
        integrityStatus: 'FAILED',
        message: 'Evidence package not found or does not belong to the requested organization.',
      };
    }

    const items = pkg.items || [];
    let itemHashesValid = true;
    let firstInvalidItem: EvidenceVerificationResult['firstInvalidItem'] = null;

    // 1. Verify each evidence item hash
    for (const item of items) {
      const computedHash = this.computeItemHash({
        evidenceType: item.evidenceType,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        occurredAt: item.occurredAt,
        metadata: item.metadata,
      });

      if (computedHash !== item.evidenceHash) {
        itemHashesValid = false;
        firstInvalidItem = {
          itemId: item.id,
          sequence: item.sequence,
          expectedHash: item.evidenceHash,
          computedHash,
          reason: 'Item metadata or attributes do not match cryptographic hash.',
        };
        break;
      }
    }

    // 2. Verify composite package hash
    const computedPackageHash = this.computePackageHash({
      organizationId: pkg.organizationId,
      controlId: pkg.controlId,
      packageType: pkg.packageType,
      periodStart: pkg.periodStart,
      periodEnd: pkg.periodEnd,
      auditChainStatus: pkg.auditChainStatus,
      manifest: pkg.manifest,
    });

    const packageHashValid = computedPackageHash === pkg.packageHash;

    // 3. Verify underlying AuditLog hash chain if audit evidence was used
    let auditChainValid = true;
    const control = COMPLIANCE_CONTROLS[pkg.controlId];
    if (control && control.evidenceSources.includes('AuditLog')) {
      const chainVerification = await AuditRepository.verifyChain(pkg.organizationId);
      auditChainValid = chainVerification.valid;
    }

    const overallValid = itemHashesValid && packageHashValid && auditChainValid;
    const integrityStatus: EvidenceStatus = overallValid ? 'READY' : 'INTEGRITY_FAILED';

    let message = 'Evidence package verified successfully: all item hashes, package manifest, and audit chain are cryptographically valid.';
    if (!overallValid) {
      if (!itemHashesValid) {
        message = `Item integrity failure at sequence #${firstInvalidItem?.sequence}: ${firstInvalidItem?.reason}`;
      } else if (!packageHashValid) {
        message = 'Package manifest hash mismatch: package metadata or manifest entries have been modified.';
      } else if (!auditChainValid) {
        message = 'Audit ledger integrity failure: the underlying organization audit hash chain contains invalid or tampered records.';
      }
    }

    return {
      valid: overallValid,
      packageId: pkg.id,
      checkedItems: items.length,
      packageHashValid,
      itemHashesValid,
      auditChainValid,
      integrityStatus,
      firstInvalidItem,
      message,
    };
  }

  /**
   * Generates a portable, verifiable JSON evidence export payload.
   */
  static async exportEvidencePackage(params: {
    packageId: string;
    organizationId: string;
  }): Promise<EvidenceExportPayload> {
    const pkg = await this.getEvidencePackage(params.packageId, params.organizationId);
    if (!pkg) {
      throw new Error('Evidence package not found or cross-tenant access denied.');
    }

    const verification = await this.verifyEvidencePackage(params);

    return {
      exportVersion: 'RecoverIQ-Export-v1.0',
      exportedAt: new Date().toISOString(),
      disclaimer: 'RecoverIQ generates evidence supporting organizational compliance activities, but evidence generation does not itself establish regulatory or certification compliance.',
      package: {
        ...pkg,
        items: undefined, // omitted from package summary; included in top-level items array
      },
      items: pkg.items || [],
      verification: {
        verified: verification.valid,
        auditIntegrity: pkg.auditChainStatus,
        verifiedAt: new Date().toISOString(),
      },
    };
  }
}
