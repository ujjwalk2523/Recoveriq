# RecoverIQ — Deterministic Anomaly Detection Engine (Phase 8.7.2)

## 1. Engine Principles

The RecoverIQ Audit Anomaly Engine (`AuditAnomalyEngine`) relies strictly on explainable statistical rules:
- **No External ML**: Eliminates black-box non-deterministic predictions.
- **No Generative AI**: Zero LLM hallucination risk.
- **Safe Baseline Requirement**: Minimum sample threshold of 10 events. Organizations with fewer events return `baselineStatus: "INSUFFICIENT_DATA"` to prevent false alarms.
- **Deduplication Fingerprinting**: Deterministic hash fingerprints prevent duplicate alert spamming across repeated queries.

---

## 2. Detected Anomaly Signals

| Signal Type | Detection Condition | Severity Scoring |
| :--- | :--- | :--- |
| `ACTOR_ACTIVITY_SPIKE` | Recent actor events >= 3.0x historical hourly baseline (minimum 5 events). | `>= 10x` -> CRITICAL<br>`>= 5x` -> HIGH<br>`>= 3x` -> MEDIUM |
| `DENIAL_SPIKE` | Recent authorization denials >= 3 and >= 2.5x historical denial rate. | `>= 5x` -> HIGH<br>`>= 2.5x` -> MEDIUM |
| `AUTHENTICATION_FAILURE_SPIKE` | Burst of >= 5 authentication failures in observation window. | `>= 15` -> CRITICAL<br>`>= 5` -> HIGH |
| `CRITICAL_SEVERITY_BURST` | Concentration of >= 2 CRITICAL operations in observation window. | CRITICAL |
| `RESOURCE_CONCENTRATION` | Single actor accessing >= 8 distinct resources in observation window. | MEDIUM |

---

## 3. Anomaly vs Incident Distinction

An anomaly is an observational statistical deviation, **not** conclusive evidence of an attack or security incident. Anomaly notifications provide neutral investigative context (e.g. `"Actor 'usr_operator_7' executed 184 actions in the last 2h, exceeding baseline of 22 by 8.4x"`).
