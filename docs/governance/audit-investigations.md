# RecoverIQ — Correlated Investigation Timelines (Phase 8.7.2)

## 1. Investigation Model

During enterprise security investigations, operators need to trace multi-step sequences across distributed actions. RecoverIQ correlates audit events using 4 primary correlation pivots:

```text
Request ID (requestId)
├── Trace correlation across a single API/HTTP call
└── Correlates: Authentication → Authorization → Business Action → Audit Event

Session ID (sessionId)
├── Correlates all activity by a user across a durable session lifecycle
└── From login to logout/revocation

Actor ID (actorId)
├── Comprehensive chronological history of a specific principal
└── Highlights actions, categories, and target resources touched

Resource ID (resourceId)
├── Complete lifecycle auditing of an entity
└── Shows all actors who modified an Organization, Team, API Key, Policy, or Payment
```

---

## 2. Correlation API Usage

```http
GET /api/audit/analytics/timeline?correlationKey=requestId&correlationValue=req_live_99812
```

Returns:
```json
{
  "correlationKey": "requestId",
  "correlationValue": "req_live_99812",
  "totalEvents": 4,
  "events": [
    {
      "sequenceNumber": 142,
      "occurredAt": "2026-09-04T14:02:11.000Z",
      "actor": { "type": "USER", "id": "usr_admin_1" },
      "action": "ORG_MEMBER_ROLE_CHANGED",
      "resource": { "type": "MEMBERSHIP", "id": "mem_operator_4" }
    }
  ]
}
```

---

## 3. Deep Redaction Defense

Investigation timelines inherit all Phase 8.7.1 secret scrubbing guarantees:
- Passwords, tokens, API keys, and payment credentials are automatically redacted to `"[REDACTED]"`.
- Sensitive metadata is sanitized recursively before delivery to investigators.
