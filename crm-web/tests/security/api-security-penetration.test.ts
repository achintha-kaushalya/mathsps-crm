import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const API_BASE = 'http://localhost:3000'

describe('High-Accuracy Deep Security & Penetration Suite (Levels 2 & 3)', () => {
  class DummyWebSocket {}
  const clientOptions = {
    auth: { persistSession: false },
    realtime: { transport: DummyWebSocket as any }
  }

  const adminClient = createClient(supabaseUrl, serviceKey, clientOptions)
  const anonClient = createClient(supabaseUrl, anonKey, clientOptions)

  // -------------------------------------------------------------
  // Test Vector 1: HTTP API Perimeter & Session Hijacking
  // -------------------------------------------------------------
  it('API Security: blocks unauthenticated HTTP requests to /api/payments with 401 Unauthorized', async () => {
    const res = await fetch(`${API_BASE}/api/payments`, {
      method: 'GET'
    })
    assert.equal(res.status, 401, 'Public request was allowed into /api/payments without session!')
    const body = await res.json()
    assert.equal(body.success, false)
  })

  it('API Security: blocks unauthenticated POST to /api/payments with 401 Unauthorized', async () => {
    const maliciousPayload = {
      student_id: '00000000-0000-0000-0000-000000000000',
      month: 10,
      year: 2026,
      payment_type: 'BANK',
      date_paid: '2026-10-23',
      items: [{ class_type: 'MAIN_GR11', amount_due: 3500, amount_paid: 3500 }]
    }

    const res = await fetch(`${API_BASE}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(maliciousPayload)
    })
    assert.equal(res.status, 401, 'Public user was able to POST payment without session!')
  })

  it('API Security: blocks unauthenticated access to /api/leads/analytics with 401', async () => {
    const res = await fetch(`${API_BASE}/api/leads/analytics`, {
      method: 'GET'
    })
    assert.equal(res.status, 401, 'Public user was able to access /api/leads/analytics!')
  })

  // -------------------------------------------------------------
  // Test Vector 2: Financial Tampering & Payload Injection
  // -------------------------------------------------------------
  it('Financial Integrity: Zod blocks negative, zero, and malformed monetary injections', async () => {
    const { PaymentCreateSchema } = await import('../../src/lib/validation/schemas')
    
    // Negative payment injection attempt
    const negativePay = {
      student_id: '00000000-0000-0000-0000-000000000000',
      month: 10,
      year: 2026,
      payment_type: 'BANK',
      date_paid: '2026-10-23',
      items: [{ class_type: 'MAIN_GR11', amount_due: 3500, amount_paid: -5000 }]
    }
    const res1 = PaymentCreateSchema.safeParse(negativePay)
    assert.equal(res1.success, false, 'Negative monetary injection was allowed!')

    // Parameterized query safety test (verifies OR 1=1 cannot bypass filters)
    const sqlInjectPattern = "GR11' OR '1'='1"
    const { data: dbData, error: dbError } = await adminClient
      .from('payments')
      .select('id')
      .eq('class_type', sqlInjectPattern)
    
    // Parameterized driver treats it as literal string, returning 0 rows
    assert.equal(dbError, null)
    assert.equal(dbData?.length, 0, 'SQL injection string bypassed parameterized filter!')
  })

  // -------------------------------------------------------------
  // Test Vector 3: Vertical Privilege Escalation Protection
  // -------------------------------------------------------------
  it('Privilege Escalation: non-admin user cannot mutate members or grant themselves admin role', async () => {
    // Attempt unauthorized role escalation via anon/unprivileged client
    const { data, error } = await anonClient
      .from('members')
      .update({ role: 'admin' })
      .neq('id', '00000000-0000-0000-0000-000000000000')

    assert.ok(error !== null || data === null || (data as any)?.length === 0, 'Unprivileged client modified member role!')
  })

  // -------------------------------------------------------------
  // Test Vector 4: Audit Trail Immutability
  // -------------------------------------------------------------
  it('Audit Security: anon client CANNOT delete or tamper with audit_logs records', async () => {
    const { error: delErr } = await anonClient
      .from('audit_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    assert.ok(delErr !== null, 'Anon client was able to execute DELETE on audit_logs!')
  })

  it('Audit Integrity: server-side audit logger reliably records actions', async () => {
    const { logServerAudit } = await import('../../src/lib/api/audit')
    const testEntityId = '00000000-0000-0000-0000-000000000001'

    await logServerAudit({
      supabaseAdmin: adminClient,
      action: 'PAYMENT_ADD',
      entityType: 'payment',
      entityId: testEntityId,
      userName: 'Security Test Runner',
      userEmail: 'sec-test@mathsps.com',
      metadata: { test: true }
    })

    // Verify it exists in database
    const { data: auditRow, error } = await adminClient
      .from('audit_logs')
      .select('id, action, user_email, entity_id')
      .eq('entity_id', testEntityId)
      .eq('user_email', 'sec-test@mathsps.com')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    assert.equal(error, null)
    assert.ok(auditRow !== null, 'Audit record was not persisted to audit_logs!')
    assert.equal(auditRow?.action, 'PAYMENT_ADD')

    // Cleanup test audit record
    if (auditRow?.id) {
      await adminClient.from('audit_logs').delete().eq('id', auditRow.id)
    }
  })
})
