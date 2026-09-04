# RecoverIQ — Centralized Authorization & Tenant Isolation

## 1. Principles
RecoverIQ enforces a strict Zero-Trust principle: every incoming request must resolve its principal and tenant identity before any business rule or database operation can proceed.

```
UNTRUSTED REQUEST
       │
       ▼
SecurityContext Resolution (Principal, Roles, Scopes, MerchantId)
       │
       ▼
requireAuthenticated(context)
       │
       ▼
requireMerchantAccess(context, targetMerchantId)
       │
       ▼
requireRole(context, minimumRole) / requireScope(context, scope)
       │
       ▼
Tenant-Scoped Database Mutation
```

---

## 2. Multi-Tenant Boundary Enforcement
1. **Never Infer Tenant from Request Body**: Authorization is derived strictly from the verified session or API key.
2. **Tenant Scoping in Queries**: All database lookups and mutations require `merchantId`:
   ```ts
   // Safe pattern
   prisma.transaction.findFirst({
     where: { id: transactionId, merchantId: context.merchantId }
   });
   ```
3. **IDOR Defense**: Any attempt to access a resource belonging to another tenant fails with HTTP 403 `CROSS_TENANT_ACCESS_DENIED` or HTTP 404.

---

## 3. Role-Based Access Control (RBAC) Matrix
| Role | Level | Policy Modification | Approve Recovery | Manage Keys | Manage Billing | View Analytics |
|---|---|---|---|---|---|---|
| **OWNER** | 4 | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **ADMIN** | 3 | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **OPERATOR**| 2 | ❌ Denied | ✅ Full | ❌ Denied | ❌ Denied | ✅ Full |
| **ANALYST** | 1 | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | ✅ Read-Only |
