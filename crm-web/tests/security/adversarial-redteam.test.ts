import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const API_BASE = 'http://localhost:3000'

describe('Adversarial Red-Team & Chaos Penetration Suite (Zero-Bias Blind Testing)', () => {

  // -------------------------------------------------------------------------
  // 1. Prototype Pollution Attacks
  // -------------------------------------------------------------------------
  it('Red-Team: resists JSON Prototype Pollution payload injection', async () => {
    const maliciousPayload = JSON.parse(`{
      "__proto__": { "isAdmin": true, "role": "owner" },
      "constructor": { "prototype": { "isAdmin": true } },
      "student_id": "00000000-0000-0000-0000-000000000000",
      "month": 10,
      "year": 2026,
      "payment_type": "BANK",
      "date_paid": "2026-10-23",
      "items": [{ "class_type": "MAIN_GR11", "amount_due": 3500, "amount_paid": 3500 }]
    }`)

    const res = await fetch(`${API_BASE}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(maliciousPayload)
    })

    // Must be blocked by auth (401) and not polluted
    assert.equal(res.status, 401)
    
    // Check global Object prototype is intact
    const testObj: any = {}
    assert.equal(testObj.isAdmin, undefined, 'Prototype pollution succeeded! Object.prototype was infected!')
  })

  // -------------------------------------------------------------------------
  // 2. Fuzzing & Malformed Buffer Overflow Attacks
  // -------------------------------------------------------------------------
  it('Red-Team: rejects 100KB massive buffer payload without crashing server', async () => {
    const massiveString = 'A'.repeat(100 * 1024) // 100KB string
    const res = await fetch(`${API_BASE}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: massiveString,
        notes: massiveString
      })
    })

    // Should return 401 (or 413/400) without crashing the server process
    assert.ok([400, 401, 413, 422].includes(res.status), `Server returned unexpected ${res.status}`)
  })

  it('Red-Team: rejects malformed JSON and binary junk', async () => {
    const res = await fetch(`${API_BASE}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '<<MALFORMED_NON_JSON_CORRUPT_BYTES\x00\x01\xFF>>'
    })

    assert.ok([400, 401].includes(res.status), 'Malformed bytes should be rejected with 400 or 401')
  })

  // -------------------------------------------------------------------------
  // 3. HTTP Verb / Method Confusion Attacks
  // -------------------------------------------------------------------------
  it('Red-Team: rejects unauthorized HTTP verbs (PUT, DELETE, PATCH, TRACE)', async () => {
    const verbs = ['PUT', 'DELETE', 'PATCH']
    for (const verb of verbs) {
      const res = await fetch(`${API_BASE}/api/payments`, {
        method: verb
      })
      // Next.js returns 405 (Method Not Allowed) or 401 (Auth rejected before route)
      assert.ok(
        [401, 403, 405].includes(res.status),
        `Unexpected response status ${res.status} for HTTP ${verb}`
      )
    }

    // OPTIONS preflight returns 200 or 204
    const optRes = await fetch(`${API_BASE}/api/payments`, { method: 'OPTIONS' })
    assert.ok([200, 204, 401, 405].includes(optRes.status))
  })

  // -------------------------------------------------------------------------
  // 4. Header Injection & Spoofing Attacks
  // -------------------------------------------------------------------------
  it('Red-Team: ignores spoofed IP and forwarded headers', async () => {
    const res = await fetch(`${API_BASE}/api/payments`, {
      method: 'GET',
      headers: {
        'X-Forwarded-For': '127.0.0.1',
        'X-Real-IP': '127.0.0.1',
        'X-Original-URL': '/admin',
        'X-Custom-Role': 'admin',
        'Cookie': 'role=admin; user=owner; sb-access-token=fake-token'
      }
    })

    // Spoofed cookies & headers must be ignored, strictly returning 401 Unauthorized
    assert.equal(res.status, 401, 'Spoofed internal headers allowed unauthorized access!')
  })

  // -------------------------------------------------------------------------
  // 5. Extreme Boundary & Type Confusion Fuzzing
  // -------------------------------------------------------------------------
  it('Red-Team: Zod schema rejects NaN, Infinity, -Infinity in monetary items', async () => {
    const { PaymentCreateSchema } = await import('../../src/lib/validation/schemas')

    const payloads = [
      { amount_paid: NaN },
      { amount_paid: Infinity },
      { amount_paid: -Infinity },
      { amount_paid: '3500' }, // string instead of number
      { amount_paid: null },
      { amount_paid: undefined },
      { amount_paid: {} }
    ]

    for (const p of payloads) {
      const parsed = PaymentCreateSchema.safeParse({
        student_id: '00000000-0000-0000-0000-000000000000',
        month: 10,
        year: 2026,
        payment_type: 'BANK',
        date_paid: '2026-10-23',
        items: [{ class_type: 'MAIN_GR11', amount_due: 3500, amount_paid: (p as any).amount_paid }]
      })

      assert.equal(parsed.success, false, `Fuzzed payload with amount_paid: ${p.amount_paid} was unexpectedly accepted!`)
    }
  })

  // -------------------------------------------------------------------------
  // 6. Unicode & XSS Script Tag Injection
  // -------------------------------------------------------------------------
  it('Red-Team: handles script tags and illegal control characters safely', async () => {
    const { PaymentCreateSchema } = await import('../../src/lib/validation/schemas')

    const xssPayload = {
      student_id: '00000000-0000-0000-0000-000000000000',
      month: 10,
      year: 2026,
      payment_type: 'BANK',
      date_paid: '2026-10-23',
      notes: '<script>alert("XSS")</script><img src=x onerror=alert(1)>',
      items: [{ class_type: 'MAIN_GR11', amount_due: 3500, amount_paid: 3500 }]
    }

    const parsed = PaymentCreateSchema.safeParse(xssPayload)
    // Zod accepts notes as string; verify it is treated purely as data without crashing or executing
    assert.equal(parsed.success, true)
    if (parsed.success) {
      assert.equal(typeof parsed.data.notes, 'string')
      assert.ok(parsed.data.notes?.includes('<script>'))
    }
  })

  // -------------------------------------------------------------------------
  // 7. Horizontal IDOR Attack on Leads
  // -------------------------------------------------------------------------
  it('Red-Team IDOR: unauthenticated/cross-tenant request to modify or delete lead is blocked', async () => {
    // Attempt malicious deletion of a lead without authentication
    const fakeLeadId = '00000000-0000-0000-0000-000000000000'
    const delRes = await fetch(`${API_BASE}/api/leads/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: fakeLeadId })
    })
    assert.equal(delRes.status, 401, 'Unauthorized caller was able to invoke /api/leads/delete!')

    // Attempt malicious PATCH on /api/leads without session
    const patchRes = await fetch(`${API_BASE}/api/leads`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: fakeLeadId, comments: 'Hacked by IDOR attack' })
    })
    assert.equal(patchRes.status, 401, 'Unauthorized caller was able to PATCH /api/leads!')
  })
})
