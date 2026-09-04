# RecoverIQ — Evidence Integrity & Tamper Verification

## 1. Dual-Layer Cryptographic Integrity
RecoverIQ evidence packages utilize a two-tier verification mechanism:

1. **Underlying Ledger Hash Chain (`AuditLog`)**:
   - Every audit record possesses a SHA-256 hash chaining back to predecessor events:
     $$H_i = \text{SHA256}(\text{Canonical}(E_i) \,\|\, H_{i-1})$$
   - Before an evidence package is generated, `AuditRepository.verifyChain(orgId)` is evaluated.
   - If any audit record has been tampered with or modified in the database, `auditChainStatus` is flagged as `TAMPER_DETECTED` and the package status is marked `INTEGRITY_FAILED`.

2. **Package Manifest & Item Hashes**:
   - Each evidence item is canonicalized lexicographically and assigned an `evidenceHash`:
     $$h_j = \text{SHA256}(\text{Canonical}(\text{item}_j))$$
   - The package manifest combines all item hashes with metadata:
     $$H_{\text{pkg}} = \text{SHA256}(\text{Canonical}(\{\text{orgId}, \text{controlId}, \text{period}, \text{manifest}\}))$$
   - When `verifyEvidencePackage()` runs, it recomputes all item hashes and the package hash to detect any in-flight mutation or metadata tampering.

---

## 2. Independent Verification Tool
Auditors can independently verify evidence packages using the exported JSON:

```typescript
import { ComplianceEvidenceService } from '@/lib/compliance/compliance-evidence-service';

const result = await ComplianceEvidenceService.verifyEvidencePackage({
  packageId: 'evpkg_1788523800000_3a8f19',
  organizationId: 'org_enterprise_acme',
});

console.log('Integrity Valid:', result.valid);
console.log('Audit Ledger Valid:', result.auditChainValid);
console.log('Item Hashes Valid:', result.itemHashesValid);
```
