# RecoverIQ — Data Protection & Privacy Architecture

## 1. Multi-Tenant Data Isolation
Every data model in RecoverIQ (Transactions, Customers, RecoveryAttempts, Invoices, ApiKeys) contains a mandatory `merchantId` relation.
- Queries enforce `where: { id, merchantId }`.
- Cross-tenant queries are rejected with HTTP 403 / 404.

---

## 2. Customer PII Protection
- Customer phone numbers and emails are handled strictly for recovery dispatch (e.g. WhatsApp / SMS / Email payment links).
- In logs and diagnostics, customer PII is redacted or masked (`••••••••`).
- Stored payment tokens are tokenized references provided by Razorpay; raw credit card numbers or CVVs are never processed or persisted.

---

## 3. Tamper-Evident Audit Logging
- Every audit log entry computes a SHA-256 integrity hash:
  `sha256 = H(merchantId + actorType + actorName + action + entityId + details + timestamp)`
- Hash validation allows detecting unauthorized direct row modifications in the database.
