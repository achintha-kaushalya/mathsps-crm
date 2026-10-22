import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { extractLmsNumber } from '@/lib/types'

describe('Domain Business Unit Tests (extractLmsNumber & Normalization)', () => {
  it('extracts LMS number encoded in notes tag [LMS: 0716494212]', () => {
    const student = {
      notes: 'Payment settled on time [LMS: 0716494212] Grade 10 batch',
    }
    assert.equal(extractLmsNumber(student), '0716494212')
  })

  it('prefers direct lms_number field if populated on student object', () => {
    const student = {
      lms_number: '0771234567',
      notes: '[LMS: 0711111111]',
    }
    assert.equal(extractLmsNumber(student), '0771234567')
  })

  it('extracts from plain string when notes string is passed directly', () => {
    const rawNotes = 'Sanduni class enrollment [LMS: 0789998877]'
    assert.equal(extractLmsNumber(rawNotes), '0789998877')
  })

  it('returns empty string gracefully when no valid LMS tag is present', () => {
    const student = {
      notes: 'No special tag recorded.',
      lms_number: null,
    }
    assert.equal(extractLmsNumber(student), '')
  })
})
