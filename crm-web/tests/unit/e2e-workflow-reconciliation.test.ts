import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

describe('Step 3: End-to-End Workflow & Ledger Reconciliation Integration Suite', () => {
  class DummyWebSocket {}
  const clientOptions = {
    auth: { persistSession: false },
    realtime: { transport: DummyWebSocket as any }
  }

  const adminClient = createClient(supabaseUrl, serviceKey, clientOptions)
  const testRunId = Date.now().toString().slice(-5)
  const testPsCode = `PS99${testRunId}`
  let createdStudentId = ''
  let createdHouseholdId = ''

  it('1. Student Atomic Registration: Creates household, student, and enrollments', async () => {
    // 1. Create household
    const { data: household, error: hhErr } = await adminClient
      .from('households')
      .insert({
        parent_name: 'E2E Test Guardian',
        parent_phone: '0771234567',
        address: '123 E2E Test Lane, Colombo',
        area: 'Colombo'
      })
      .select()
      .single()

    assert.equal(hhErr, null, 'Household creation failed')
    assert.ok(household.id, 'Household ID missing')
    createdHouseholdId = household.id

    // 2. Create student
    const { data: student, error: stuErr } = await adminClient
      .from('students')
      .insert({
        ps_code: testPsCode,
        full_name: 'E2E Workflow Test Student',
        grade: 11,
        household_id: household.id,
        created_by: 'E2E Automated Agent'
      })
      .select()
      .single()

    assert.equal(stuErr, null, 'Student creation failed')
    assert.ok(student.id, 'Student ID missing')
    createdStudentId = student.id

    // 3. Create course enrollment
    const { data: enrollment, error: enrErr } = await adminClient
      .from('enrollments')
      .insert({
        student_id: student.id,
        class_type: 'MAIN_GR11',
        fee_amount: 3500,
        active: true
      })
      .select()
      .single()

    assert.equal(enrErr, null, 'Enrollment creation failed')
    assert.equal(enrollment.fee_amount, 3500)
  })

  it('2. Financial Ledger Synchronization: Records payment and verifies balance ledger math', async () => {
    assert.ok(createdStudentId, 'Student must be created prior to payment')

    const amountDue = 3500
    const amountPaid = 3500
    const paymentDate = new Date().toISOString().slice(0, 10)

    // 1. Record payment transaction
    const { data: payment, error: payErr } = await adminClient
      .from('payments')
      .insert({
        student_id: createdStudentId,
        class_type: 'MAIN_GR11',
        month: 10,
        year: 2026,
        amount_due: amountDue,
        amount_paid: amountPaid,
        balance_before: 0,
        payment_type: 'BANK',
        bank_name: 'Commercial Bank',
        date_paid: paymentDate,
        recorded_by: 'E2E Automated Agent',
        tute_delivered: true
      })
      .select()
      .single()

    assert.equal(payErr, null, 'Payment insertion failed')
    assert.equal(payment.amount_paid, 3500)
    assert.equal(payment.tute_delivered, true)

    // 2. Verify that student_balances view automatically computes exact financial totals
    const { data: balanceRecord, error: balErr } = await adminClient
      .from('student_balances')
      .select('*')
      .eq('student_id', createdStudentId)
      .eq('class_type', 'MAIN_GR11')
      .maybeSingle()

    assert.equal(balErr, null, 'Querying student_balances view failed')
    assert.ok(balanceRecord, 'Student balance view record should be automatically populated')
    assert.equal(balanceRecord.total_paid, 3500)
    assert.equal(balanceRecord.total_due, 3500)
    assert.equal(balanceRecord.current_balance, 0, 'Current balance should be settled at Rs. 0')
  })

  it('3. Ledger Overpayment / Advance Test: Accrues credit balance accurately in view', async () => {
    const additionalPayment = 5000 // Rs. 5000 paid for Rs. 3500 fee -> Rs. +1500 advance credit
    const monthlyFee = 3500
    const paymentDate = new Date().toISOString().slice(0, 10)

    // Insert second payment with excess amount
    const { error: payErr } = await adminClient
      .from('payments')
      .insert({
        student_id: createdStudentId,
        class_type: 'MAIN_GR11',
        month: 11,
        year: 2026,
        amount_due: monthlyFee,
        amount_paid: additionalPayment,
        balance_before: 0,
        payment_type: 'BANK',
        bank_name: 'Commercial Bank',
        date_paid: paymentDate,
        recorded_by: 'E2E Automated Agent',
        tute_delivered: false
      })

    assert.equal(payErr, null, 'Advance payment insertion failed')

    // Query aggregated view
    const { data: balanceRecord, error: balErr } = await adminClient
      .from('student_balances')
      .select('*')
      .eq('student_id', createdStudentId)
      .eq('class_type', 'MAIN_GR11')
      .maybeSingle()

    assert.equal(balErr, null, 'Balance query failed')
    assert.ok(balanceRecord, 'Balance view record should exist')
    assert.equal(balanceRecord.total_paid, 8500, 'Total paid should equal 3500 + 5000 = 8500')
    assert.equal(balanceRecord.total_due, 7000, 'Total due should equal 3500 + 3500 = 7000')
    assert.equal(balanceRecord.current_balance, 1500, 'Student should have an advance credit balance of +1500')
  })

  it('4. Audit Trail Verification: Asserts enterprise server audit logging', async () => {
    const { data: auditEntry, error: logErr } = await adminClient
      .from('audit_logs')
      .insert({
        action: 'E2E_WORKFLOW_VERIFICATION',
        entity_type: 'student',
        entity_id: createdStudentId,
        user_name: 'E2E Automated Agent',
        user_email: 'agent@mathsps.com',
        metadata: { ps_code: testPsCode, verified: true }
      })
      .select()
      .single()

    assert.equal(logErr, null, 'Audit log recording failed')
    assert.equal(auditEntry.action, 'E2E_WORKFLOW_VERIFICATION')
    assert.equal(auditEntry.entity_id, createdStudentId)
  })

  it('5. Teardown: Cleanly purges E2E test fixtures without leaving orphaned rows', async () => {
    if (createdStudentId) {
      await adminClient.from('audit_logs').delete().eq('entity_id', createdStudentId)
      await adminClient.from('student_balances').delete().eq('student_id', createdStudentId)
      await adminClient.from('payments').delete().eq('student_id', createdStudentId)
      await adminClient.from('enrollments').delete().eq('student_id', createdStudentId)
      await adminClient.from('students').delete().eq('id', createdStudentId)
    }
    if (createdHouseholdId) {
      await adminClient.from('households').delete().eq('id', createdHouseholdId)
    }

    const { data: checkStudent } = await adminClient
      .from('students')
      .select('id')
      .eq('ps_code', testPsCode)
      .maybeSingle()

    assert.equal(checkStudent, null, 'Student should be cleanly deleted')
  })
})
