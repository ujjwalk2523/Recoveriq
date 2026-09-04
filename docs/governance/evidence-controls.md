# RecoverIQ — Internal Compliance Controls Catalog

## 1. Overview
RecoverIQ defines eight internal evidence control specifications. These represent internally verifiable security, governance, and operational capabilities of the platform.

> **NOTICE**: These are RecoverIQ internal controls. They are not official ISO, SOC 2, or PCI DSS regulatory controls unless mapped and independently assessed by an authorized certification body.

---

## 2. Control Catalog

| Control ID | Name | Category | Authoritative Sources | Verification Method |
| :--- | :--- | :--- | :--- | :--- |
| **`AUTH-001`** | Authentication & Session Lifecycle Auditability | `AUTHENTICATION` | `AuditLog` | Cryptographic Hash Chain & Session Reconciliation |
| **`MFA-001`** | Multi-Factor Authentication Enforcement | `MFA` | `AuditLog` | Secret Redaction & Audit Log Verification |
| **`ORG-001`** | Organization Membership & Role Governance | `ORGANIZATION_GOVERNANCE` | `AuditLog`, `Organization`, `OrganizationMember`, `Team` | State Transition Diff & Scope Audit |
| **`API-001`** | API Key Security & Cryptographic Storage | `API_SECURITY` | `AuditLog`, `ApiKey` | Hashed Secret Inspection & Scope Validation |
| **`SEC-001`** | Security Configuration & Diagnostic Authorization | `SECURITY_ACTIVITY` | `AuditLog`, `SecurityConfiguration` | RBAC Enforcement Audit & Snapshot |
| **`BIL-001`** | Billing Integrity & Immutable Usage Ledger | `BILLING_GOVERNANCE` | `AuditLog`, `Subscription`, `Invoice`, `UsageLedgerEntry` | Ledger Immutability & Invoice Reconciliation |
| **`REC-001`** | Recovery Strategy & Human Approval Governance | `RECOVERY_GOVERNANCE` | `AuditLog`, `Transaction`, `RecoveryAttempt`, `DecisionTrace` | Decision Trace Audit & Guardrail Compliance |
| **`CHANGE-001`**| System Change Management & Webhook Lifecycle | `CHANGE_MANAGEMENT` | `AuditLog`, `WebhookEndpoint` | Endpoint Health & Audit Trail Verification |

---

## 3. Control Versioning & Immutability
Each control definition includes a semantic version (e.g. `1.0.0`). When evidence packages are created, the active `controlVersion` is permanently baked into the cryptographic package manifest to ensure reproducible historical verification.
