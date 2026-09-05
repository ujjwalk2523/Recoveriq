# RecoverIQ

> **Autonomous AI Revenue Recovery Infrastructure for Razorpay**  
> *Built for the **Razorpay Build AI Hackathon** — **Track 3: AI Revenue Recovery***

[![Razorpay Hackathon](https://img.shields.io/badge/Razorpay_Build_AI-Track_3:_AI_Revenue_Recovery-0C2340?style=for-the-badge&logo=razorpay&logoColor=3395FF)](https://razorpay.com)
[![Next.js 15](https://img.shields.io/badge/Next.js_15-App_Router-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict_Mode-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-PostgreSQL-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

---

## 📌 Executive Summary

In India's fast-growing digital economy, **15% to 25% of subscription, recurring, and checkout transactions fail** due to temporary bank downtimes, UPI daily debit caps, 3D-Secure timeouts, or network latency. 

Most payment gateways handle this with **"blind retries"** — retrying payments repeatedly at arbitrary hours. This leads to:
* 📉 **Severe Customer Fatigue:** Repeated SMS/OTP alerts annoy customers.
* 🚨 **Bank Fraud Flags:** Blind retries trigger issuing bank risk throttles.
* 💸 **Involuntary Churn & Margin Loss:** Merchants lose billions in ARR and pay unnecessary gateway decline fees.

**RecoverIQ** replaces brute-force retries with an **Autonomous AI Decision Engine**. It models every failed payment as an **Expected Value (EV) optimization problem** — determining whether to trigger a zero-delay silent retry, send an interactive WhatsApp 1-tap recovery link, or suppress recovery to protect customer trust — all while strictly governed by merchant policy guardrails.

---

## 🏆 Razorpay Build AI Hackathon — Track 3 Fit

RecoverIQ is purpose-built for **Track 3: AI Revenue Recovery**:
1. **Direct Razorpay Webhook Ingestion:** Ingests live `payment.failed`, `payment.captured`, and `order.paid` events.
2. **Deterministic Financial Realism:** Calculates Net Expected Value (EV) by deducting intervention costs and customer fatigue penalties.
3. **Frictionless Customer Experience:** Deploys dynamic 1-Tap Recovery checkout pages with UPI intent deep links delivered via Meta WhatsApp Business Cloud API.
4. **Merchant Safety & Policy Guardrails:** AI *recommends*, but Merchant Policy *authorizes*. Auto-approval ceilings, VIP manual holds, and quiet-hour blackouts keep the merchant in full control.
5. **Closed-Loop Reinforcement:** Real transaction outcomes continuously train an online **Bayesian Multi-Armed Bandit** to optimize retry timing and channel yields dynamically.

---

## 🧠 The AI & Decision Engine Architecture

RecoverIQ uses a hybrid architecture combining **Supervised ML Classification**, **Expected Value Optimization**, and **Online Reinforcement Learning**:

```
[ Incoming Razorpay payment.failed Webhook ]
                     ⬇
   ┌───────────────────────────────────┐
   │    8-Stage Decision Lifecycle     │
   ├───────────────────────────────────┤
   │ 1. DETECT    → Extract metadata   │
   │ 2. DIAGNOSE  → Root cause class   │
   │ 3. PREDICT   → ML Probability     │
   │ 4. SIMULATE  → Net EV calculation │
   │ 5. OPTIMIZE  → Strategy Ranking   │
   │ 6. APPROVE   → Policy Guardrails  │
   │ 7. EXECUTE   → Channel Dispatch   │
   │ 8. MEASURE   → Telemetry Tracking │
   └───────────────────────────────────┘
                     ⬇
   ┌───────────────────────────────────┐
   │       Execution Dispatch          │
   ├─────────────────┬─────────────────┤
   │ WhatsApp 1-Tap  │ Silent Gateway  │
   │ Recovery Link   │ Zero-Delay Retry│
   └─────────────────┴─────────────────┘
                     ⬇
[ Customer Recovers ➡️ Status Flips to SETTLED ➡️ Bayesian Prior Updated ]
```

### 1. Supervised Machine Learning Classifier
* **Algorithm:** Binary Logistic Regression with Mini-Batch Gradient Descent and $L_2$ (Ridge) Regularization.
* **Leakage-Free Dataset:** Trained on 10,000+ realistic payment transactions using a strict **80/20 Chronological Split** (past 80% train, future 20% test) to prevent temporal lookahead bias.
* **Feature Engineering:** Standard Z-score scaling for numerical signals (amount, past attempts, customer LTV) and one-hot encoding for categorical signals (payment method, bank code, gateway).
* **Statistical Performance:**
  * **Accuracy:** 85.4%
  * **ROC-AUC:** 0.872 (Evaluated using the trapezoidal rule over sorted probability thresholds)
  * **Calibrated Metrics:** Rigorously optimized on **Brier Score (0.12)** and **Log-Loss** to ensure output probabilities represent true empirical success rates.

### 2. Expected Value (EV) Formulation
RecoverIQ never executes a recovery action unless the Net Expected Value is positive:
$$\text{Net EV} = (P_{\text{recovery}} \times \text{Transaction Amount}) - \text{Intervention Cost} - \text{Customer Fatigue Penalty}$$

* **Intervention Cost:** Meta WhatsApp conversation fees (~₹1.50) vs Gateway retry costs (~₹0.10).
* **Customer Fatigue Penalty:** Evaluated dynamically based on customer touchpoint frequency over the last 7 days.

### 3. Continuous Online Learning (Bayesian Multi-Armed Bandit)
* Implements **Contextual Thompson Sampling** across candidate recovery channels (`WHATSAPP_NUDGE`, `IMMEDIATE_RETRY`, `OPTIMAL_DELAYED_RETRY`, `PAYMENT_LINK`).
* On every payment success/failure callback, the `LearningOrchestrator` updates customer responsiveness profiles and Beta distributions in real time without downtime or manual model retraining.

### 4. Merchant Policy Guardrails (Human-in-the-Loop Safety)
* **Auto-Approval Ceilings:** Transactions below the threshold (e.g., ₹30,000) are cleared autonomously; higher transactions hold for operator review.
* **VIP Account Protection:** Automatically routes high-LTV accounts to white-glove concierges if flagged.
* **Dispute & Fraud Blockades:** Hard suppression if the customer's fraud risk score exceeds 60/100.
* **Quiet-Hours Blackout:** Automatically delays customer notifications during night hours (10:00 PM – 08:00 AM IST).

---

## ⚡ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 15](https://nextjs.org/) (App Router, Server Actions, Edge Routes) |
| **Frontend UI** | [React 19](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/), Canvas-Confetti |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (Strict mode, complete end-to-end typing) |
| **Database & ORM** | [PostgreSQL 15+](https://www.postgresql.org/), [Prisma ORM](https://www.prisma.io/) |
| **Queue & Cache** | [Redis 7+](https://redis.io/) (Distributed leases, state-machine queue rebuilds) |
| **Payment Rails** | [Razorpay Gateway API](https://razorpay.com/docs/api/) & Webhook Engine |
| **Messaging** | Meta WhatsApp Business Cloud API Adapter, Dynamic Multi-Rail Links |
| **Compliance & Audit** | Immutable append-only audit trail with SHA-256 cryptographic chaining |

---

## 🎬 Live Demo & Testing Guide

You can test the entire recovery flow in under 2 minutes:

### 1. Generating & Failing a Payment (Razorpay Test Mode)
1. Open the checkout or payment link.
2. Enter the official Razorpay test card:
   * **Card Number:** `4111 1111 1111 1111` *(Visa Domestic Test Card)*
   * **Expiry:** `12/28` (or any future date)
   * **CVV:** `123`
   * **Name:** `Ujjwal Kumar`
3. Click **Pay**. On the Razorpay Mock Bank page, click the red **Failure** button.
   *(Alternatively, use UPI and enter UPI ID: `failure@razorpay` to decline instantly).*

### 2. Real-Time Autonomous Ingestion
1. Switch to the **RecoverIQ Dashboard** ➡️ **Transactions** tab.
2. The transaction appears at the top marked **`In flight`** with **Review Required: 0**.
3. Click the transaction to view the **8-Stage Decision Trace**:
   * ML predicted recovery probability (>84%).
   * AI selected **WhatsApp 1-Tap Nudge**.
   * Policy guardrail cleared auto-approval under the ₹30,000 threshold.

### 3. Customer 1-Tap Recovery Link
1. In the transaction drawer, navigate to **Customer 1-Tap Recovery Link**.
2. Click **WhatsApp** to dispatch the message or **Open Customer Pay Page**.
3. The customer sees a mobile-friendly checkout page (`/pay/[id]`).

### 4. Instant Settlement
1. Click **Pay ₹2,500** on the recovery page.
2. Confetti triggers, marking the payment as recovered.
3. Refresh RecoverIQ: the status updates from **`In flight` ➡️ `Settled (RECOVERED)`**.
4. Recovered revenue is added to the merchant ledger and stamped in the **Audit Log** with SHA-256 integrity verification.

---

## 🚀 Getting Started Locally

### Prerequisites
* **Node.js:** 20.x or higher
* **Package Manager:** npm or pnpm
* **PostgreSQL:** 15+
* **Redis:** 7+ (Optional for local demo mode)

### 1. Clone & Install
```bash
git clone https://github.com/ujjwalk2523/Recoveriq.git
cd Recoveriq
npm install
```

### 2. Configure Environment Variables
Copy the example environment file:
```bash
cp .env.example .env
```

Set your Razorpay test credentials in `.env`:
```env
NEXT_PUBLIC_APP_URL="http://localhost:3000"
RAZORPAY_KEY_ID="rzp_test_recoveriq_demo"
RAZORPAY_KEY_SECRET="your_razorpay_secret"
DATABASE_URL="postgresql://user:password@localhost:5432/recoveriq"
```

### 3. Database Setup & Seeding
```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Key Directory Structure

```
recoveriq/
├── src/
│   ├── app/                      # Next.js 15 App Router pages & APIs
│   │   ├── dashboard/            # Executive KPI & Revenue Analytics
│   │   ├── transactions/         # Live Recovery Ledger & Drawer
│   │   ├── pay/[id]/             # Customer 1-Tap Checkout Recovery Page
│   │   ├── settings/             # Merchant Policy Guardrails Configuration
│   │   ├── simulator/            # CFO Recovery & Cost Simulator
│   │   └── api/webhooks/razorpay # Webhook Ingestion Pipeline
│   ├── components/               # Production UI components
│   ├── lib/
│   │   ├── ml/                   # Machine Learning & Bandit Engines
│   │   │   ├── logistic-regression.ts   # Mini-Batch GD Classifier
│   │   │   ├── training-pipeline.ts     # 80/20 Chronological Pipeline
│   │   │   ├── evaluator.ts             # AUC, F1, Brier Score Metrics
│   │   │   └── bandit/                  # Thompson Sampling Multi-Armed Bandit
│   │   ├── engine/               # 8-Stage Decision Intelligence & Policy
│   │   ├── adapters/             # WhatsApp, Razorpay, and Payment Link Adapters
│   │   └── razorpay/             # Razorpay API Client & Webhook Verifier
└── scripts/                      # Test suites & ML validation scripts
```

---

## 🔒 Security, Compliance & Governance

* **Zero Duplicate Payments:** Compound tenant-scoped idempotency keys (`idemp_{merchantId}_{txId}_{seqId}_{step}`) prevent accidental double-charges.
* **Immutable Audit Trail:** All decisions, overrides, and dispatches are hashed sequentially with SHA-256 for complete auditability.
* **Money Safety:** Monetary amounts are strictly validated and handled in integer paise to eliminate floating-point arithmetic errors.
* **Tenant Isolation:** Data access is strictly partitioned at the datastore layer using merchant-scoped tenant contexts.

---

## 👥 Authors & Team

Built with ❤️ for the **Razorpay Build AI Hackathon 2026** (Track 3: AI Revenue Recovery).

* **Project Lead / Developer:** Ujjwal Kumar ([@ujjwalk2523](https://github.com/ujjwalk2523))
* **Repository:** [https://github.com/ujjwalk2523/Recoveriq](https://github.com/ujjwalk2523/Recoveriq)
