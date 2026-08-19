'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Lead, LEAD_STATUSES } from '@/lib/types'

const STATUS_COLOR: Record<string, string> = {
  'New': 'status-new', 'Contacted': 'status-contacted',
  'Interested': 'status-interested', 'Converted': 'status-converted',
  'No Answer': 'status-no-answer', 'Not Interested': 'status-not-interested',
}

export default function LeadDetailPage() {
  const { fcode } = useParams<{ fcode: string }>()
  const supabase = createClient()
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<Lead>>({})

  useEffect(() => {
    if (fcode) loadLead()
  }, [fcode])

  async function loadLead() {
    const { data } = await supabase.from('leads').select('*').eq('fcode', fcode).single()
    setLead(data)
    setForm(data || {})
    setLoading(false)
  }

  async function save() {
    if (!lead) return
    setSaving(true)
    await supabase.from('leads').update({
      assigned_member: form.assigned_member,
      status: form.status,
      grade: form.grade,
      comments: form.comments,
      campaign: form.campaign,
      second_call_done: form.second_call_done,
      second_call_notes: form.second_call_notes,
      paid: form.paid,
      ps_code_ref: form.ps_code_ref,
    }).eq('id', lead.id)
    setSaving(false)
    loadLead()
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
  if (!lead) return <div style={{ padding: 40, color: 'var(--accent-red)' }}>Lead not found: {fcode}</div>

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/leads" className="btn-secondary" style={{ padding: '6px 10px' }}>
            <ArrowLeft size={14} />
          </a>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
              {lead.fcode}
              <span className={`badge ${STATUS_COLOR[lead.status] || 'status-default'}`}
                style={{ marginLeft: 10, fontSize: 11 }}>
                {lead.status}
              </span>
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
              Lead Profile · Added {lead.date_added?.slice(0, 10)}
            </div>
          </div>
        </div>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : '✓ Save Changes'}
        </button>
      </div>

      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Contact Info */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 20, color: 'var(--accent-blue)' }}>
              Contact Information
            </div>
            <Field label="Phone (Normalized)" value={lead.normalized_phone || lead.raw_phone || '—'} mono />
            <Field label="Raw Phone" value={lead.raw_phone || '—'} mono />
            <Field label="F-Code" value={lead.fcode} />
            <Field label="Date Added" value={lead.date_added?.slice(0, 10) || '—'} />
            {lead.repeat_student && (
              <div style={{ padding: '8px 12px', background: '#1a3a2a', borderRadius: 8, fontSize: 13, color: '#34d399' }}>
                ⟲ Repeat Student — Previous F-Code: {lead.prev_fcode || '—'}
              </div>
            )}
          </div>

          {/* Edit Fields */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 20, color: 'var(--accent-blue)' }}>
              Lead Details
            </div>
            <EditSelect label="Status" field="status" options={LEAD_STATUSES} form={form} setForm={setForm} />
            <EditText label="Assigned Member" field="assigned_member" form={form} setForm={setForm} />
            <EditText label="Grade" field="grade" form={form} setForm={setForm} />
            <EditText label="Campaign / Boost" field="campaign" form={form} setForm={setForm} />
            <EditCheckbox label="Paid" field="paid" form={form} setForm={setForm} />
          </div>

          {/* Second Call */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 20, color: 'var(--accent-purple)' }}>
              Second Call
            </div>
            <EditCheckbox label="Second Call Done" field="second_call_done" form={form} setForm={setForm} />
            <EditTextarea label="Second Call Notes" field="second_call_notes" form={form} setForm={setForm} />
          </div>

          {/* Comments + Payment Link */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 20, color: 'var(--accent-green)' }}>
              Notes & System Links
            </div>
            <EditTextarea label="Comments" field="comments" form={form} setForm={setForm} />

            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Link to Payment System (Optional — fill when known)
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="input-field"
                  placeholder="PS code e.g. PS6359"
                  value={form.ps_code_ref || ''}
                  onChange={e => setForm(f => ({ ...f, ps_code_ref: e.target.value }))}
                />
                {form.ps_code_ref && (
                  <a href={`/students/${encodeURIComponent(form.ps_code_ref)}`}
                    className="btn-secondary" style={{ whiteSpace: 'nowrap' }}>
                    <ExternalLink size={13} /> View Student
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontFamily: mono ? 'monospace' : undefined }}>{value}</div>
    </div>
  )
}

function EditText({ label, field, form, setForm }: any) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>{label}</label>
      <input className="input-field" value={form[field] || ''} onChange={e => setForm((f: any) => ({ ...f, [field]: e.target.value }))} />
    </div>
  )
}

function EditSelect({ label, field, options, form, setForm }: any) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>{label}</label>
      <select className="input-field" value={form[field] || ''} onChange={e => setForm((f: any) => ({ ...f, [field]: e.target.value }))}>
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function EditTextarea({ label, field, form, setForm }: any) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>{label}</label>
      <textarea className="input-field" rows={3} value={form[field] || ''} onChange={e => setForm((f: any) => ({ ...f, [field]: e.target.value }))} style={{ resize: 'vertical' }} />
    </div>
  )
}

function EditCheckbox({ label, field, form, setForm }: any) {
  return (
    <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
      <input type="checkbox" id={field} checked={!!form[field]} onChange={e => setForm((f: any) => ({ ...f, [field]: e.target.checked }))}
        style={{ width: 16, height: 16, cursor: 'pointer' }} />
      <label htmlFor={field} style={{ fontSize: 13, cursor: 'pointer' }}>{label}</label>
    </div>
  )
}
