# RecoverIQ — Cryptographic Audit Integrity & Hash Chaining (Phase 8.7.1)

## 1. Hash Chain Specification

RecoverIQ implements cryptographic tamper-evidence using organization-partitioned SHA-256 hash chaining:

```text
Event 1 (Genesis)
previousEventHash: null
canonicalPayload:  { sequenceNumber: 1, action: "ORG_CREATED", ... }
eventHash:         SHA256(canonicalPayload + ":GENESIS")

Event 2
previousEventHash: eventHash(1)
canonicalPayload:  { sequenceNumber: 2, action: "AUTH_LOGIN_SUCCESS", ... }
eventHash:         SHA256(canonicalPayload + ":" + eventHash(1))

Event 3
previousEventHash: eventHash(2)
canonicalPayload:  { sequenceNumber: 3, action: "ORG_MEMBER_INVITED", ... }
eventHash:         SHA256(canonicalPayload + ":" + eventHash(2))
```

---

## 2. Deterministic Canonicalization

To guarantee that recalculations across distinct runtimes always produce identical cryptographic digests:
1. **Recursive Lexicographical Sorting**: All dictionary/object keys are sorted alphabetically.
2. **Standardized Primitives**: Numbers, booleans, and nulls follow strict JSON representation.
3. **UTC Timestamps**: All temporal values are normalized to ISO 8601 UTC strings (`toISOString()`).
4. **UTF-8 Encoding**: Character streams are hashed deterministically as UTF-8 bytes.

---

## 3. Tamper Detection Capabilities

The `AuditRepository.verifyChain(organizationId)` method walks the ledger from sequence 1 to head:
- **Modified Metadata**: Recalculated hash diverges from stored `eventHash` -> Flagged.
- **Modified Action/Actor/Resource**: Recalculated hash diverges -> Flagged.
- **Modified Timestamp**: Recalculated hash diverges -> Flagged.
- **Modified Sequence Number**: Monotonic ordering validation fails -> Flagged.
- **Broken Linkage**: `previousEventHash` does not match prior row's `eventHash` -> Flagged.

Any deviation immediately returns `{ valid: false, firstInvalidSequence: N, reason: "..." }`.
No silent repair is ever performed.
