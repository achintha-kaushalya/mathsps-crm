'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Truck, Printer, Search, CheckCircle2, Package, History, Check, RotateCcw, Clock, AlertCircle, FileSpreadsheet } from 'lucide-react'
import { CLASS_LABELS, MONTH_NAMES } from '@/lib/types'

interface DeliveryStudentItem {
  paymentId: string
  studentId: string
  ps_code: string
  full_name: string
  grade: number
  class_type: string
  date_paid: string
  notes: string
  dispatched: boolean
  batch_id?: string
  dispatched_at?: string
}

interface DeliveryGroup {
  household_id: string
  parent_name: string
  parent_phone: string
  address: string
  area: string
  isDispatched: boolean
  latestBatchId?: string
  dispatchedAt?: string
  students: DeliveryStudentItem[]
}

export default function DeliveryPage() {
  const supabase = createClient()

  // Active Tab: 'unexported' (Ready to Dispatch) vs 'dispatched' (Already Exported History)
  const [activeTab, setActiveTab] = useState<'unexported' | 'dispatched'>('unexported')

  const [allGroups, setAllGroups] = useState<DeliveryGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [classFilter, setClassFilter] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [areas, setAreas] = useState<string[]>([])
  const [search, setSearch] = useState('')

  // Batch action state
  const [selectedHouseholds, setSelectedHouseholds] = useState<Set<string>>(new Set())
  const [marking, setMarking] = useState(false)
  const [actionMessage, setActionMessage] = useState('')

  useEffect(() => {
    loadDeliveryList()
  }, [month, year, classFilter, areaFilter])

  async function loadDeliveryList() {
    setLoading(true)
    try {
      // 1. Fetch eligible payments for this month where tute is to be delivered
      let q = supabase
        .from('payments')
        .select(`
          id, student_id, class_type, month, year, amount_paid, payment_type, tute_delivered, date_paid, notes,
          students!inner(
            id, ps_code, full_name, grade, household_id,
            households(id, parent_name, address, area, parent_phone)
          )
        `)
        .eq('month', month)
        .eq('year', year)
        .or('tute_delivered.eq.true,amount_paid.gt.0')

      if (classFilter) q = q.eq('class_type', classFilter)

      const { data, error } = await q
      if (error) throw error

      const groupedMap: Record<string, DeliveryGroup> = {}
      const areaSet = new Set<string>()

      ;(data || []).forEach((item: any) => {
        const stu = item.students
        const hh = stu?.households
        const key = hh?.id || `no-hh-${stu.id}`

        const areaName = hh?.area || 'Unassigned Area'
        if (hh?.area) areaSet.add(hh.area)

        // Parse dispatch notes if saved in notes format: [DISPATCHED: BATCH_YYYYMMDD_HHMM]
        const isItemDispatched = (item.notes || '').includes('[DISPATCHED:')
        let batchId = ''
        let dispatchedAt = ''

        if (isItemDispatched) {
          const match = item.notes.match(/\[DISPATCHED:\s*([^\]]+)\]/)
          if (match) {
            batchId = match[1].trim()
            dispatchedAt = batchId.replace('BATCH_', '')
          }
        }

        if (!groupedMap[key]) {
          groupedMap[key] = {
            household_id: key,
            parent_name: hh?.parent_name || stu.full_name || 'Parent / Student',
            parent_phone: hh?.parent_phone || '',
            address: hh?.address || 'No address provided',
            area: areaName,
            isDispatched: isItemDispatched,
            latestBatchId: batchId,
            dispatchedAt: dispatchedAt,
            students: [],
          }
        }

        // Add class item
        const existingStudentIndex = groupedMap[key].students.findIndex(
          s => s.paymentId === item.id
        )
        if (existingStudentIndex === -1) {
          groupedMap[key].students.push({
            paymentId: item.id,
            studentId: stu.id,
            ps_code: stu.ps_code,
            full_name: stu.full_name || 'Student',
            grade: stu.grade || 0,
            class_type: item.class_type,
            date_paid: item.date_paid || '',
            notes: item.notes || '',
            dispatched: isItemDispatched,
            batch_id: batchId,
            dispatched_at: dispatchedAt,
          })
        }

        // If any item in this household is not dispatched, household shows as unexported
        if (!isItemDispatched) {
          groupedMap[key].isDispatched = false
        }
      })

      let result = Object.values(groupedMap)
      if (areaFilter) {
        result = result.filter(g => g.area === areaFilter)
      }

      setAreas(Array.from(areaSet).sort())
      setAllGroups(result)

      // Auto-select all unexported by default
      const unexp = new Set(result.filter(g => !g.isDispatched).map(g => g.household_id))
      setSelectedHouseholds(unexp)

    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Filter based on active tab ('unexported' vs 'dispatched') + search
  const visibleGroups = allGroups
    .filter(g => (activeTab === 'unexported' ? !g.isDispatched : g.isDispatched))
    .filter(g => {
      if (!search.trim()) return true
      const s = search.toLowerCase()
      return (
        g.parent_name.toLowerCase().includes(s) ||
        g.address.toLowerCase().includes(s) ||
        g.area.toLowerCase().includes(s) ||
        g.parent_phone.toLowerCase().includes(s) ||
        g.students.some(st => st.ps_code.toLowerCase().includes(s) || st.full_name.toLowerCase().includes(s))
      )
    })

  const unexportedCount = allGroups.filter(g => !g.isDispatched).length
  const dispatchedCount = allGroups.filter(g => g.isDispatched).length

  function toggleSelectHousehold(hhId: string) {
    const next = new Set(selectedHouseholds)
    if (next.has(hhId)) {
      next.delete(hhId)
    } else {
      next.add(hhId)
    }
    setSelectedHouseholds(next)
  }

  function toggleSelectAll() {
    if (selectedHouseholds.size === visibleGroups.length) {
      setSelectedHouseholds(new Set())
    } else {
      setSelectedHouseholds(new Set(visibleGroups.map(g => g.household_id)))
    }
  }

  // Batch Export & Auto-Mark as Dispatched
  async function exportAndMarkBatch() {
    const targetGroups = visibleGroups.filter(g => selectedHouseholds.has(g.household_id))
    if (targetGroups.length === 0) {
      alert('Please select at least one household to export.')
      return
    }

    const now = new Date()
    const timeStampStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    const humanTime = now.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    const batchTag = `BATCH_${timeStampStr}`

    // 1. Generate Post Office CSV
    const headers = [
      'BATCH ID',
      'DISPATCH TIME',
      'PS CODE',
      'STUDENT NAME',
      'GRADE',
      'PARENT / RECIPIENT',
      'PHONE',
      'DELIVERY ADDRESS',
      'AREA / ROUTE',
      'ENROLLED CLASSES & TUTES',
      'MONTH / YEAR',
    ]

    const rows: string[][] = []
    const paymentIdsToUpdate: string[] = []

    targetGroups.forEach(g => {
      g.students.forEach(st => {
        paymentIdsToUpdate.push(st.paymentId)
        rows.push([
          `"${batchTag}"`,
          `"${humanTime}"`,
          `"${st.ps_code}"`,
          `"${(st.full_name || '').replace(/"/g, '""')}"`,
          `"Grade ${st.grade || '?'}"`,
          `"${(g.parent_name || '').replace(/"/g, '""')}"`,
          `"${(g.parent_phone || '').replace(/"/g, '""')}"`,
          `"${(g.address || '').replace(/"/g, '""')}"`,
          `"${(g.area || '').replace(/"/g, '""')}"`,
          `"${CLASS_LABELS[st.class_type] || st.class_type}"`,
          `"${MONTH_NAMES[month - 1]} ${year}"`,
        ])
      })
    })

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Post_Office_Dispatch_${batchTag}_(${targetGroups.length}_Houses).csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    // 2. Mark updated payment records in Supabase
    setMarking(true)
    try {
      for (const pId of paymentIdsToUpdate) {
        // Fetch current notes to avoid overwriting existing text
        const { data: curPay } = await supabase.from('payments').select('notes').eq('id', pId).single()
        const oldNotes = (curPay?.notes || '').replace(/\[DISPATCHED:[^\]]+\]/g, '').trim()
        const newNotes = oldNotes ? `${oldNotes} [DISPATCHED: ${batchTag}]` : `[DISPATCHED: ${batchTag}]`

        await supabase.from('payments').update({ notes: newNotes }).eq('id', pId)
      }

      setActionMessage(`✓ Exported & Marked ${targetGroups.length} Houses as Dispatched (${batchTag})!`)
      setTimeout(() => setActionMessage(''), 5000)

      await loadDeliveryList()
    } catch (err: any) {
      alert('Failed to mark batch status: ' + err.message)
    } finally {
      setMarking(false)
    }
  }

  // Restore Dispatched items back to Unexported queue
  async function revertDispatchedBatch(g: DeliveryGroup) {
    if (!confirm(`Revert ${g.parent_name} (${g.students.map(s => s.ps_code).join(', ')}) back to Unexported queue?`)) return

    setMarking(true)
    try {
      for (const st of g.students) {
        const { data: curPay } = await supabase.from('payments').select('notes').eq('id', st.paymentId).single()
        const cleanedNotes = (curPay?.notes || '').replace(/\[DISPATCHED:[^\]]+\]/g, '').trim()
        await supabase.from('payments').update({ notes: cleanedNotes || null }).eq('id', st.paymentId)
      }
      await loadDeliveryList()
    } catch (err: any) {
      alert('Failed to revert: ' + err.message)
    } finally {
      setMarking(false)
    }
  }

  function printBatchEnvelopes() {
    const targetGroups = visibleGroups.filter(g => selectedHouseholds.has(g.household_id))
    if (targetGroups.length === 0) {
      alert('No envelopes selected to print.')
      return
    }

    const win = window.open('', '_blank')
    win?.document.write(`
      <html>
        <head>
          <title>Tute Delivery Envelopes — ${MONTH_NAMES[month - 1]} ${year}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #fff; color: #000; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12mm; }
            .card {
              border: 2px solid #000;
              border-radius: 8px;
              padding: 16px;
              box-sizing: border-box;
              page-break-inside: avoid;
              min-height: 120mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .header { border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 12px; }
            .title { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #555; }
            .to-name { font-size: 16px; font-weight: bold; margin-top: 4px; }
            .phone { font-size: 13px; font-weight: bold; color: #222; margin-top: 2px; }
            .address { font-size: 14px; line-height: 1.4; margin-top: 6px; white-space: pre-line; }
            .area { font-size: 12px; font-weight: bold; margin-top: 6px; background: #eee; padding: 2px 6px; display: inline-block; border-radius: 4px; }
            .pack-list { border-top: 1px solid #ccc; padding-top: 10px; margin-top: 10px; }
            .pack-title { font-size: 11px; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; }
            .item { font-size: 12px; margin-bottom: 4px; }
          </style>
        </head>
        <body onload="window.print()">
          <div class="grid">
            ${targetGroups.map(g => `
              <div class="card">
                <div>
                  <div class="header">
                    <div class="title">TUTE DELIVERY ENVELOPE (ONE PACK PER HOUSE)</div>
                    <div class="to-name">To: ${g.parent_name}</div>
                    ${g.parent_phone ? `<div class="phone">📞 Phone: ${g.parent_phone}</div>` : ''}
                    <div class="address">${g.address}</div>
                    <div class="area">AREA: ${g.area}</div>
                  </div>
                </div>
                <div class="pack-list">
                  <div class="pack-title">TUTES INSIDE THIS ENVELOPE:</div>
                  ${g.students.map(st => `
                    <div class="item">
                      ✔ <b>[${st.ps_code}]</b> ${st.full_name} (Gr ${st.grade}) — ${CLASS_LABELS[st.class_type] || st.class_type}
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </body>
      </html>
    `)
  }

  const selectedCount = visibleGroups.filter(g => selectedHouseholds.has(g.household_id)).length
  const totalTutesSelected = visibleGroups
    .filter(g => selectedHouseholds.has(g.household_id))
    .reduce((acc, g) => acc + g.students.length, 0)

  return (
    <div className="fade-in" style={{ paddingBottom: 60 }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Truck size={22} style={{ color: 'var(--accent-orange)' }} />
            Tute Delivery & Post Office Batch Dispatch
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            Manage new vs. already dispatched parcel exports to avoid duplicate deliveries
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {activeTab === 'unexported' ? (
            <>
              <button
                onClick={exportAndMarkBatch}
                disabled={marking || selectedCount === 0}
                className="btn-primary"
                style={{
                  background: '#10b981', display: 'flex', alignItems: 'center', gap: 6,
                  fontWeight: 700, opacity: selectedCount === 0 ? 0.6 : 1
                }}
              >
                <FileSpreadsheet size={16} />
                {marking ? 'Exporting...' : `Export (${selectedCount})`}
              </button>
              <button
                onClick={printBatchEnvelopes}
                disabled={selectedCount === 0}
                className="btn-primary"
                style={{ background: 'var(--accent-orange)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
              >
                <Printer size={16} /> Print Labels ({selectedCount})
              </button>
            </>
          ) : (
            <button
              onClick={printBatchEnvelopes}
              disabled={selectedCount === 0}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Printer size={16} /> Print Labels ({selectedCount})
            </button>
          )}
        </div>
      </div>

      <div className="page-content">
        {/* Success Action Message */}
        {actionMessage && (
          <div style={{
            padding: '12px 16px', background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981',
            borderRadius: 8, color: '#34d399', fontSize: 13, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8
          }}>
            <CheckCircle2 size={16} /> {actionMessage}
          </div>
        )}

        {/* Tab Switcher: Unexported / New vs Dispatched History */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <button
            onClick={() => {
              setActiveTab('unexported')
              const unexp = new Set(allGroups.filter(g => !g.isDispatched).map(g => g.household_id))
              setSelectedHouseholds(unexp)
            }}
            className={activeTab === 'unexported' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Clock size={16} />
            Ready to Export (New)
            <span style={{
              background: activeTab === 'unexported' ? 'rgba(255,255,255,0.2)' : 'rgba(239,68,68,0.2)',
              color: activeTab === 'unexported' ? '#fff' : '#f87171',
              padding: '2px 8px', borderRadius: 12, fontSize: 11
            }}>
              {unexportedCount}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('dispatched')
              setSelectedHouseholds(new Set())
            }}
            className={activeTab === 'dispatched' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <History size={16} />
            Already Dispatched / Exported History
            <span style={{
              background: activeTab === 'dispatched' ? 'rgba(255,255,255,0.2)' : 'rgba(16,185,129,0.2)',
              color: activeTab === 'dispatched' ? '#fff' : '#34d399',
              padding: '2px 8px', borderRadius: 12, fontSize: 11
            }}>
              {dispatchedCount}
            </span>
          </button>
        </div>

        {/* Filters Bar */}
        <div className="glass-card" style={{ padding: 18, marginBottom: 20, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Month</label>
            <select className="input-field" style={{ width: 130 }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
              {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Year</label>
            <select className="input-field" style={{ width: 100 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
              {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Class</label>
            <select className="input-field" style={{ width: 180 }} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
              <option value="">All Classes</option>
              {Object.entries(CLASS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Area / Route</label>
            <select className="input-field" style={{ width: 160 }} value={areaFilter} onChange={e => setAreaFilter(e.target.value)}>
              <option value="">All Areas</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Search</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="search-bar" style={{ paddingLeft: 32 }} placeholder="Search name, phone, address, PS code..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Selection & Summary Bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
          padding: '12px 16px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              id="select-all"
              checked={visibleGroups.length > 0 && selectedHouseholds.size === visibleGroups.length}
              onChange={toggleSelectAll}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <label htmlFor="select-all" style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Select All {visibleGroups.length} Houses
            </label>
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Selected: <b style={{ color: 'var(--accent-orange)' }}>{selectedCount} Houses</b> ({totalTutesSelected} Tutes)
          </div>
        </div>

        {/* Delivery Cards Grid */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Building delivery list...</div>
        ) : visibleGroups.length === 0 ? (
          <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            {activeTab === 'unexported'
              ? `No unexported/new delivery records pending for ${MONTH_NAMES[month - 1]} ${year}. All morning records are dispatched!`
              : `No previously dispatched batch records found for ${MONTH_NAMES[month - 1]} ${year}.`}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {visibleGroups.map(g => {
              const isSelected = selectedHouseholds.has(g.household_id)

              return (
                <div
                  key={g.household_id}
                  className="glass-card"
                  style={{
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    borderColor: isSelected ? 'var(--accent-blue)' : 'var(--border)',
                    background: isSelected ? 'rgba(59,130,246,0.04)' : 'var(--bg-card)',
                    transition: 'all 0.15s'
                  }}
                >
                  <div>
                    {/* Card Header: Checkbox + Name + Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectHousehold(g.household_id)}
                          style={{ width: 18, height: 18, marginTop: 3, cursor: 'pointer' }}
                        />
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{g.parent_name}</div>
                          {g.parent_phone && (
                            <div style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600, marginTop: 2 }}>
                              📞 {g.parent_phone}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: 'var(--accent-orange)', fontWeight: 600, marginTop: 2 }}>
                            📍 AREA: {g.area}
                          </div>
                        </div>
                      </div>

                      <span className="badge" style={{ background: '#2a1a1a', color: '#fb923c', fontSize: 11 }}>
                        {g.students.length} Tute(s)
                      </span>
                    </div>

                    {/* Address Box */}
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, background: 'var(--bg-base)', padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}>
                      {g.address}
                    </div>

                    {/* Included Tutes List */}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                      Included Tutes:
                    </div>

                    {g.students.map(st => (
                      <div key={`${st.ps_code}-${st.class_type}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 4 }}>
                        <Package size={14} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                        <span>
                          <strong style={{ color: 'var(--accent-blue)' }}>{st.ps_code}</strong> · {st.full_name} (Gr {st.grade}) — {CLASS_LABELS[st.class_type] || st.class_type}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Batch Information / Revert Button for Dispatched History */}
                  {g.isDispatched && (
                    <div style={{
                      marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>
                        ✓ {g.latestBatchId || 'Dispatched'}
                      </div>
                      <button
                        type="button"
                        onClick={() => revertDispatchedBatch(g)}
                        className="btn-secondary"
                        style={{ padding: '3px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                        title="Move back to Unexported list"
                      >
                        <RotateCcw size={12} /> Revert to New
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
