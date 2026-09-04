# RecoverIQ — PostgreSQL Database Deployment Specification

## 1. Authoritative State Principle

PostgreSQL is the sole authoritative system of record for RecoverIQ. All financial models, transaction histories, merchant configurations, user accounts, recovery states, and cryptographic audit records reside in PostgreSQL.

---

## 2. Migration Strategy & Execution Commands

### Development Workflow
In local development environments:
```bash
# Generates and applies migrations interactively:
npx prisma migrate dev
```

### Staging & Production Deployment Workflow
In staging and production pipelines:
```bash
# Applies pre-compiled, verified migrations non-interactively:
npx prisma migrate deploy
```

> [!CAUTION]
> **STRICT PROHIBITION**:
> NEVER execute `prisma migrate reset` against Staging or Production databases.
> `prisma migrate reset` will drop the entire public schema and permanently destroy all production records.
> Destructive schema modification commands are blocked by operational safeguards and CI/CD policy.

---

## 3. Connection Pooling Architecture

RecoverIQ applications deploy using pooled connection strings to handle serverless or multi-instance traffic spikes without exhausting database socket limits:

### Connection String Standards:
```bash
# Pooled connection URL (used by Next.js web application and worker runtime):
DATABASE_URL="postgresql://user:password@pgbouncer.recoveriq.internal:6543/recoveriq?sslmode=require&pgbouncer=true&connection_limit=20"

# Direct connection URL (used strictly for migration deployment):
DIRECT_URL="postgresql://user:password@db.recoveriq.internal:5432/recoveriq?sslmode=require"
```

### Pooling Pool Sizing Guidelines:
- **Next.js Web Fleet**: 10–20 connections per instance (handles HTTP route handlers and API requests).
- **Worker Fleet**: 5–10 connections per node (executes leased sequence updates and transactional writes).
- **Total Max Pool**: Allocate 70% of database instance `max_connections` to application pools, reserving 30% for administrative queries, migrations, and read replicas.

---

## 4. Migration Safety Invariants

1. **Additive Changes First**: Every column added must be `NULL` or have a default value to prevent table locks and backward compatibility breakage.
2. **Concurrent Indexing**: Production indexes must be created with `CONCURRENTLY` (or managed via forward migrations) to avoid blocking write operations on high-velocity tables (`Transaction`, `RecoveryAttempt`, `AuditEvent`).
3. **Idempotent Seeding**: The database seed script (`prisma/seed.ts`) uses `upsert` exclusively, ensuring deterministic execution without duplicate primary key collisions.
4. **Health Check Validation**: `/api/ready` performs an active query check (`SELECT 1`) to verify read-write connection capability before accepting ingress traffic.
