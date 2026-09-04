# RecoverIQ — Organization Architecture

## 1. Overview & Hierarchy

RecoverIQ implements a two-tier enterprise tenancy model:

```
+-------------------------------------------------------------+
|                      ORGANIZATION                           |
|  - Root legal & billing entity                              |
|  - Enforces seat limits, team limits, SSO, domain policies   |
|  - Governed by single active OWNER                          |
+-------------------------------------------------------------+
                              |
              +---------------+---------------+
              |                               |
              v                               v
+---------------------------+   +---------------------------+
|    MERCHANT WORKSPACE 1   |   |    MERCHANT WORKSPACE 2   |
| (e.g., SaaSify India Prod)|   | (e.g., SaaSify Global EU) |
| - Razorpay credentials    |   | - Razorpay credentials    |
| - Recovery policies       |   | - Recovery policies       |
| - Payment executions      |   | - Payment executions      |
+---------------------------+   +---------------------------+
```

### Hierarchy Guarantees
1. **Root Entity**: Every user belongs to one or more `Organization`s through `OrganizationMember`.
2. **Workspace Isolation**: `Merchant` represents payment execution workspaces. Each merchant belongs to an `Organization` via `Merchant.organizationId`.
3. **Execution Safety**: Payment execution, idempotency keys, and recovery attempts remain strictly scoped to `merchantId`, preserving backwards compatibility with existing pipelines.

---

## 2. Data Models

```prisma
enum OrganizationStatus {
  ACTIVE
  SUSPENDED
  DEACTIVATED
}

enum MemberStatus {
  ACTIVE
  INVITED
  SUSPENDED
  REMOVED
}

enum TeamStatus {
  ACTIVE
  ARCHIVED
}

model Organization {
  id             String             @id @default(uuid())
  name           String
  slug           String             @unique
  status         OrganizationStatus @default(ACTIVE)
  billingEmail   String?
  metadata       Json?
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  members        OrganizationMember[]
  invitations    OrganizationInvitation[]
  teams          Team[]
  merchants      Merchant[]
}
```

---

## 3. Identifiers & Slug Normalization
- All organization slugs are strictly normalized: lowercased, spaces/underscores converted to single hyphens, stripped of invalid symbols.
- Reserved slugs (`admin`, `api`, `system`, `app`, `login`, etc.) are blocked.
- Slugs must be between 3 and 48 characters in length.
