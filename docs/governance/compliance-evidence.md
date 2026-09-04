# RecoverIQ — Enterprise Compliance Evidence Architecture

## 1. Executive Summary
RecoverIQ Compliance Evidence is an observational, reproducible, integrity-verifiable evidence generation plane that aggregates authoritative tenant governance records (AuditLog, Organization, Member, ApiKey, Subscription, UsageLedger, and RecoveryAttempt) to demonstrate internal security and operational controls.

> **CRITICAL REGULATORY NOTICE**:
> RecoverIQ generates evidence supporting organizational compliance activities, but evidence generation does not itself establish regulatory or certification compliance. Never claim external certification (e.g. "SOC 2 certified", "ISO 27001 compliant", "PCI DSS certified", "HIPAA compliant", or "RBI certified") without an independent external audit.

---

## 2. Core Separation of Responsibilities
The governance plane maintains strict architectural separation:

* **Audit Ledger (`AuditLog`)**: The immutable, append-only, cryptographic ground truth of what occurred.
* **Audit Analytics (`AuditAnalyticsService`)**: Derived investigation intelligence and activity telemetry.
* **Compliance Evidence (`ComplianceEvidenceService`)**: Reproducible, bounded evidence snapshots referencing authoritative source records.
* **Governance Policies (`GovernancePolicyEngine`)**: Preventive, deterministic organizational controls.
* **Usage Ledger (`UsageLedgerEntry`)**: Authoritative commercial billing and quota truth.
* **Recovery Attempt (`RecoveryAttempt`)**: Authoritative payment recovery execution truth.
* **Decision Trace (`DecisionTrace`)**: AI reasoning and telemetry explanation truth.

Compliance evidence packages **reference** authoritative records; they do not replace, duplicate, or mutate them.

---

## 3. Evidence Generation Lifecycle
1. **Scope & Period Validation**: Enforces non-empty tenant scope and bounded time window (<=180 days).
2. **Audit Hash Chain Check**: Automatically evaluates `AuditRepository.verifyChain(orgId)`. If an unbroken hash chain is verified, the package records `auditChainStatus = 'VERIFIED'`. If tampering is detected, generation halts or marks `status = 'INTEGRITY_FAILED'`.
3. **Authoritative Evidence Collection**: Retrieves authentic records matching the control definition's required event types and data sources.
4. **Deep Recursive Redaction**: Recursively strips credentials, tokens, session IDs, private keys, API secrets, and payment data using `AuditRedactor`.
5. **Deterministic SHA-256 Hashing**:
   - Each evidence item is canonicalized and assigned a unique SHA-256 digest.
   - The composite package manifest is canonicalized and assigned a package hash.
6. **Export & Verification**: Packages can be exported as structured JSON and verified independently by internal or external auditors.
