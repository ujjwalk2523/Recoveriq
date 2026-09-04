# RecoverIQ — Production & Controlled Demo Deployment Runbook

## 1. Overview & Pre-Flight Prerequisites

This runbook specifies the step-by-step standard operating procedure for deploying RecoverIQ to staging (Razorpay TEST Mode) or production.

### Target Environment Requirements
- Node.js runtime: v20.x or v22.x LTS (compatible with v24).
- Managed PostgreSQL: v15+ (AWS RDS, Neon, Supabase, or GCP Cloud SQL) with connection pooling enabled.
- Managed Redis: v7.x+ (AWS ElastiCache, Upstash, or Redis Cloud) with persistence and TLS.
- Ingress: HTTPS reverse proxy / CDN (Cloudflare, AWS ALB, or Vercel).

---

## 2. Step-by-Step Deployment Sequence

### Step 1: Provision Managed PostgreSQL
1. Create a PostgreSQL 15+ database instance with automatic daily backups and multi-AZ failover for production.
2. Configure connection pooling (e.g. PgBouncer in transaction mode or Neon serverless pooling).
3. Record the direct migration URL (`DIRECT_URL`) and the pooled application URL (`DATABASE_URL`).
4. Ensure SSL mode is enabled (`?sslmode=require`).

### Step 2: Provision Managed Redis
1. Deploy a Redis 7.x cluster with `maxmemory-policy noeviction` or `volatile-lru`.
2. Enable TLS transit encryption (`rediss://...`).
3. Set minimum command timeout to 5000ms.
4. Record `REDIS_URL`.

### Step 3: Configure Environment Variables
1. Populate secret vault or environment store (e.g., AWS Parameter Store, Infisical, or Docker secrets) using `docs/deployment/environment.md`.
2. For Staging / Demo:
   - `APP_ENV=staging`
   - `RAZORPAY_KEY_ID=rzp_test_...`
   - `RAZORPAY_KEY_SECRET=...`
   - `RAZORPAY_WEBHOOK_SECRET=...`
   - `PAYMENT_EXECUTION_ENABLED=true`
3. For Production:
   - `APP_ENV=production`
   - `RAZORPAY_KEY_ID=rzp_live_...`
   - `RAZORPAY_KEY_SECRET=...`
   - `RAZORPAY_WEBHOOK_SECRET=...`
   - `PAYMENT_EXECUTION_ENABLED=true`
   - `ALLOW_LIVE_PAYMENT_TESTS=false`

### Step 4: Deploy Database Migrations
Run schema migration strictly via forward-compatible migrations:
```bash
# In production / staging CI/CD pipeline:
npx prisma migrate deploy
```
> [!CAUTION]
> NEVER execute `prisma migrate reset` or `prisma db push --force-reset` on staging or production.

### Step 5: Deploy Next.js Web Application
1. Compile the production bundle:
   ```bash
   npm run build
   ```
2. Start the web fleet instances:
   ```bash
   npm run start
   ```
3. Ensure process manager (e.g. systemd, PM2, or Kubernetes) monitors process health with auto-restart on SIGSEGV/uncaught exceptions.

### Step 6: Deploy Dedicated Worker Fleet
1. Start the distributed background worker process on dedicated compute nodes:
   ```bash
   npm run worker
   # Or directly: tsx src/worker.ts
   ```
2. Ensure worker processes have direct connectivity to PostgreSQL and Redis.
3. Configure worker graceful shutdown signals (`SIGTERM`, `SIGINT`).

### Step 7: Verify Application Health
Perform a lightweight unauthenticated liveness ping:
```bash
curl -i https://app.recoveriq.io/api/health
```
**Expected Response:**
```json
HTTP/1.1 200 OK
Content-Type: application/json
X-Request-ID: req_...

{
  "status": "ok",
  "service": "recoveriq",
  "environment": "staging",
  "version": "0.1.0",
  "timestamp": "2026-09-04T19:00:00.000Z"
}
```

### Step 8: Verify Readiness & Critical Dependencies
Query the readiness endpoint to validate DB and config health:
```bash
curl -i https://app.recoveriq.io/api/ready
```
**Expected Response:**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "ready",
  "checks": {
    "configuration": "ok",
    "database": "ok"
  }
}
```

### Step 9: Verify Worker Status
Query the worker status API with admin authentication or inspect worker process stdout:
```bash
curl -H "Authorization: Bearer <ADMIN_TOKEN>" https://app.recoveriq.io/api/workers/status
```
Verify worker node registers heartbeat in Redis (`worker:heartbeat:<worker_id>`).

### Step 10: Configure Razorpay Webhook
1. Log in to the Razorpay Dashboard (Test Mode for Staging/Demo).
2. Navigate to **Settings > Webhooks > Add New Webhook**.
3. Set Webhook URL: `https://app.recoveriq.io/api/webhooks/razorpay`
4. Set Secret: Value configured in `RAZORPAY_WEBHOOK_SECRET`.
5. Select Alert Events:
   - `payment.failed`
   - `payment.authorized`
   - `payment.captured`
   - `order.paid`
   - `refund.processed`
   - `dispute.created`
6. Save and verify webhook registration status.

### Step 11: Run Controlled Demo Transaction
Inject a synthetic failed test payment into the webhook endpoint using the testing suite:
```bash
npm run test:razorpay
```
Or initiate a checkout with standard Razorpay test card `4012 0000 0000 0002` (Simulated Failure).

### Step 12: Verify Complete Recovery Flow
1. Confirm the failed payment appears in `/dashboard/transactions` with root cause diagnosis.
2. Confirm ML recovery score and expected net recovery are computed.
3. Confirm recovery sequence is scheduled.
4. Confirm worker leases sequence and triggers designated recovery action (e.g. Payment Link or Smart Retry).
5. Confirm audit log records full cryptographic event trace in `/dashboard/audit`.
