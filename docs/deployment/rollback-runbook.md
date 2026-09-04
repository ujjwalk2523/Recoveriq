# RecoverIQ — Production & Staging Rollback Runbook

## 1. Principles of Non-Destructive Rollback

RecoverIQ strictly adheres to zero-data-loss rollback engineering:
1. **Stateless Web & Worker Fleet**: Application instances can be stopped, restarted, or reverted to prior container tags/commits without altering persistent database records.
2. **Forward-Compatible Database Migrations**: Database schema additions (tables, nullable columns, non-breaking indexes) must be designed to allow previous application versions (N-1) to run seamlessly alongside current versions (N).
3. **No Automatic Destructive DB Rollbacks**: Never execute `prisma migrate reset` or drop columns automatically during a rollback incident. Data preservation is paramount.

---

## 2. Web Application Rollback

When a deployment introduces a critical regression in the Next.js web application:

### Step 1: Drain Ingress Traffic
If running a blue-green or canary setup:
- Shift 100% of ingress router traffic back to the previous stable blue version (Image Tag: `vN-1`).
- If running single-fleet container services (e.g. AWS ECS, Kubernetes, or Render):
  ```bash
  # Example Kubernetes rollback:
  kubectl rollout undo deployment/recoveriq-web -n recoveriq
  ```

### Step 2: Invalidate Edge Cache
Purge CDN/edge cache for static assets and API routes:
```bash
# Cloudflare / Vercel cache purge
curl -X POST https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

### Step 3: Verify Liveness & Readiness
Verify rollback stability:
```bash
curl -i https://app.recoveriq.io/api/health
curl -i https://app.recoveriq.io/api/ready
```

---

## 3. Worker Fleet Rollback

If a worker deployment introduces job execution errors, lease stalls, or adapter timeouts:

### Step 1: Send Graceful Shutdown to Current Workers
Issue `SIGTERM` to the active worker processes.
- The `DistributedRecoveryWorker` catches `SIGTERM` via `registerShutdownHandlers()`.
- Workers cease polling new jobs.
- Workers are granted `WORKER_SHUTDOWN_TIMEOUT_MS` (default: 8,000ms) to complete in-flight transactions or safely release leases back to Redis.

### Step 2: Deploy Previous Worker Container / Version
Revert worker container/task definition to version `vN-1`:
```bash
# Kubernetes rollback:
kubectl rollout undo deployment/recoveriq-worker -n recoveriq
```

### Step 3: Verify Worker Re-Leasing & Health
- Observe worker logs to ensure nodes join the cluster, establish Redis pub/sub listeners, and acquire expired or pending sequences from PostgreSQL.
- Check worker heartbeats:
  ```bash
  curl -H "Authorization: Bearer $ADMIN_TOKEN" https://app.recoveriq.io/api/workers/status
  ```

---

## 4. Database Backward-Compatibility Handling

When a rollback occurs after migrations were deployed:

1. **Columns & Tables Added**:
   - Because Phase migrations use additive, nullable, or defaulted columns, Version `vN-1` will ignore new columns and function normally.
2. **Handling Schema Divergence**:
   - DO NOT issue manual `ALTER TABLE ... DROP COLUMN` while incidents are active.
   - Investigate whether code hotfix or targeted forward migration (`vN+1`) resolves the issue.
3. **Dead-Letter Recovery**:
   - Any recovery sequence that failed during the bad version will reside in PostgreSQL with status `REQUIRES_MANUAL_REVIEW` or `FAILED`.
   - Once stable workers are restored, run the reconciliation script:
     ```bash
     npx tsx scripts/reconcile-pending.ts
     ```

---

## 5. Rollback Verification Checklist

- [ ] Web application returns HTTP 200 on `/api/health`
- [ ] Database connectivity verified on `/api/ready`
- [ ] Worker processes polling and acquiring recovery leases without throwing unhandled rejections
- [ ] Razorpay webhook HMAC validation succeeds for inbound events
- [ ] No duplicate payment executions observed in logs
- [ ] Audit ledger records the rollback incident with operator identity
