import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

describe('RLS Security Penetration Tests (Milestone M2)', () => {
  class DummyWebSocket {}
  const clientOptions = {
    auth: { persistSession: false },
    realtime: { transport: DummyWebSocket as any },
  }

  const anonClient = createClient(supabaseUrl, anonKey, clientOptions)
  const adminClient = createClient(supabaseUrl, serviceKey, clientOptions)

  const protectedTables = [
    'leads',
    'students',
    'households',
    'payments',
    'enrollments',
    'members',
  ]

  it('verifies that public anonymous client CANNOT read any protected records', async () => {
    for (const table of protectedTables) {
      const { data } = await anonClient
        .from(table)
        .select('*', { count: 'exact' })
        .limit(5)

      // Anon should receive 0 rows
      const rowCount = data?.length || 0
      assert.equal(rowCount, 0, `Table ${table} leaked data to unauthenticated anon user!`)
    }
  })

  it('verifies that public anonymous client CANNOT insert data into protected tables', async () => {
    // Attempt unauthorized student insertion
    const { error: studentErr } = await anonClient.from('students').insert({
      ps_code: 'PS999999',
      full_name: 'Hacker Injection Test',
      grade: 10,
    })
    assert.ok(studentErr !== null, 'Anon was able to insert into students!')

    // Attempt unauthorized payment insertion
    const { error: pmtErr } = await anonClient.from('payments').insert({
      amount_paid: 99999,
      payment_type: 'BANK',
      student_id: '00000000-0000-0000-0000-000000000000',
    })
    assert.ok(pmtErr !== null, 'Anon was able to insert into payments!')
  })

  it('verifies that backend Service Role maintains full administrative authority', async () => {
    for (const table of protectedTables) {
      const { count, error } = await adminClient
        .from(table)
        .select('id', { count: 'exact', head: true })

      assert.equal(error, null, `Service role failed to access ${table}: ${error?.message}`)
      assert.ok(count !== null && count >= 0)
    }
  })
})
