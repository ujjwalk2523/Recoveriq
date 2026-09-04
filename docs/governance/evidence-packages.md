# RecoverIQ — Evidence Packages & Export Specifications

## 1. Evidence Package Schema

```json
{
  "exportVersion": "RecoverIQ-Export-v1.0",
  "exportedAt": "2026-09-04T12:00:00.000Z",
  "disclaimer": "RecoverIQ generates evidence supporting organizational compliance activities, but evidence generation does not itself establish regulatory or certification compliance.",
  "package": {
    "id": "evpkg_1788523800000_3a8f19",
    "organizationId": "org_enterprise_acme",
    "packageType": "AUTHENTICATION",
    "controlId": "AUTH-001",
    "title": "AUTH-001 Evidence Package (2026-08-05 to 2026-09-04)",
    "description": "Verifies that user authentication attempts, session creations, token rotations, and revocations produce immutable, traceable audit evidence.",
    "periodStart": "2026-08-05T00:00:00.000Z",
    "periodEnd": "2026-09-04T00:00:00.000Z",
    "status": "READY",
    "auditChainStatus": "VERIFIED",
    "checkedAuditEvents": 1420,
    "totalItems": 42,
    "sourceCounts": {
      "AuditLog": 42
    },
    "packageHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "manifest": {
      "itemHashes": [
        "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
      ],
      "sourceTypes": ["AuditLog"],
      "schemaVersion": 1,
      "generatorVersion": "RecoverIQ-Evidence-v1.0",
      "controlVersion": "1.0.0"
    },
    "generatedBy": "usr_sec_officer_1",
    "generatorVersion": "RecoverIQ-Evidence-v1.0",
    "schemaVersion": 1,
    "generatedAt": "2026-09-04T12:00:00.000Z"
  },
  "items": [
    {
      "id": "evitem_evpkg_1788523800000_3a8f19_1",
      "packageId": "evpkg_1788523800000_3a8f19",
      "evidenceType": "AUDIT_EVENT",
      "sourceType": "AuditLog",
      "sourceId": "aud_log_001",
      "description": "Authoritative audit event: AUTH_LOGIN_SUCCESS on SESSION:sess_1029",
      "occurredAt": "2026-08-05T09:12:00.000Z",
      "metadata": {
        "action": "AUTH_LOGIN_SUCCESS",
        "category": "AUTHENTICATION",
        "severity": "INFO",
        "result": "SUCCESS"
      },
      "evidenceHash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      "sequence": 1
    }
  ],
  "verification": {
    "verified": true,
    "auditIntegrity": "VERIFIED",
    "verifiedAt": "2026-09-04T12:00:00.000Z"
  }
}
```

---

## 2. Supported Evidence Categories
* `SECURITY_ACTIVITY`: Privileged actions, diagnostics, and domain configurations.
* `ACCESS_CONTROL`: Role assignments, ownership transfers, and team permissions.
* `AUTHENTICATION`: Login events, token cycles, and session lifecycle.
* `MFA`: TOTP enrollment, verification challenges, and recovery codes.
* `SESSION_MANAGEMENT`: Idle timeouts, concurrent session terminations, and revocations.
* `ORGANIZATION_GOVERNANCE`: Tenant lifecycle and membership additions.
* `API_SECURITY`: Programmatic API key provisioning and scope management.
* `BILLING_GOVERNANCE`: Subscriptions, invoices, and usage ledger reconciliation.
* `PAYMENT_GOVERNANCE`: Payment provider credentials and operational status.
* `RECOVERY_GOVERNANCE`: Recovery strategy selection and manual human approvals.
* `CHANGE_MANAGEMENT`: Outbound developer webhook endpoints and secrets.
