---
name: zero-bias-adversarial-security
description: Enforces zero-bias adversarial "Red Team" black-box security thinking for penetration testing, API auditing, and authorization validation in MathsPS CRM.
---

# Zero-Bias Adversarial Security Architecture

When auditing, developing, or testing code in this CRM, the agent MUST drop all "author pride" or builder assumptions. Treat every endpoint and database policy as if it were designed by an adversary with hidden flaws.

## Core Rules for Zero-Bias Testing

1. **The Attacker's Assumption (Assume Vulnerable Until Proven Protected):**
   - Never assume a boundary is safe because "the code looks clean".
   - Actively construct malicious payloads designed to crash, poison, or leak data.

2. **Attack Vectors to Apply on EVERY Feature:**
   - **Horizontal Privilege Escalation (IDOR):** Can User A modify, delete, or read records belonging to User B by spoofing URL IDs or query parameters?
   - **Vertical Privilege Escalation:** Can a call center or unprivileged staff member invoke admin routes (`DELETE`, role changing, financial approvals)?
   - **Extreme Fuzzing & Type Confusion:** Inject `null`, `NaN`, `Infinity`, empty strings, arrays instead of objects, massive 100KB strings (Buffer overflow), and illegal Unicode.
   - **JSON Prototype Pollution:** Test with `{"__proto__": ...}` and `{"constructor": ...}` payloads.
   - **Financial Tampering:** Minus amounts, floating-point precision exploits, duplicate currency processing.
   - **Audit Trail Bypassing:** Verify that if an operation completes, an immutable audit trail is guaranteed to be recorded.

3. **Mandatory Execution:**
   - Security assertions must execute against real live endpoints and live DB policies.
   - Mocking security guards during penetration tests is strictly prohibited.
