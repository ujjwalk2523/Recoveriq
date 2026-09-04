-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'ANALYST', 'OPERATOR');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "UserAccountStatus" AS ENUM ('ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "MfaType" AS ENUM ('TOTP');

-- CreateEnum
CREATE TYPE "AuthMethod" AS ENUM ('PASSWORD', 'MFA_TOTP', 'MFA_RECOVERY_CODE', 'SSO_OIDC', 'SSO_SAML');

-- CreateEnum
CREATE TYPE "IdentityProviderType" AS ENUM ('OIDC', 'SAML');

-- CreateEnum
CREATE TYPE "IdpStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DomainVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REVOKED');

-- CreateEnum
CREATE TYPE "DomainVerificationType" AS ENUM ('DNS_TXT');

-- CreateEnum
CREATE TYPE "AuthTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'EMAIL_CHANGE', 'STEP_UP');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('UPI', 'CARD', 'NETBANKING', 'MANDATE', 'WALLET');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('FAILED', 'RECOVERED', 'RECOVERING', 'NEEDS_APPROVAL', 'SUPPRESSED', 'ABANDONED', 'SUCCESS');

-- CreateEnum
CREATE TYPE "FailureCategory" AS ENUM ('TECHNICAL', 'INSUFFICIENT_FUNDS', 'AUTHENTICATION', 'EXPIRED_OR_INVALID', 'RISK_AND_FRAUD', 'CUSTOMER_DROPOUT', 'MANDATE_ISSUE');

-- CreateEnum
CREATE TYPE "RecoveryActionType" AS ENUM ('IMMEDIATE_RETRY', 'OPTIMAL_DELAYED_RETRY', 'WHATSAPP_NUDGE', 'PAYMENT_LINK', 'MANDATE_UPDATE', 'HUMAN_ESCALATION', 'DO_NOT_RECOVER');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('STARTER', 'GROWTH', 'SCALE', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'CANCELLED', 'SUSPENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('INITIATED', 'DISPATCHED', 'DELIVERED', 'CLICKED', 'PAID', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ModelType" AS ENUM ('CLASSIFICATION', 'RECOMMENDATION', 'MULTI_ARMED_BANDIT');

-- CreateEnum
CREATE TYPE "UsageMetric" AS ENUM ('TRANSACTIONS_PROCESSED', 'RECOVERY_ATTEMPTS', 'API_REQUESTS', 'PAYMENT_LINKS_CREATED', 'WHATSAPP_MESSAGES', 'RECOVERED_TRANSACTIONS', 'RECOVERED_REVENUE');

-- CreateEnum
CREATE TYPE "ApiKeyEnvironment" AS ENUM ('TEST', 'LIVE');

-- CreateEnum
CREATE TYPE "WebhookEndpointStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERING', 'DELIVERED', 'RETRYING', 'FAILED', 'DEAD_LETTER', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'PAST_DUE', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "InvoiceLineItemType" AS ENUM ('BASE_SUBSCRIPTION', 'OVERAGE', 'ADD_ON', 'CREDIT', 'DISCOUNT', 'TAX');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'OPERATOR',
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3),
    "invitedBy" TEXT,
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OPERATOR',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "TeamStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "organizationMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "businessType" TEXT NOT NULL DEFAULT 'SAAS',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantUser" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "environment" "ApiKeyEnvironment" NOT NULL DEFAULT 'TEST',
    "scopes" JSONB NOT NULL,
    "createdBy" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiRequestLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "environment" "ApiKeyEnvironment" NOT NULL DEFAULT 'TEST',
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "scope" TEXT,
    "statusCode" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiIdempotencyRecord" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "monthlyPriceMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "includedTransactions" INTEGER NOT NULL,
    "includedRecoveryAttempts" INTEGER NOT NULL,
    "includedApiRequests" INTEGER NOT NULL,
    "features" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "planId" TEXT,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'STARTER',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "provider" TEXT NOT NULL DEFAULT 'INTERNAL',
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionEvent" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousPlan" TEXT,
    "newPlan" TEXT,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "actor" TEXT NOT NULL DEFAULT 'SYSTEM',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageLedgerEntry" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "metric" "UsageMetric" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'COUNT',
    "amountMinor" BIGINT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCorrection" BOOLEAN NOT NULL DEFAULT false,
    "originalEntryId" TEXT,
    "correctionReason" TEXT,

    CONSTRAINT "UsageLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "recoveredAmountINR" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "apiCallsCount" INTEGER NOT NULL DEFAULT 0,
    "recoveryAttemptsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "segment" TEXT NOT NULL DEFAULT 'CONSUMER',
    "lifetimeValue" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalTransactions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerRecoveryProfile" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "pastRecoveries" INTEGER NOT NULL DEFAULT 0,
    "fatigueScore" INTEGER NOT NULL DEFAULT 0,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "upiVpa" TEXT,
    "cardLast4" TEXT,
    "cardBrand" TEXT,
    "bankName" TEXT,
    "preferredChannel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "totalFailedPayments" INTEGER NOT NULL DEFAULT 0,
    "totalRecoveredPayments" INTEGER NOT NULL DEFAULT 0,
    "totalRecoveryAttempts" INTEGER NOT NULL DEFAULT 0,
    "recoveryRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "avgRecoveryDelayMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "lastSuccessfulStrategy" TEXT,
    "lastSuccessfulDelayMinutes" DOUBLE PRECISION,
    "upiRecoveryRate" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "cardRecoveryRate" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "linkConversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "whatsappConversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "retryConversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "behavioralSegment" TEXT NOT NULL DEFAULT 'NEW_CUSTOMER',
    "strategySuccessCounts" JSONB,
    "strategyFailureCounts" JSONB,
    "evidenceLevel" TEXT NOT NULL DEFAULT 'LOW',
    "lastRecoveryAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerRecoveryProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'FAILED',
    "failureCode" TEXT NOT NULL,
    "failureMessage" TEXT NOT NULL,
    "failureCategory" "FailureCategory" NOT NULL,
    "rawGatewayResponse" JSONB,
    "recoveryProbability" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "expectedRecoveryValue" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "recommendedAction" "RecoveryActionType" NOT NULL,
    "actionConfidence" INTEGER NOT NULL DEFAULT 80,
    "aiRationale" TEXT NOT NULL,
    "whyNotRationale" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvalReason" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "executionChannel" TEXT,
    "executionStatus" TEXT,
    "recoveredAt" TIMESTAMP(3),
    "recoveredAmount" DOUBLE PRECISION,
    "dataSource" TEXT NOT NULL DEFAULT 'RAZORPAY_TEST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "gatewayErrorCode" TEXT,
    "gatewayErrorMessage" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "recommendedAction" "RecoveryActionType" NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "recoveryProbability" DOUBLE PRECISION NOT NULL,
    "expectedRecoveryValue" DOUBLE PRECISION NOT NULL,
    "modelId" TEXT,
    "rationale" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionTrace" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionTrace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryAttempt" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "sequenceId" TEXT,
    "stepId" INTEGER,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "actionType" "RecoveryActionType" NOT NULL,
    "channel" TEXT NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'INITIATED',
    "provider" TEXT DEFAULT 'RAZORPAY',
    "providerReference" TEXT,
    "idempotencyKey" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "recoveredAmount" DOUBLE PRECISION,
    "cost" DOUBLE PRECISION DEFAULT 0.0,
    "outcome" TEXT,
    "gatewayPaymentId" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "banditDecisionId" TEXT,
    "banditAction" TEXT,
    "banditModelVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyGuardrails" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "autoApproveMaxAmount" DOUBLE PRECISION NOT NULL DEFAULT 15000,
    "minConfidenceForAutoApprove" INTEGER NOT NULL DEFAULT 80,
    "maxCustomerFatigueThreshold" INTEGER NOT NULL DEFAULT 70,
    "maxRetriesPerCustomerPerWeek" INTEGER NOT NULL DEFAULT 3,
    "disputeRiskBlockThreshold" INTEGER NOT NULL DEFAULT 60,
    "allowAutomatedWhatsApp" BOOLEAN NOT NULL DEFAULT true,
    "allowAutomatedPaymentLinks" BOOLEAN NOT NULL DEFAULT true,
    "humanApprovalForVIPs" BOOLEAN NOT NULL DEFAULT true,
    "nightHoursRetrySilence" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyGuardrails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryExperiment" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "totalTraffic" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "controlArm" JSONB NOT NULL,
    "variantArms" JSONB NOT NULL,
    "insights" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "merchantId" TEXT,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "merchantId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorId" TEXT,
    "actorDisplayName" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'SYSTEM',
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "result" TEXT NOT NULL DEFAULT 'SUCCESS',
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "details" TEXT NOT NULL DEFAULT '',
    "requestId" TEXT,
    "sessionId" TEXT,
    "ipHash" TEXT,
    "userAgentSummary" TEXT,
    "metadata" TEXT,
    "previousState" TEXT,
    "newState" TEXT,
    "sequenceNumber" INTEGER,
    "eventHash" TEXT,
    "previousEventHash" TEXT,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "integrityHash" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIModelVersion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "modelType" "ModelType" NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BanditDecision" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "contextSnapshot" JSONB NOT NULL,
    "candidateActions" TEXT[],
    "selectedAction" TEXT NOT NULL,
    "selectionMode" TEXT NOT NULL,
    "actionScores" JSONB NOT NULL,
    "expectedReward" DOUBLE PRECISION NOT NULL,
    "explorationProbability" DOUBLE PRECISION NOT NULL,
    "actualReward" DOUBLE PRECISION,
    "outcome" TEXT,
    "recoveredAmount" DOUBLE PRECISION,
    "modelVersion" TEXT NOT NULL DEFAULT 'bandit-v1.0',
    "algorithm" TEXT NOT NULL DEFAULT 'CONTEXTUAL_THOMPSON_SAMPLING',
    "policyDecision" TEXT,
    "policyReason" TEXT,
    "dataSource" TEXT NOT NULL DEFAULT 'RAZORPAY_TEST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "BanditDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantRecoveryIntelligence" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "totalFailedPayments" INTEGER NOT NULL DEFAULT 0,
    "totalRecoveredPayments" INTEGER NOT NULL DEFAULT 0,
    "recoveryRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalRecoveryRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalRecoveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalNetRecoveryRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "averageReward" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "bestStrategy" TEXT,
    "bestTimingBucket" TEXT,
    "strategyPerformance" JSONB,
    "timingPerformance" JSONB,
    "failureCategoryPerformance" JSONB,
    "paymentMethodPerformance" JSONB,
    "amountBandPerformance" JSONB,
    "customerSegmentPerformance" JSONB,
    "intelligenceQuality" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "evidenceLevel" TEXT NOT NULL DEFAULT 'LOW',
    "coldStart" BOOLEAN NOT NULL DEFAULT true,
    "coldStartReason" TEXT DEFAULT 'Insufficient historical recovery observations (<30 samples).',
    "modelVersion" TEXT NOT NULL DEFAULT 'RecoverIQ-Intelligence-v1.0',
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantRecoveryIntelligence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryLearningEvent" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "customerId" TEXT,
    "banditDecisionId" TEXT,
    "strategy" TEXT NOT NULL,
    "timingBucket" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "failureCategory" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "recoveredAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "recoveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "fatiguePenalty" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "riskPenalty" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "reward" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "outcome" TEXT NOT NULL,
    "recoveryDelayMinutes" DOUBLE PRECISION,
    "dataSource" TEXT NOT NULL DEFAULT 'RAZORPAY_TEST',
    "modelVersion" TEXT NOT NULL DEFAULT 'RecoverIQ-Intelligence-v1.0',
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryLearningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryIntelligenceAnomaly" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "anomalyType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "previousValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "explanation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryIntelligenceAnomaly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "secretHash" TEXT NOT NULL,
    "subscribedEvents" JSONB NOT NULL,
    "status" "WebhookEndpointStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastDeliveryAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoverIQEvent" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoverIQEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEventDelivery" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "latencyMs" INTEGER,
    "nextRetryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEventDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "providerInvoiceId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotalMinor" INTEGER NOT NULL,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "discountMinor" INTEGER NOT NULL DEFAULT 0,
    "overageMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL,
    "amountPaidMinor" INTEGER NOT NULL DEFAULT 0,
    "amountDueMinor" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "isTestMode" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "type" "InvoiceLineItemType" NOT NULL DEFAULT 'BASE_SUBSCRIPTION',
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceMinor" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "metric" TEXT,
    "usageMeasured" INTEGER,
    "usageIncluded" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "status" "UserAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'bcrypt',
    "salt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMfa" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mfaType" "MfaType" NOT NULL DEFAULT 'TOTP',
    "encryptedSecret" TEXT NOT NULL,
    "secretIv" TEXT NOT NULL,
    "secretTag" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "recoveryCodeHashes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMfa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgentSummary" TEXT,
    "organizationId" TEXT,
    "authMethod" "AuthMethod" NOT NULL DEFAULT 'PASSWORD',
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserExternalIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "IdentityProviderType" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "email" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserExternalIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationIdentityProvider" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "providerType" "IdentityProviderType" NOT NULL DEFAULT 'OIDC',
    "status" "IdpStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuer" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "encryptedClientSecret" TEXT,
    "clientSecretIv" TEXT,
    "clientSecretTag" TEXT,
    "authorizationEndpoint" TEXT,
    "tokenEndpoint" TEXT,
    "userinfoEndpoint" TEXT,
    "jwksUri" TEXT,
    "metadata" JSONB,
    "allowedDomains" JSONB,
    "enforceSso" BOOLEAN NOT NULL DEFAULT false,
    "jitEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultRole" "Role" NOT NULL DEFAULT 'OPERATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationIdentityProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationDomain" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "verificationTokenHash" TEXT NOT NULL,
    "verificationType" "DomainVerificationType" NOT NULL DEFAULT 'DNS_TXT',
    "status" "DomainVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthVerificationToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceEvidencePackage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "packageType" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "auditChainStatus" TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
    "checkedAuditEvents" INTEGER NOT NULL DEFAULT 0,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "sourceCounts" JSONB NOT NULL,
    "packageHash" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "generatorVersion" TEXT NOT NULL DEFAULT 'RecoverIQ-Evidence-v1.0',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceEvidencePackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceEvidenceItem" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceEvidenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernancePolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "effect" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernancePolicyHistory" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "effect" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernancePolicyHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupMetadata" (
    "id" TEXT NOT NULL,
    "backupId" TEXT NOT NULL,
    "databaseIdentifier" TEXT NOT NULL,
    "backupType" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "sizeBytes" BIGINT NOT NULL DEFAULT 0,
    "checksum" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "retentionClass" TEXT NOT NULL DEFAULT 'STANDARD_30D',
    "verifiedAt" TIMESTAMP(3),
    "sourceEnvironment" TEXT NOT NULL DEFAULT 'production',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestoreVerificationRecord" (
    "id" TEXT NOT NULL,
    "backupId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'isolated_verification',
    "status" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "checksPassCount" INTEGER NOT NULL DEFAULT 0,
    "checksTotalCount" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestoreVerificationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookReconciliationRecord" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "providerReference" TEXT NOT NULL,
    "expectedEvent" TEXT NOT NULL,
    "observedEvent" TEXT,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookReconciliationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReconciliationRecord" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "providerReference" TEXT,
    "providerStatus" TEXT,
    "localStatus" TEXT NOT NULL,
    "reconciliationOutcome" TEXT NOT NULL,
    "reconciledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReconciliationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationId_idx" ON "OrganizationMember"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE INDEX "OrganizationMember_email_idx" ON "OrganizationMember"("email");

-- CreateIndex
CREATE INDEX "OrganizationMember_status_idx" ON "OrganizationMember"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationInvitation_tokenHash_key" ON "OrganizationInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "OrganizationInvitation_organizationId_idx" ON "OrganizationInvitation"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationInvitation_email_idx" ON "OrganizationInvitation"("email");

-- CreateIndex
CREATE INDEX "OrganizationInvitation_tokenHash_idx" ON "OrganizationInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "OrganizationInvitation_expiresAt_idx" ON "OrganizationInvitation"("expiresAt");

-- CreateIndex
CREATE INDEX "Team_organizationId_idx" ON "Team"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_organizationId_slug_key" ON "Team"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

-- CreateIndex
CREATE INDEX "TeamMember_organizationMemberId_idx" ON "TeamMember"("organizationMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_organizationMemberId_key" ON "TeamMember"("teamId", "organizationMemberId");

-- CreateIndex
CREATE INDEX "Merchant_name_idx" ON "Merchant"("name");

-- CreateIndex
CREATE INDEX "Merchant_organizationId_idx" ON "Merchant"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantUser_email_key" ON "MerchantUser"("email");

-- CreateIndex
CREATE INDEX "MerchantUser_merchantId_idx" ON "MerchantUser"("merchantId");

-- CreateIndex
CREATE INDEX "MerchantUser_email_idx" ON "MerchantUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_secretHash_key" ON "ApiKey"("secretHash");

-- CreateIndex
CREATE INDEX "ApiKey_merchantId_idx" ON "ApiKey"("merchantId");

-- CreateIndex
CREATE INDEX "ApiKey_prefix_idx" ON "ApiKey"("prefix");

-- CreateIndex
CREATE INDEX "ApiKey_environment_idx" ON "ApiKey"("environment");

-- CreateIndex
CREATE UNIQUE INDEX "ApiRequestLog_requestId_key" ON "ApiRequestLog"("requestId");

-- CreateIndex
CREATE INDEX "ApiRequestLog_merchantId_idx" ON "ApiRequestLog"("merchantId");

-- CreateIndex
CREATE INDEX "ApiRequestLog_apiKeyId_idx" ON "ApiRequestLog"("apiKeyId");

-- CreateIndex
CREATE INDEX "ApiRequestLog_createdAt_idx" ON "ApiRequestLog"("createdAt");

-- CreateIndex
CREATE INDEX "ApiRequestLog_requestId_idx" ON "ApiRequestLog"("requestId");

-- CreateIndex
CREATE INDEX "ApiIdempotencyRecord_merchantId_idx" ON "ApiIdempotencyRecord"("merchantId");

-- CreateIndex
CREATE INDEX "ApiIdempotencyRecord_expiresAt_idx" ON "ApiIdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiIdempotencyRecord_merchantId_idempotencyKey_key" ON "ApiIdempotencyRecord"("merchantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE INDEX "Plan_code_idx" ON "Plan"("code");

-- CreateIndex
CREATE INDEX "Subscription_merchantId_idx" ON "Subscription"("merchantId");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_subscriptionId_idx" ON "SubscriptionEvent"("subscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_merchantId_idx" ON "SubscriptionEvent"("merchantId");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_createdAt_idx" ON "SubscriptionEvent"("createdAt");

-- CreateIndex
CREATE INDEX "UsageLedgerEntry_merchantId_metric_occurredAt_idx" ON "UsageLedgerEntry"("merchantId", "metric", "occurredAt");

-- CreateIndex
CREATE INDEX "UsageLedgerEntry_merchantId_periodStart_periodEnd_idx" ON "UsageLedgerEntry"("merchantId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "UsageLedgerEntry_subscriptionId_idx" ON "UsageLedgerEntry"("subscriptionId");

-- CreateIndex
CREATE INDEX "UsageLedgerEntry_occurredAt_idx" ON "UsageLedgerEntry"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "UsageLedgerEntry_merchantId_idempotencyKey_key" ON "UsageLedgerEntry"("merchantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "UsageRecord_merchantId_idx" ON "UsageRecord"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageRecord_merchantId_month_key" ON "UsageRecord"("merchantId", "month");

-- CreateIndex
CREATE INDEX "Customer_merchantId_idx" ON "Customer"("merchantId");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerRecoveryProfile_customerId_key" ON "CustomerRecoveryProfile"("customerId");

-- CreateIndex
CREATE INDEX "Transaction_merchantId_idx" ON "Transaction"("merchantId");

-- CreateIndex
CREATE INDEX "Transaction_customerId_idx" ON "Transaction"("customerId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentEvent_transactionId_idx" ON "PaymentEvent"("transactionId");

-- CreateIndex
CREATE INDEX "Decision_transactionId_idx" ON "Decision"("transactionId");

-- CreateIndex
CREATE INDEX "DecisionTrace_decisionId_idx" ON "DecisionTrace"("decisionId");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryAttempt_idempotencyKey_key" ON "RecoveryAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RecoveryAttempt_transactionId_idx" ON "RecoveryAttempt"("transactionId");

-- CreateIndex
CREATE INDEX "RecoveryAttempt_status_idx" ON "RecoveryAttempt"("status");

-- CreateIndex
CREATE INDEX "RecoveryAttempt_sequenceId_idx" ON "RecoveryAttempt"("sequenceId");

-- CreateIndex
CREATE INDEX "RecoveryAttempt_idempotencyKey_idx" ON "RecoveryAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RecoveryAttempt_banditDecisionId_idx" ON "RecoveryAttempt"("banditDecisionId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyGuardrails_merchantId_key" ON "PolicyGuardrails"("merchantId");

-- CreateIndex
CREATE INDEX "RecoveryExperiment_merchantId_idx" ON "RecoveryExperiment"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_merchantId_idx" ON "WebhookEvent"("merchantId");

-- CreateIndex
CREATE INDEX "WebhookEvent_source_eventType_idx" ON "WebhookEvent"("source", "eventType");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_sequenceNumber_idx" ON "AuditLog"("organizationId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_occurredAt_idx" ON "AuditLog"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_action_idx" ON "AuditLog"("organizationId", "action");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_category_idx" ON "AuditLog"("organizationId", "category");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_actorId_idx" ON "AuditLog"("organizationId", "actorId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_resourceType_resourceId_idx" ON "AuditLog"("organizationId", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_merchantId_idx" ON "AuditLog"("organizationId", "merchantId");

-- CreateIndex
CREATE INDEX "AuditLog_merchantId_idx" ON "AuditLog"("merchantId");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "AIModelVersion_version_key" ON "AIModelVersion"("version");

-- CreateIndex
CREATE INDEX "BanditDecision_merchantId_idx" ON "BanditDecision"("merchantId");

-- CreateIndex
CREATE INDEX "BanditDecision_transactionId_idx" ON "BanditDecision"("transactionId");

-- CreateIndex
CREATE INDEX "BanditDecision_selectedAction_idx" ON "BanditDecision"("selectedAction");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantRecoveryIntelligence_merchantId_key" ON "MerchantRecoveryIntelligence"("merchantId");

-- CreateIndex
CREATE INDEX "MerchantRecoveryIntelligence_merchantId_idx" ON "MerchantRecoveryIntelligence"("merchantId");

-- CreateIndex
CREATE INDEX "RecoveryLearningEvent_merchantId_idx" ON "RecoveryLearningEvent"("merchantId");

-- CreateIndex
CREATE INDEX "RecoveryLearningEvent_transactionId_idx" ON "RecoveryLearningEvent"("transactionId");

-- CreateIndex
CREATE INDEX "RecoveryLearningEvent_customerId_idx" ON "RecoveryLearningEvent"("customerId");

-- CreateIndex
CREATE INDEX "RecoveryLearningEvent_strategy_idx" ON "RecoveryLearningEvent"("strategy");

-- CreateIndex
CREATE INDEX "RecoveryLearningEvent_outcome_idx" ON "RecoveryLearningEvent"("outcome");

-- CreateIndex
CREATE INDEX "RecoveryLearningEvent_createdAt_idx" ON "RecoveryLearningEvent"("createdAt");

-- CreateIndex
CREATE INDEX "RecoveryIntelligenceAnomaly_merchantId_idx" ON "RecoveryIntelligenceAnomaly"("merchantId");

-- CreateIndex
CREATE INDEX "RecoveryIntelligenceAnomaly_severity_idx" ON "RecoveryIntelligenceAnomaly"("severity");

-- CreateIndex
CREATE INDEX "RecoveryIntelligenceAnomaly_status_idx" ON "RecoveryIntelligenceAnomaly"("status");

-- CreateIndex
CREATE INDEX "RecoveryIntelligenceAnomaly_detectedAt_idx" ON "RecoveryIntelligenceAnomaly"("detectedAt");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_merchantId_idx" ON "WebhookEndpoint"("merchantId");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_merchantId_status_idx" ON "WebhookEndpoint"("merchantId", "status");

-- CreateIndex
CREATE INDEX "RecoverIQEvent_merchantId_idx" ON "RecoverIQEvent"("merchantId");

-- CreateIndex
CREATE INDEX "RecoverIQEvent_merchantId_type_idx" ON "RecoverIQEvent"("merchantId", "type");

-- CreateIndex
CREATE INDEX "RecoverIQEvent_merchantId_createdAt_idx" ON "RecoverIQEvent"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "RecoverIQEvent_aggregateType_aggregateId_idx" ON "RecoverIQEvent"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "WebhookEventDelivery_merchantId_idx" ON "WebhookEventDelivery"("merchantId");

-- CreateIndex
CREATE INDEX "WebhookEventDelivery_endpointId_idx" ON "WebhookEventDelivery"("endpointId");

-- CreateIndex
CREATE INDEX "WebhookEventDelivery_eventId_idx" ON "WebhookEventDelivery"("eventId");

-- CreateIndex
CREATE INDEX "WebhookEventDelivery_status_idx" ON "WebhookEventDelivery"("status");

-- CreateIndex
CREATE INDEX "WebhookEventDelivery_nextRetryAt_idx" ON "WebhookEventDelivery"("nextRetryAt");

-- CreateIndex
CREATE INDEX "WebhookEventDelivery_createdAt_idx" ON "WebhookEventDelivery"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEventDelivery_merchantId_endpointId_eventId_key" ON "WebhookEventDelivery"("merchantId", "endpointId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_merchantId_idx" ON "Invoice"("merchantId");

-- CreateIndex
CREATE INDEX "Invoice_subscriptionId_idx" ON "Invoice"("subscriptionId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_periodStart_periodEnd_idx" ON "Invoice"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_merchantId_periodStart_periodEnd_invoiceNumber_key" ON "Invoice"("merchantId", "periodStart", "periodEnd", "invoiceNumber");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON "InvoiceLineItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailNormalized_key" ON "User"("emailNormalized");

-- CreateIndex
CREATE INDEX "User_emailNormalized_idx" ON "User"("emailNormalized");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "UserCredential_userId_idx" ON "UserCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserMfa_userId_key" ON "UserMfa"("userId");

-- CreateIndex
CREATE INDEX "UserMfa_userId_idx" ON "UserMfa"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX "UserSession_tokenHash_idx" ON "UserSession"("tokenHash");

-- CreateIndex
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

-- CreateIndex
CREATE INDEX "UserSession_revokedAt_idx" ON "UserSession"("revokedAt");

-- CreateIndex
CREATE INDEX "UserExternalIdentity_userId_idx" ON "UserExternalIdentity"("userId");

-- CreateIndex
CREATE INDEX "UserExternalIdentity_email_idx" ON "UserExternalIdentity"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserExternalIdentity_provider_providerUserId_key" ON "UserExternalIdentity"("provider", "providerUserId");

-- CreateIndex
CREATE INDEX "OrganizationIdentityProvider_organizationId_idx" ON "OrganizationIdentityProvider"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationIdentityProvider_issuer_idx" ON "OrganizationIdentityProvider"("issuer");

-- CreateIndex
CREATE INDEX "OrganizationDomain_organizationId_idx" ON "OrganizationDomain"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationDomain_domain_idx" ON "OrganizationDomain"("domain");

-- CreateIndex
CREATE INDEX "OrganizationDomain_status_idx" ON "OrganizationDomain"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationDomain_organizationId_domain_key" ON "OrganizationDomain"("organizationId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "AuthVerificationToken_tokenHash_key" ON "AuthVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthVerificationToken_tokenHash_idx" ON "AuthVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthVerificationToken_userId_idx" ON "AuthVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "AuthVerificationToken_email_idx" ON "AuthVerificationToken"("email");

-- CreateIndex
CREATE INDEX "AuthVerificationToken_type_idx" ON "AuthVerificationToken"("type");

-- CreateIndex
CREATE INDEX "AuthVerificationToken_expiresAt_idx" ON "AuthVerificationToken"("expiresAt");

-- CreateIndex
CREATE INDEX "ComplianceEvidencePackage_organizationId_packageType_idx" ON "ComplianceEvidencePackage"("organizationId", "packageType");

-- CreateIndex
CREATE INDEX "ComplianceEvidencePackage_organizationId_controlId_idx" ON "ComplianceEvidencePackage"("organizationId", "controlId");

-- CreateIndex
CREATE INDEX "ComplianceEvidencePackage_organizationId_generatedAt_idx" ON "ComplianceEvidencePackage"("organizationId", "generatedAt");

-- CreateIndex
CREATE INDEX "ComplianceEvidenceItem_packageId_sequence_idx" ON "ComplianceEvidenceItem"("packageId", "sequence");

-- CreateIndex
CREATE INDEX "ComplianceEvidenceItem_sourceType_sourceId_idx" ON "ComplianceEvidenceItem"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "GovernancePolicy_organizationId_status_idx" ON "GovernancePolicy"("organizationId", "status");

-- CreateIndex
CREATE INDEX "GovernancePolicy_organizationId_category_idx" ON "GovernancePolicy"("organizationId", "category");

-- CreateIndex
CREATE INDEX "GovernancePolicy_organizationId_priority_idx" ON "GovernancePolicy"("organizationId", "priority");

-- CreateIndex
CREATE INDEX "GovernancePolicyHistory_policyId_version_idx" ON "GovernancePolicyHistory"("policyId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "BackupMetadata_backupId_key" ON "BackupMetadata"("backupId");

-- CreateIndex
CREATE INDEX "BackupMetadata_databaseIdentifier_status_idx" ON "BackupMetadata"("databaseIdentifier", "status");

-- CreateIndex
CREATE INDEX "BackupMetadata_status_completedAt_idx" ON "BackupMetadata"("status", "completedAt");

-- CreateIndex
CREATE INDEX "BackupMetadata_startedAt_idx" ON "BackupMetadata"("startedAt");

-- CreateIndex
CREATE INDEX "RestoreVerificationRecord_backupId_status_idx" ON "RestoreVerificationRecord"("backupId", "status");

-- CreateIndex
CREATE INDEX "RestoreVerificationRecord_verifiedAt_idx" ON "RestoreVerificationRecord"("verifiedAt");

-- CreateIndex
CREATE INDEX "WebhookReconciliationRecord_merchantId_status_idx" ON "WebhookReconciliationRecord"("merchantId", "status");

-- CreateIndex
CREATE INDEX "WebhookReconciliationRecord_providerReference_idx" ON "WebhookReconciliationRecord"("providerReference");

-- CreateIndex
CREATE INDEX "WebhookReconciliationRecord_status_lastCheckedAt_idx" ON "WebhookReconciliationRecord"("status", "lastCheckedAt");

-- CreateIndex
CREATE INDEX "PaymentReconciliationRecord_merchantId_transactionId_idx" ON "PaymentReconciliationRecord"("merchantId", "transactionId");

-- CreateIndex
CREATE INDEX "PaymentReconciliationRecord_providerReference_idx" ON "PaymentReconciliationRecord"("providerReference");

-- CreateIndex
CREATE INDEX "PaymentReconciliationRecord_reconciliationOutcome_idx" ON "PaymentReconciliationRecord"("reconciliationOutcome");

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_organizationMemberId_fkey" FOREIGN KEY ("organizationMemberId") REFERENCES "OrganizationMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantUser" ADD CONSTRAINT "MerchantUser_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiRequestLog" ADD CONSTRAINT "ApiRequestLog_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiRequestLog" ADD CONSTRAINT "ApiRequestLog_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiIdempotencyRecord" ADD CONSTRAINT "ApiIdempotencyRecord_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiIdempotencyRecord" ADD CONSTRAINT "ApiIdempotencyRecord_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLedgerEntry" ADD CONSTRAINT "UsageLedgerEntry_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLedgerEntry" ADD CONSTRAINT "UsageLedgerEntry_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRecoveryProfile" ADD CONSTRAINT "CustomerRecoveryProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionTrace" ADD CONSTRAINT "DecisionTrace_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryAttempt" ADD CONSTRAINT "RecoveryAttempt_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryAttempt" ADD CONSTRAINT "RecoveryAttempt_banditDecisionId_fkey" FOREIGN KEY ("banditDecisionId") REFERENCES "BanditDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyGuardrails" ADD CONSTRAINT "PolicyGuardrails_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryExperiment" ADD CONSTRAINT "RecoveryExperiment_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanditDecision" ADD CONSTRAINT "BanditDecision_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanditDecision" ADD CONSTRAINT "BanditDecision_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantRecoveryIntelligence" ADD CONSTRAINT "MerchantRecoveryIntelligence_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryLearningEvent" ADD CONSTRAINT "RecoveryLearningEvent_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryIntelligenceAnomaly" ADD CONSTRAINT "RecoveryIntelligenceAnomaly_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoverIQEvent" ADD CONSTRAINT "RecoverIQEvent_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEventDelivery" ADD CONSTRAINT "WebhookEventDelivery_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEventDelivery" ADD CONSTRAINT "WebhookEventDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEventDelivery" ADD CONSTRAINT "WebhookEventDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "RecoverIQEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCredential" ADD CONSTRAINT "UserCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMfa" ADD CONSTRAINT "UserMfa_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExternalIdentity" ADD CONSTRAINT "UserExternalIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationIdentityProvider" ADD CONSTRAINT "OrganizationIdentityProvider_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationDomain" ADD CONSTRAINT "OrganizationDomain_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthVerificationToken" ADD CONSTRAINT "AuthVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceEvidencePackage" ADD CONSTRAINT "ComplianceEvidencePackage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceEvidenceItem" ADD CONSTRAINT "ComplianceEvidenceItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ComplianceEvidencePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernancePolicy" ADD CONSTRAINT "GovernancePolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernancePolicyHistory" ADD CONSTRAINT "GovernancePolicyHistory_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "GovernancePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestoreVerificationRecord" ADD CONSTRAINT "RestoreVerificationRecord_backupId_fkey" FOREIGN KEY ("backupId") REFERENCES "BackupMetadata"("backupId") ON DELETE CASCADE ON UPDATE CASCADE;

