import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { PaymentCreateSchema, PaymentUpdateStatusSchema, StudentCreateSchema } from '@/lib/validation/schemas'

describe('M3 API Validation & Zod Schema Tests', () => {
  it('validates a correct PaymentCreate payload', () => {
    const valid = {
      student_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      month: 10,
      year: 2026,
      payment_type: 'BANK',
      date_paid: '2026-10-23',
      notes: 'Monthly fee payment',
      items: [
        {
          class_type: 'MAIN_GR11',
          amount_due: 3500,
          amount_paid: 3500,
          fee: 3500
        }
      ]
    }

    const result = PaymentCreateSchema.safeParse(valid)
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.items.length, 1)
      assert.equal(result.data.items[0].amount_paid, 3500)
    }
  })

  it('rejects an invalid payment with empty items array', () => {
    const invalid = {
      student_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      month: 10,
      year: 2026,
      payment_type: 'BANK',
      date_paid: '2026-10-23',
      items: []
    }

    const result = PaymentCreateSchema.safeParse(invalid)
    assert.equal(result.success, false)
  })

  it('rejects invalid payment_type enum', () => {
    const invalid = {
      student_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      amount_paid: 2000,
      payment_type: 'CRYPTO'
    }

    const result = PaymentCreateSchema.safeParse(invalid)
    assert.equal(result.success, false)
  })

  it('validates student creation payload with boundary grade check', () => {
    const validStudent = {
      full_name: 'Kasun Bandara',
      grade: 11,
      whatsapp_number: '0712345678'
    }
    const result = StudentCreateSchema.safeParse(validStudent)
    assert.equal(result.success, true)

    const invalidGrade = {
      full_name: 'Kasun Bandara',
      grade: 15 // Invalid grade
    }
    const failResult = StudentCreateSchema.safeParse(invalidGrade)
    assert.equal(failResult.success, false)
  })

  it('validates payment status update payload', () => {
    const validUpdate = {
      payment_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      status: 'REJECTED',
      rejection_reason: 'Slip unreadable'
    }
    const result = PaymentUpdateStatusSchema.safeParse(validUpdate)
    assert.equal(result.success, true)
  })
})
