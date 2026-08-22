'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Plus, RefreshCw, Lock, AlertTriangle, Sparkles, UserCheck, Repeat } from 'lucide-react'
import { Lead, LEAD_STATUSES } from '@/lib/types'

const STATUS_COLOR: Record<string, string> = {
  'New': 'status-new',
  'Contacted': 'status-contacted',
  'Interested': 'status-interested',
  'Converted': 'status-converted',
  'No Answer': 'status-no-answer',
  'Not Interested': 'status-not-interested',
  'Off': 'status-off',
}

const PAGE_SIZE = 50

interface PresenceUser {
  user_name: string
  lead_id: string
  field: string
  color: string
}

const USER_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4']

function normalizePhone(raw: string): string {
  if (!raw) return ''
  // 1. Remove all non-numeric characters (spaces, +, -, etc.)
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''

  // 2. Excel/CRM Rule: Extract last 9 digits and format standard Sri Lankan 07XXXXXXXX
  if (digits.length >= 9) {
    const last9 = digits.slice(-9)
    return `0${last9}`
  }

  return digits
}

export default function MasterLeadsSpreadsheet() {
  const supabase = createClient()

  // Current User Context
  const [currentMemberName, setCurrentMemberName] = useState<string>('')
  const [userRole, setUserRole] = useState<'member' | 'admin' | 'owner' | 'callcenter' | 'payments'>('member')
  const [userColor, setUserColor] = useState<string>('#3b82f6')
  const [allowedMembers, setAllowedMembers] = useState<string[]>([])
  const [canViewAll, setCanViewAll] = useState<boolean>(false)

  // Leads & Grid Data
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [memberFilter, setMemberFilter] = useState('')
  const [members, setMembers] = useState<string[]>([])
  const [page, setPage] = useState(0)

  // Quick Add Row
  const [newSecondCallNotes, setNewSecondCallNotes] = useState('')

  // Real-Time Multiplayer Presence (Who is editing what cell)
  const [activePresences, setActivePresences] = useState<Record<string, PresenceUser>>({})

  // Quick Add Row (Excel bottom row insertion)
  const [newPhone, setNewPhone] = useState('')
  const [newGrade, setNewGrade] = useState('')
  const [newCampaign, setNewCampaign] = useState('S26')
  const [newComment, setNewComment] = useState('')
  const [addingRow, setAddingRow] = useState(false)

  const searchTimeout = useRef<NodeJS.Timeout | undefined>(undefined)
  const isAdmin = Boolean(userRole === 'admin' || userRole === 'owner' || (currentMemberName && currentMemberName.toLowerCase().includes('admin')))

  // Initialize User Info & Permissions
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const uName = user.user_metadata?.full_name || user.email?.split('@')[0] || ''
        let uRole = user.user_metadata?.role || (user.email?.toLowerCase().includes('admin') ? 'admin' : 'member')

        if (user.email) {
          const { data: dbMem } = await supabase.from('members').select('role, notes').eq('email', user.email).single()
          if (dbMem) {
            if (dbMem.role) uRole = dbMem.role
            try {
              if (dbMem.notes) {
                const perms = JSON.parse(dbMem.notes)
                if (perms.allowed_members) setAllowedMembers(perms.allowed_members)
                if (perms.can_view_all !== undefined) setCanViewAll(perms.can_view_all)
              }
            } catch {}
          }
        }

        if (user.email?.toLowerCase().includes('admin')) {
          uRole = 'admin'
        }

        setCurrentMemberName(uName)
        setUserRole(uRole)
        const colorIdx = Math.abs(uName.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)) % USER_COLORS.length
        setUserColor(USER_COLORS[colorIdx])
      }
    })
    loadMembers()
  }, [])

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setPage(0)
      loadLeads(0)
    }, 300)
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [search, statusFilter, memberFilter, currentMemberName, allowedMembers, canViewAll])

  useEffect(() => { loadLeads(page) }, [page])

  // REAL-TIME WEBSOCKET SUBSCRIPTION + MULTIPLAYER PRESENCE
  const channelRef = useRef<any>(null)

  useEffect(() => {
    const room = supabase.channel('master-leads-realtime-grid', {
      config: { presence: { key: currentMemberName } }
    })
    channelRef.current = room

    // 1. Listen for Database Postgres changes & Broadcast events
    room
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => loadLeads(page))
      .on('broadcast', { event: 'lead_deleted' }, (payload: any) => {
        if (payload?.payload?.id) {
          setLeads(prev => prev.filter(l => l.id !== payload.payload.id))
          setTotal(t => Math.max(0, t - 1))
        }
      })
      .on('broadcast', { event: 'lead_updated' }, () => loadLeads(page))
      .on('broadcast', { event: 'lead_created' }, () => loadLeads(0))

    // 2. Listen for Multiplayer Cursor/Cell Presence
    room.on('presence', { event: 'sync' }, () => {
      const state = room.presenceState()
      const presences: Record<string, PresenceUser> = {}
      Object.values(state).forEach((presenceArray: any) => {
        presenceArray.forEach((p: any) => {
          if (p.lead_id && p.user_name !== currentMemberName) {
            presences[p.lead_id] = p
          }
        })
      })
      setActivePresences(presences)
    })

    room.subscribe()
    return () => { supabase.removeChannel(room) }
  }, [page, currentMemberName])

  async function broadcastCellFocus(leadId: string | null, field: string = '') {
    if (!channelRef.current) return
    if (leadId) {
      channelRef.current.track({
        user_name: currentMemberName,
        lead_id: leadId,
        field: field,
        color: userColor,
      })
    } else {
      channelRef.current.untrack()
    }
  }

  async function loadMembers() {
    const { data } = await supabase.from('members').select('name').eq('active', true).order('name')
    setMembers((data || []).map((m: any) => m.name))
  }

  async function loadLeads(p: number) {
    setLoading(true)
    try {
      let q = supabase.from('leads').select('*', { count: 'exact' })

      // Lead Visibility Restriction for regular staff members
      if (!isAdmin && !canViewAll && currentMemberName) {
        const visibleMembers = [currentMemberName, ...allowedMembers]
        q = q.in('assigned_member', visibleMembers)
      }

      if (search.trim()) {
        const s = search.trim()
        const normSearch = normalizePhone(s)

        if (s.toUpperCase().startsWith('F')) {
          q = q.ilike('fcode', `%${s}%`)
        } else if (normSearch.length >= 7) {
          q = q.or(`normalized_phone.ilike.%${normSearch}%,raw_phone.ilike.%${s}%,fcode.ilike.%${s}%`)
        } else {
          q = q.or(`fcode.ilike.%${s}%,normalized_phone.ilike.%${s}%,raw_phone.ilike.%${s}%,campaign.ilike.%${s}%,comments.ilike.%${s}%`)
        }
      }
      if (statusFilter) q = q.eq('status', statusFilter)
      if (memberFilter) q = q.eq('assigned_member', memberFilter)

      q = q.order('created_at', { ascending: false })
        .range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1)

      const { data, count, error } = await q
      if (error) throw error
      setLeads(data || [])
      setTotal(count || 0)
    } finally {
      setLoading(false)
    }
  }

  function isOwnLead(lead: Lead): boolean {
    if (!lead.assigned_member) return true
    return (lead.assigned_member || '').toLowerCase() === (currentMemberName || '').toLowerCase()
  }

  function canEditLead(lead: Lead): boolean {
    if (isAdmin) return true
    if (canViewAll) return true
    if (!lead.assigned_member) return true
    const visibleMembers = [currentMemberName, ...allowedMembers].map(m => m.toLowerCase())
    return visibleMembers.includes((lead.assigned_member || '').toLowerCase())
  }

  // Lead Deletion with Modal Confirmation
  const [deleteTargetLead, setDeleteTargetLead] = useState<Lead | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function handleDeleteClick(lead: Lead) {
    setDeleteTargetLead(lead)
  }

  async function confirmDeleteLead() {
    if (!deleteTargetLead) return
    const lead = deleteTargetLead
    setDeletingId(lead.id)

    try {
      // Call server API route with service role key to delete
      const res = await fetch('/api/leads/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete lead')

      // Broadcast instant deletion event over active subscribed channel
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'lead_deleted',
          payload: { id: lead.id }
        })
      }

      setLeads(prev => prev.filter(l => l.id !== lead.id))
      setTotal(t => Math.max(0, t - 1))
      setDeleteTargetLead(null)
    } catch (err: any) {
      alert(`Failed to delete lead: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  // CELL SAVE & DUPLICATE RE-CHECK LOGIC
  async function saveCell(id: string, field: string, value: any, currentLead: Lead) {
    broadcastCellFocus(null)

    let updateObj: any = {}
    if (field === 'paid' || field === 'repeat_student' || field === 'second_call_done') {
      updateObj[field] = value === true || value === 'Yes'
    } else {
      updateObj[field] = value || null
    }

    // If phone number was edited -> trigger auto-normalization and duplicate check
    if (field === 'raw_phone' || field === 'normalized_phone') {
      const norm = normalizePhone(String(value))
      updateObj['normalized_phone'] = norm

      if (norm.length >= 7) {
        // Run duplicate check against existing DB
        const { data: matches } = await supabase.from('leads').select('fcode, campaign').eq('normalized_phone', norm).neq('id', id)
        if (matches && matches.length > 0) {
          const sameCampaign = matches.find(m => m.campaign === (currentLead.campaign || newCampaign))
          if (!sameCampaign) {
            updateObj['repeat_student'] = true
            updateObj['prev_fcode'] = matches[0].fcode
          }
        }
      }
    }

    // Optimistic UI update
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updateObj } : l))

    await supabase.from('leads').update(updateObj).eq('id', id)

    // Broadcast update event over active channel
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'lead_updated',
        payload: { id, updateObj }
      })
    }
  }

  // SELF-HEALING QUICK ADD LEAD ROW (EXCEL ROW CREATION ENGINE)
  async function handleAddNewRow(e: React.FormEvent) {
    e.preventDefault()
    if (!newPhone.trim()) return

    setAddingRow(true)
    try {
      const normPhone = normalizePhone(newPhone.trim())

      // 1. Auto-Check for Existing Phone Number (1 Number = 1 Unique F-Code Rule)
      let targetFcode = ''
      let isRepeat = false
      let prevFcodeStr = ''

      if (normPhone.length >= 7) {
        // Query by normalized_phone order by created_at ASC (matching Apps Script top-to-bottom sheet scan)
        const { data: existing } = await supabase
          .from('leads')
          .select('fcode, campaign, created_at')
          .eq('normalized_phone', normPhone)
          .order('created_at', { ascending: true })

        if (existing && existing.length > 0) {
          // REUSE THE FIRST F-CODE EVER ENTERED FOR THIS PHONE NUMBER
          targetFcode = existing[0].fcode
          isRepeat = true
          prevFcodeStr = existing[0].fcode
        }
      }

      // 2. If BRAND NEW phone number -> generate next sequential F-code starting at F80000+
      if (!targetFcode) {
        const { data: allFcodes } = await supabase.from('leads').select('fcode').order('created_at', { ascending: false }).limit(500)
        let maxNum = 80000
        if (allFcodes) {
          allFcodes.forEach(f => {
            const fc = (f.fcode || '').trim()
            // Match strict standard 5-digit F-codes (F80000..F99999)
            if (/^F\d{5}$/i.test(fc)) {
              const n = parseInt(fc.slice(1), 10)
              if (!isNaN(n) && n >= maxNum && n < 99999) {
                maxNum = n
              }
            }
          })
        }
        targetFcode = `F${maxNum + 1}`
      }

      // 3. Create Full Lead Record (sharing original F-code if duplicate)
      const newLead = {
        fcode: targetFcode,
        raw_phone: newPhone.trim(),
        normalized_phone: normPhone,
        assigned_member: currentMemberName || 'unassigned',
        date_added: new Date().toISOString().slice(0, 10),
        status: 'New',
        grade: newGrade.trim() || null,
        campaign: newCampaign.trim() || 'S26',
        comments: newComment.trim() || null,
        second_call_notes: newSecondCallNotes.trim() || null,
        repeat_student: isRepeat,
        prev_fcode: prevFcodeStr || null,
      }

      const { data: insertedData, error } = await supabase.from('leads').insert(newLead).select().single()
      if (error) {
        throw error
      } else if (insertedData) {
        setLeads(prev => [insertedData, ...prev])
      }

      // 4. Broadcast instant row creation over active multiplayer channel
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'lead_created',
          payload: { fcode: targetFcode }
        })
      }

      setTotal(t => t + 1)
      setNewPhone('')
      setNewGrade('')
      setNewComment('')
      setNewSecondCallNotes('')
      loadLeads(0)
    } catch (err: any) {
      alert(`Error adding lead: ${err.message}`)
    } finally {
      setAddingRow(false)
    }
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            Master Leads Grid
            <span style={{ fontSize: 11, background: '#10b98120', color: '#10b981', padding: '3px 8px', borderRadius: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={12} /> Live Multiplayer Sync
            </span>
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            Logged in as: <b>{currentMemberName || 'Staff'}</b> ({isAdmin ? '🛡 Admin Access' : '🔒 Member Access — Can edit own assigned records'})
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => loadLeads(page)} className="btn-secondary">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="search-bar"
            style={{ paddingLeft: 36 }}
            placeholder="Search phone, F-code, campaign, comments..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input-field" style={{ width: 150 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input-field" style={{ width: 160 }} value={memberFilter} onChange={e => setMemberFilter(e.target.value)}>
          <option value="">{isAdmin || canViewAll ? 'All Members' : 'My Visible Team'}</option>
          {members
            .filter(m => isAdmin || canViewAll || [currentMemberName, ...allowedMembers].includes(m))
            .map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          Page {page + 1} of {Math.ceil(total / PAGE_SIZE)} ({total.toLocaleString()} total)
        </div>
      </div>

      {/* Data Grid */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table className="data-table" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ width: 36, textAlign: 'center' }}>🔒</th>
              <th style={{ width: 85 }}>F-Code</th>
              <th style={{ width: 110 }}>Phone</th>
              <th style={{ width: 110 }}>Assigned</th>
              <th style={{ width: 85 }}>Date Added</th>
              <th style={{ width: 130 }}>Status</th>
              <th style={{ width: 55 }}>Grade</th>
              <th style={{ width: 100 }}>Campaign</th>
              <th style={{ width: 150 }}>Duplicate Check</th>
              <th style={{ width: 70 }}>Repeat?</th>
              <th style={{ width: 60 }}>2nd Call</th>
              <th style={{ width: 180 }}>2nd Call Note</th>
              <th style={{ width: 50 }}>Paid</th>
              <th style={{ width: 110 }}>Paid Grade/s</th>
              <th>Comments / Call Notes</th>
              <th style={{ width: 45, textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {/* QUICK ADD ROW AT TOP */}
            <tr style={{ background: 'rgba(59,130,246,0.08)', borderBottom: '2px solid var(--accent-blue)' }}>
              <td style={{ textAlign: 'center', color: 'var(--accent-blue)' }}><Plus size={16} /></td>
              <td style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}>AUTO F-CODE</td>
              <td>
                <input
                  className="input-field"
                  style={{ padding: '4px 6px', fontSize: 12 }}
                  placeholder="Raw Phone..."
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddNewRow(e)}
                />
              </td>
              <td style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600 }}>
                {currentMemberName || 'You'}
              </td>
              <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>Auto Date</td>
              <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>New</td>
              <td>
                <input
                  className="input-field"
                  style={{ padding: '4px 6px', fontSize: 12 }}
                  placeholder="Gr"
                  value={newGrade}
                  onChange={e => setNewGrade(e.target.value)}
                />
              </td>
              <td>
                <input
                  className="input-field"
                  style={{ padding: '4px 6px', fontSize: 12 }}
                  placeholder="S26"
                  value={newCampaign}
                  onChange={e => setNewCampaign(e.target.value)}
                />
              </td>
              {/* Duplicate Check */}
              <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>Auto Checked</td>
              {/* Repeat */}
              <td style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>—</td>
              {/* 2nd Call */}
              <td style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>—</td>
              {/* 2nd Call Note */}
              <td>
                <input
                  className="input-field"
                  style={{ padding: '4px 6px', fontSize: 12, width: '100%' }}
                  placeholder="2nd call note..."
                  value={newSecondCallNotes}
                  onChange={e => setNewSecondCallNotes(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddNewRow(e)}
                />
              </td>
              {/* Paid */}
              <td style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>—</td>
              {/* Paid Grade/s */}
              <td style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>—</td>
              {/* Comments + Add button */}
              <td style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  className="input-field"
                  style={{ padding: '4px 6px', fontSize: 12, flex: 1 }}
                  placeholder="Enter comments & press Add..."
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddNewRow(e)}
                />
                <button
                  className="btn-primary"
                  style={{ padding: '4px 10px', fontSize: 11, whiteSpace: 'nowrap' }}
                  onClick={handleAddNewRow}
                  disabled={addingRow || !newPhone.trim()}
                >
                  {addingRow ? 'Adding...' : '+ Add Row'}
                </button>
              </td>
              <td style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>—</td>
            </tr>

            {/* DATA ROWS */}
            {leads.map((lead, idx) => {
              const ownLead = isOwnLead(lead)
              const editable = canEditLead(lead) // admin, own lead, or permitted team lead
              const canEditFullRow = isAdmin || ownLead
              const presence = activePresences[lead.id]

              // Apps Script Formula Line 594-597:
              // DUPLICATE = Same Phone AND Same Campaign!
              const sameCampDupMatch = leads.find((other, oIdx) =>
                oIdx !== idx &&
                other.normalized_phone === lead.normalized_phone &&
                lead.normalized_phone &&
                (other.campaign || '').trim().toLowerCase() === (lead.campaign || '').trim().toLowerCase()
              )

              const isTrueDuplicate = !!sameCampDupMatch

              return (
                <tr
                  key={lead.id}
                  style={{
                    background: isTrueDuplicate ? 'rgba(245, 158, 11, 0.22)' : presence ? `${presence.color}15` : undefined,
                    borderLeft: presence ? `4px solid ${presence.color}` : isTrueDuplicate ? '4px solid #f59e0b' : undefined,
                    transition: 'background 0.2s',
                  }}
                >
                  {/* Lock / Ownership Status */}
                  <td style={{ textAlign: 'center' }}>
                    {canEditFullRow ? (
                      <span style={{ color: '#10b981', fontSize: 11 }} title="You own and can edit all fields in this row">✏</span>
                    ) : editable ? (
                      <span style={{ color: '#38bdf8', fontSize: 11 }} title="Assigned 2nd Call Lead (Only 2nd Call fields editable)">📞</span>
                    ) : (
                      <span title={`Locked (Assigned to ${lead.assigned_member})`} style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <Lock size={12} style={{ color: 'var(--text-muted)' }} />
                      </span>
                    )}
                  </td>

                  {/* F-Code */}
                  <td>
                    <a href={`/leads/${lead.fcode}`} style={{ color: 'var(--accent-blue)', fontWeight: 700, textDecoration: 'none' }}>
                      {lead.fcode}
                    </a>
                  </td>

                  {/* Phone (Display clean normalized number) */}
                  <td>
                    <GridCell
                      editable={canEditFullRow}
                      value={lead.normalized_phone || lead.raw_phone || '—'}
                      onFocus={() => broadcastCellFocus(lead.id, 'phone')}
                      onSave={v => saveCell(lead.id, 'normalized_phone', v, lead)}
                    />
                  </td>

                  {/* Assigned Member */}
                  <td>
                    {isAdmin ? (
                      <GridSelect
                        editable={true}
                        value={lead.assigned_member || 'unassigned'}
                        options={members}
                        onSave={v => saveCell(lead.id, 'assigned_member', v, lead)}
                      />
                    ) : (
                      <span style={{ fontSize: 12, color: lead.assigned_member === currentMemberName ? 'var(--accent-blue)' : 'var(--text-secondary)' }}>
                        {lead.assigned_member || 'Unassigned'}
                      </span>
                    )}
                  </td>

                  {/* Date Added */}
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {lead.date_added?.slice(0, 10) || '—'}
                  </td>

                  {/* Status Dropdown */}
                  <td>
                    <GridSelect
                      editable={canEditFullRow}
                      value={lead.status}
                      options={LEAD_STATUSES}
                      badgeClass={STATUS_COLOR[lead.status] || 'status-default'}
                      onSave={v => saveCell(lead.id, 'status', v, lead)}
                    />
                  </td>

                  {/* Grade */}
                  <td>
                    <GridCell
                      editable={canEditFullRow}
                      value={lead.grade || '—'}
                      onFocus={() => broadcastCellFocus(lead.id, 'grade')}
                      onSave={v => saveCell(lead.id, 'grade', v, lead)}
                    />
                  </td>

                  {/* Campaign */}
                  <td>
                    <GridCell
                      editable={canEditFullRow}
                      value={lead.campaign || '—'}
                      onFocus={() => broadcastCellFocus(lead.id, 'campaign')}
                      onSave={v => saveCell(lead.id, 'campaign', v, lead)}
                    />
                  </td>

                  {/* DUPLICATE WARNING CHECK BAR (Yellow Highlighted on SAME CAMPAIGN match) */}
                  <td>
                    {isTrueDuplicate ? (
                      <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={13} /> DUPLICATE ({sameCampDupMatch?.fcode})
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Clean</span>
                    )}
                  </td>

                  {/* Repeat Student */}
                  <td style={{ textAlign: 'center' }}>
                    {lead.repeat_student ? (
                      <span style={{ color: '#34d399', fontSize: 11, fontWeight: 600 }} title={`Previous Fcode: ${lead.prev_fcode || ''}`}>
                        ⟲ Yes ({lead.prev_fcode || ''})
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>No</span>
                    )}
                  </td>

                  {/* 2nd Call */}
                  <td style={{ textAlign: 'center' }}>
                    <GridCheckbox
                      editable={editable}
                      checked={lead.second_call_done}
                      onSave={v => saveCell(lead.id, 'second_call_done', v, lead)}
                    />
                  </td>

                  {/* 2nd Call Note */}
                  <td>
                    <GridCell
                      editable={editable}
                      value={lead.second_call_notes || '—'}
                      onFocus={() => broadcastCellFocus(lead.id, 'second_call_notes')}
                      onSave={v => saveCell(lead.id, 'second_call_notes', v, lead)}
                    />
                  </td>

                  {/* Paid (Admin Only Edit) */}
                  <td style={{ textAlign: 'center' }}>
                    <GridCheckbox
                      editable={isAdmin}
                      checked={lead.paid}
                      onSave={v => saveCell(lead.id, 'paid', v, lead)}
                    />
                  </td>

                  {/* Paid Grade/s (Admin Only Edit) */}
                  <td>
                    <GridCell
                      editable={isAdmin}
                      value={lead.paid_grades || '—'}
                      onFocus={() => broadcastCellFocus(lead.id, 'paid_grades')}
                      onSave={v => saveCell(lead.id, 'paid_grades', v, lead)}
                    />
                  </td>

                  {/* Comments + Multiplayer Working Badge */}
                  <td style={{ position: 'relative' }}>
                    {presence && (
                      <div style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        background: presence.color, color: '#fff', fontSize: 10, padding: '2px 6px',
                        borderRadius: 10, fontWeight: 700, pointerEvents: 'none'
                      }}>
                        👤 {presence.user_name} is editing...
                      </div>
                    )}
                    <GridCell
                      editable={canEditFullRow}
                      value={lead.comments || '—'}
                      onFocus={() => broadcastCellFocus(lead.id, 'comments')}
                      onSave={v => saveCell(lead.id, 'comments', v, lead)}
                    />
                  </td>

                  {/* Delete Action Cell */}
                  <td style={{ textAlign: 'center' }}>
                    {isAdmin || (currentMemberName && currentMemberName.toLowerCase().includes('admin')) || (lead.assigned_member || '').toLowerCase() === (currentMemberName || '').toLowerCase() || !lead.assigned_member ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteClick(lead)
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: 14,
                          padding: '4px 6px',
                          opacity: 0.85,
                          transition: 'opacity 0.15s, transform 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.85')}
                        title="Delete lead"
                      >
                        🗑
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ padding: '12px 28px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn-secondary" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← Prev</button>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
        </span>
        <button className="btn-secondary" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total}>Next →</button>
      </div>

      {/* Confirmation Modal */}
      {deleteTargetLead && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="card" style={{ maxWidth: 420, width: '90%', padding: 24, borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, color: 'var(--accent-red)' }}>
              <span style={{ fontSize: 22 }}>⚠️</span>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Confirm Delete Lead</h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
              Are you sure you want to permanently delete lead <strong style={{ color: 'var(--text-primary)' }}>{deleteTargetLead.fcode}</strong> ({deleteTargetLead.normalized_phone || deleteTargetLead.raw_phone || 'No phone'})? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                className="btn-secondary"
                onClick={() => setDeleteTargetLead(null)}
                disabled={!!deletingId}
                style={{ padding: '8px 16px', fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={confirmDeleteLead}
                disabled={!!deletingId}
                style={{ padding: '8px 18px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {deletingId ? 'Deleting...' : '🗑 Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GridCell({ editable, value, onSave, onFocus }: { editable: boolean; value: string; onSave: (v: string) => void; onFocus?: () => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)

  useEffect(() => { setVal(value) }, [value])

  if (!editable) {
    return <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{value}</span>
  }

  if (editing) {
    return (
      <input
        className="input-field"
        style={{ padding: '2px 6px', fontSize: 12 }}
        value={val}
        onChange={e => setVal(e.target.value)}
        onFocus={onFocus}
        onBlur={() => { setEditing(false); onSave(val) }}
        onKeyDown={e => {
          if (e.key === 'Enter') { setEditing(false); onSave(val) }
          if (e.key === 'Escape') { setEditing(false); setVal(value) }
        }}
        autoFocus
      />
    )
  }

  return (
    <div
      onClick={() => { setEditing(true); if (onFocus) onFocus() }}
      style={{ cursor: 'pointer', padding: '2px 4px', borderRadius: 4, minHeight: 20 }}
      title="Click to edit cell"
    >
      <span style={{ fontSize: 12 }}>{val}</span>
    </div>
  )
}

function GridSelect({ editable, value, options, badgeClass, onSave }: { editable: boolean; value: string; options: string[]; badgeClass?: string; onSave: (v: string) => void }) {
  if (!editable) {
    return <span className={`badge ${badgeClass || 'status-default'}`}>{value}</span>
  }

  return (
    <select
      className="input-field"
      style={{ padding: '2px 6px', fontSize: 11, height: 26, background: 'transparent' }}
      value={value}
      onChange={e => onSave(e.target.value)}
    >
      {options.map(o => <option key={o} value={o} style={{ background: '#0d1424' }}>{o}</option>)}
    </select>
  )
}

function GridCheckbox({ editable, checked, onSave }: { editable: boolean; checked: boolean; onSave: (v: boolean) => void }) {
  return (
    <input
      type="checkbox"
      disabled={!editable}
      checked={!!checked}
      onChange={e => onSave(e.target.checked)}
      style={{ width: 14, height: 14, cursor: editable ? 'pointer' : 'not-allowed' }}
    />
  )
}
