'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Plus, RefreshCw, Lock, AlertTriangle, Sparkles, UserCheck, Repeat, Shield, Phone, Edit2, Trash2, User, ChevronDown } from 'lucide-react'
import { Lead, LEAD_STATUSES } from '@/lib/types'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

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
  const [authLoaded, setAuthLoaded] = useState(false)
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

  // Initialize User Info & Permissions FIRST
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        let uName = user.user_metadata?.full_name || user.email?.split('@')[0] || ''
        let uRole = user.user_metadata?.role || (user.email?.toLowerCase().includes('admin') ? 'admin' : 'member')

        if (user.email) {
          const { data: dbMem } = await supabase.from('members').select('name, role, notes').eq('email', user.email).single()
          if (dbMem) {
            if (dbMem.name) uName = dbMem.name
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
      setAuthLoaded(true)
    })
    loadMembers()
  }, [])

  useEffect(() => {
    if (!authLoaded) return
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setPage(0)
      loadLeads(0)
    }, 300)
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [authLoaded, search, statusFilter, memberFilter, currentMemberName, allowedMembers, canViewAll])

  useEffect(() => {
    if (authLoaded) {
      loadLeads(page)
    }
  }, [authLoaded, page])

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
    if (!lead.assigned_member || !currentMemberName) return false
    return lead.assigned_member.trim().toLowerCase() === currentMemberName.trim().toLowerCase()
  }

  function canEditLead(lead: Lead): boolean {
    if (isAdmin) return true
    if (canViewAll) return true
    if (!lead.assigned_member) return false
    const memberName = (lead.assigned_member || '').trim().toLowerCase()
    if (currentMemberName && memberName === currentMemberName.trim().toLowerCase()) return true
    const visibleMembers = allowedMembers.map(m => m.trim().toLowerCase())
    return visibleMembers.includes(memberName)
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
      // 1. Try server API route with service role key
      let deleteSuccess = false
      const res = await fetch('/api/leads/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id }),
      })

      if (res.ok) {
        deleteSuccess = true
      } else {
        // Fallback: direct Supabase deletion from client session
        const { error: sbErr } = await supabase.from('leads').delete().eq('id', lead.id)
        if (!sbErr) {
          deleteSuccess = true
        } else {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || sbErr.message || 'Failed to delete lead')
        }
      }

      if (deleteSuccess) {
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
      }
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
          // Strip any legacy row suffix (e.g. _5120, _5637) from old spreadsheet imports
          const rawPrev = (existing[0].fcode || '').trim()
          const cleanCode = rawPrev.replace(/_\d+$/, '')
          targetFcode = cleanCode
          isRepeat = true
          prevFcodeStr = cleanCode
        }
      }

      // 2. If BRAND NEW phone number -> generate next sequential F-code starting at F80000+
      if (!targetFcode) {
        const { data: allFcodes } = await supabase.from('leads').select('fcode').order('created_at', { ascending: false }).limit(500)
        let maxNum = 80000
        if (allFcodes) {
          allFcodes.forEach(f => {
            const rawFc = (f.fcode || '').trim()
            // Strip any _ suffix if present
            const fc = rawFc.replace(/_\d+$/, '')
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
    <div className="fade-in" style={{ paddingBottom: 60 }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Phone size={22} style={{ color: 'var(--accent-blue)' }} />
            Master Leads Grid
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>Logged in as: <b style={{ color: 'var(--text-primary)' }}>{currentMemberName || 'Staff'}</b></span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: isAdmin ? 'rgba(56, 189, 248, 0.12)' : 'rgba(148, 163, 184, 0.12)',
              color: isAdmin ? 'var(--accent-blue)' : 'var(--text-secondary)',
              padding: '3px 10px', borderRadius: 8,
              border: `1px solid ${isAdmin ? 'rgba(56, 189, 248, 0.3)' : 'var(--border)'}`,
              fontSize: 12, fontWeight: 700
            }}>
              {isAdmin ? (
                <>
                  <Shield size={13} style={{ color: 'var(--accent-blue)' }} /> Admin Access (Global Leads)
                </>
              ) : (
                <>
                  <Lock size={13} style={{ color: 'var(--text-muted)' }} /> Member Access (Edit Assigned Records)
                </>
              )}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => loadLeads(page)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Grid
          </button>
        </div>
      </div>

      {/* Main Glassmorphic Spreadsheet Container */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {/* Filters Bar */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', gap: 12, alignItems: 'center',
          flexWrap: 'wrap',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 360 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="search-bar"
              style={{ paddingLeft: 34, height: 34, fontSize: 12.5 }}
              placeholder="Search phone, F-code, campaign, comments..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="input-field" style={{ width: 140, height: 34, fontSize: 12, paddingLeft: 10 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input-field" style={{ width: 160, height: 34, fontSize: 12, paddingLeft: 10 }} value={memberFilter} onChange={e => setMemberFilter(e.target.value)}>
            <option value="">{isAdmin || canViewAll ? 'All Members' : 'My Visible Team'}</option>
            {members
              .filter(m => isAdmin || canViewAll || [currentMemberName, ...allowedMembers].includes(m))
              .map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontWeight: 600 }}>
            Page {page + 1} of {Math.max(1, Math.ceil(total / PAGE_SIZE))} &bull; <span style={{ color: 'var(--text-primary)' }}>{total.toLocaleString()}</span> leads
          </div>
        </div>

        {/* Data Grid Table */}
        <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
          <table className="data-table" style={{ fontSize: 11.5, width: '100%', minWidth: '100%' }}>
            <thead>
              <tr style={{ background: 'var(--table-header-bg, #0d1424)' }}>
              <th style={{ width: 28, textAlign: 'center', whiteSpace: 'nowrap' }}>
                <Lock size={12} style={{ margin: '0 auto', color: 'var(--text-muted)' }} />
              </th>
              <th style={{ width: 68, whiteSpace: 'nowrap' }}>Code</th>
              <th style={{ width: 88, whiteSpace: 'nowrap' }}>Phone</th>
              <th style={{ width: 78, whiteSpace: 'nowrap' }}>Assigned</th>
              <th style={{ width: 68, whiteSpace: 'nowrap' }}>Date</th>
              <th style={{ width: 84, whiteSpace: 'nowrap' }}>Status</th>
              <th style={{ width: 38, textAlign: 'center', whiteSpace: 'nowrap' }}>Grade</th>
              <th style={{ width: 55, whiteSpace: 'nowrap' }}>Campaign</th>
              <th style={{ minWidth: 100, whiteSpace: 'nowrap' }}>Notes</th>
              <th style={{ width: 65, whiteSpace: 'nowrap' }}>Duplicate</th>
              <th style={{ width: 48, textAlign: 'center', whiteSpace: 'nowrap' }}>Repeat</th>
              <th style={{ width: 48, textAlign: 'center', whiteSpace: 'nowrap' }}>2nd Call</th>
              <th style={{ width: 85, whiteSpace: 'nowrap' }}>2nd Note</th>
              <th style={{ width: 38, textAlign: 'center', whiteSpace: 'nowrap' }}>Paid</th>
              <th style={{ width: 72, whiteSpace: 'nowrap' }}>Paid Grades</th>
              <th style={{ width: 34, textAlign: 'center', whiteSpace: 'nowrap' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {/* QUICK ADD ROW AT TOP */}
            <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
              <td style={{ textAlign: 'center', color: 'var(--accent-blue)' }}><Plus size={13} /></td>
              <td style={{ color: 'var(--text-muted)', fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap' }}>AUTO</td>
              <td>
                <input
                  className="input-field"
                  style={{ padding: '2px 6px', fontSize: 11, height: 26, borderRadius: 6 }}
                  placeholder="Raw Phone.."
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddNewRow(e)}
                />
              </td>
              <td style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 78 }}>
                {currentMemberName || 'You'}
              </td>
              <td style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Auto Date</td>
              <td style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>New</td>
              <td>
                <input
                  className="input-field"
                  style={{ padding: '2px 4px', fontSize: 11, height: 26, textAlign: 'center', borderRadius: 6 }}
                  placeholder="Gr"
                  value={newGrade}
                  onChange={e => setNewGrade(e.target.value)}
                />
              </td>
              <td>
                <input
                  className="input-field"
                  style={{ padding: '2px 6px', fontSize: 11, height: 26, borderRadius: 6 }}
                  placeholder="S26"
                  value={newCampaign}
                  onChange={e => setNewCampaign(e.target.value)}
                />
              </td>
              {/* Comments */}
              <td>
                <input
                  className="input-field"
                  style={{ padding: '2px 6px', fontSize: 11, height: 26, width: '100%', borderRadius: 6 }}
                  placeholder="Comments / Call notes..."
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddNewRow(e)}
                />
              </td>
              {/* Duplicate Check */}
              <td style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Auto</td>
              {/* Repeat */}
              <td style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)' }}>—</td>
              {/* 2nd Call */}
              <td style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)' }}>—</td>
              {/* 2nd Call Note */}
              <td>
                <input
                  className="input-field"
                  style={{ padding: '2px 6px', fontSize: 11, height: 26, width: '100%', borderRadius: 6 }}
                  placeholder="2nd call note..."
                  value={newSecondCallNotes}
                  onChange={e => setNewSecondCallNotes(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddNewRow(e)}
                />
              </td>
              {/* Paid */}
              <td style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)' }}>—</td>
              {/* Paid Grade/s */}
              <td style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)' }}>—</td>
              {/* Action Column Add Button */}
              <td style={{ textAlign: 'center' }}>
                <button
                  className="btn-primary"
                  style={{ padding: '2px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', height: 26, borderRadius: 6 }}
                  onClick={handleAddNewRow}
                  disabled={addingRow || !newPhone.trim()}
                >
                  {addingRow ? '...' : '+ Add'}
                </button>
              </td>
            </tr>

            {/* DATA ROWS */}
            {(!authLoaded || loading) && leads.length === 0 ? (
              <tr>
                <td colSpan={16} style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Loading leads...</span>
                  </div>
                </td>
              </tr>
            ) : leads.map((lead, idx) => {
              const ownLead = isOwnLead(lead)
              const editable = canEditLead(lead) // admin, own lead, or permitted team lead
              // Core Rule: Only Admin or the Lead's assigned owner can edit this lead!
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
                    background: isTrueDuplicate ? 'rgba(245, 158, 11, 0.15)' : presence ? `${presence.color}15` : undefined,
                    borderLeft: presence ? `3px solid ${presence.color}` : isTrueDuplicate ? '3px solid #f59e0b' : undefined,
                    transition: 'background 0.2s',
                  }}
                >
                  {/* Lock / Ownership Status */}
                  <td style={{ textAlign: 'center' }}>
                    {canEditFullRow ? (
                      <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center' }} title="You own and can edit all fields in this row">
                        <Edit2 size={12} />
                      </span>
                    ) : editable ? (
                      <span style={{ color: '#38bdf8', display: 'inline-flex', alignItems: 'center' }} title="Assigned 2nd Call Lead (Only 2nd Call fields editable)">
                        <Phone size={12} />
                      </span>
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
                  <td style={{ maxWidth: 84, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isAdmin ? (
                      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: '100%' }}>
                        <select
                          value={lead.assigned_member || 'unassigned'}
                          onChange={e => saveCell(lead.id, 'assigned_member', e.target.value, lead)}
                          style={{
                            fontSize: 11,
                            padding: '2px 14px 2px 4px',
                            borderRadius: 4,
                            background: 'transparent',
                            color: lead.assigned_member === currentMemberName ? 'var(--accent-blue)' : 'var(--text-secondary)',
                            border: '1px solid transparent',
                            outline: 'none',
                            cursor: 'pointer',
                            width: '100%',
                            appearance: 'none',
                            WebkitAppearance: 'none',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                          title="Click to reassign member"
                        >
                          <option value="unassigned" style={{ background: '#0f172a' }}>unassigned</option>
                          {members.map(m => (
                            <option key={m} value={m} style={{ background: '#0f172a' }}>{m}</option>
                          ))}
                        </select>
                        <ChevronDown size={10} style={{ position: 'absolute', right: 2, pointerEvents: 'none', opacity: 0.5 }} />
                      </div>
                    ) : (
                      <span style={{ fontSize: 11.5, color: lead.assigned_member === currentMemberName ? 'var(--accent-blue)' : 'var(--text-secondary)', fontWeight: lead.assigned_member === currentMemberName ? 600 : 400 }}>
                        {lead.assigned_member || '—'}
                      </span>
                    )}
                  </td>

                  {/* Date Added */}
                  <td style={{ fontSize: 10.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
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
                  <td style={{ textAlign: 'center' }}>
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

                  {/* Comments + Multiplayer Working Badge */}
                  <td style={{ position: 'relative', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {presence && (
                      <div style={{
                        position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                        background: presence.color, color: '#fff', fontSize: 9.5, padding: '1px 5px',
                        borderRadius: 8, fontWeight: 700, pointerEvents: 'none', display: 'inline-flex', alignItems: 'center', gap: 3
                      }}>
                        <User size={9} /> {presence.user_name}
                      </div>
                    )}
                    <GridCell
                      editable={canEditFullRow}
                      value={lead.comments || '—'}
                      onFocus={() => broadcastCellFocus(lead.id, 'comments')}
                      onSave={v => saveCell(lead.id, 'comments', v, lead)}
                    />
                  </td>

                  {/* DUPLICATE WARNING CHECK BAR */}
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {isTrueDuplicate ? (
                      <span style={{ color: '#d97706', fontWeight: 700, fontSize: 10, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <AlertTriangle size={11} /> DUP ({sameCampDupMatch?.fcode})
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Clean</span>
                    )}
                  </td>

                  {/* Repeat Student */}
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {lead.repeat_student ? (
                      <span style={{ color: '#059669', fontSize: 10.5, fontWeight: 600 }} title={`Previous Fcode: ${lead.prev_fcode || ''}`}>
                        ⟲ Yes ({lead.prev_fcode || ''})
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>No</span>
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
                  <td style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                  <td style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <GridCell
                      editable={isAdmin}
                      value={lead.paid_grades || '—'}
                      onFocus={() => broadcastCellFocus(lead.id, 'paid_grades')}
                      onSave={v => saveCell(lead.id, 'paid_grades', v, lead)}
                    />
                  </td>

                  {/* Delete Action Cell — Core Logic: Only Admin or Own Lead can delete */}
                  <td style={{ textAlign: 'center' }}>
                    {isAdmin || (currentMemberName && currentMemberName.toLowerCase().includes('admin')) || ownLead ? (
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
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.85')}
                        title="Delete lead"
                      >
                        <Trash2 size={13} />
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
      <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(255, 255, 255, 0.01)' }}>
        <button className="btn-secondary" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← Prev</button>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
        </span>
        <button className="btn-secondary" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total}>Next →</button>
      </div>
      </div>

      {/* Direct Confirmation Modal (Guaranteed Clicks & Dead-Center Fixed Viewport) */}
      {deleteTargetLead && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: 16,
          }}
          onClick={() => {
            if (!deletingId) setDeleteTargetLead(null)
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 440,
              width: '100%',
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
              color: '#ffffff',
              position: 'relative',
              zIndex: 1000000,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#f43f5e', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
              <AlertTriangle size={20} />
              <span>Confirm Delete Lead</span>
            </div>

            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5, margin: '8px 0 20px' }}>
              Are you sure you want to permanently delete lead{' '}
              <strong style={{ color: '#ffffff' }}>{deleteTargetLead.fcode}</strong>{' '}
              ({deleteTargetLead.normalized_phone || deleteTargetLead.raw_phone || 'No phone'})? This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeleteTargetLead(null)}
                disabled={!!deletingId}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#cbd5e1',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: deletingId ? 0.5 : 1,
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => confirmDeleteLead()}
                disabled={!!deletingId}
                style={{
                  background: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
                  opacity: deletingId ? 0.5 : 1,
                }}
              >
                <Trash2 size={14} />
                {deletingId ? 'Deleting...' : 'Yes, Delete'}
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
    return <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{value}</span>
  }

  if (editing) {
    return (
      <input
        className="input-field"
        style={{ padding: '1px 4px', fontSize: 11.5, height: 22 }}
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
      style={{ cursor: 'pointer', padding: '1px 3px', borderRadius: 4, minHeight: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      title="Click to edit cell"
    >
      <span style={{ fontSize: 11.5 }}>{val}</span>
    </div>
  )
}

function GridSelect({ editable, value, options, badgeClass, onSave }: { editable: boolean; value: string; options: string[]; badgeClass?: string; onSave: (v: string) => void }) {
  if (!editable) {
    return (
      <span
        className={`badge ${badgeClass || 'status-default'}`}
        style={{
          fontSize: 11,
          padding: '3px 8px',
          fontWeight: 600,
          borderRadius: 6,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          opacity: 0.9,
          cursor: 'default',
        }}
      >
        {value}
      </span>
    )
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <select
        value={value}
        onChange={e => onSave(e.target.value)}
        className={`badge ${badgeClass || 'status-default'}`}
        style={{
          fontSize: 11,
          padding: '3px 20px 3px 8px',
          fontWeight: 600,
          borderRadius: 6,
          cursor: 'pointer',
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          border: '1px solid currentColor',
          outline: 'none',
          transition: 'all 0.15s ease',
        }}
        title="Click to change status"
      >
        {options.map(o => (
          <option key={o} value={o} style={{ background: '#0f172a', color: '#f8fafc', fontWeight: 500 }}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown
        size={11}
        style={{
          position: 'absolute',
          right: 6,
          pointerEvents: 'none',
          opacity: 0.7,
        }}
      />
    </div>
  )
}

function GridCheckbox({ editable, checked, onSave }: { editable: boolean; checked: boolean; onSave: (v: boolean) => void }) {
  return (
    <input
      type="checkbox"
      disabled={!editable}
      checked={!!checked}
      onChange={e => onSave(e.target.checked)}
      style={{
        width: 14,
        height: 14,
        accentColor: 'var(--accent-blue)',
        cursor: editable ? 'pointer' : 'not-allowed',
        borderRadius: 4
      }}
    />
  )
}
