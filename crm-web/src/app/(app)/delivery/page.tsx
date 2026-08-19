'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Truck, Printer, Search, CheckCircle, Package } from 'lucide-react'
import { CLASS_LABELS, MONTH_NAMES } from '@/lib/types'

interface DeliveryGroup {
  household_id: string
  parent_name: string
  address: string
  area: string
  students: {
    ps_code: string
    full_name: string
    grade: number
    class_type: string
  }[]
}

export default function DeliveryPage() {
  const supabase = createClient()
  const [groups, setGroups] = useState<DeliveryGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [classFilter, setClassFilter] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [areas, setAreas] = useState<string[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => { loadDeliveryList() }, [month, year, classFilter, areaFilter])

  async function loadDeliveryList() {
    setLoading(true)
    try {
      // 1. Get eligible PREMIUM enrollment students who paid for selected month/year
      let q = supabase
        .from('payments')
        .select(`
          student_id, class_type, month, year, amount_paid, payment_type,
          students!inner(
            id, ps_code, full_name, grade, household_id,
            households(id, parent_name, address, area),
            enrollments!inner(tier, active)
          )
        `)
        .eq('month', month)
        .eq('year', year)
        .eq('students.enrollments.tier', 'PREMIUM')
        .eq('students.enrollments.active', true)

      if (classFilter) q = q.eq('class_type', classFilter)

      const { data, error } = await q
      if (error) throw error

      // 2. Group by Household (or by Student if no household)
      const groupedMap: Record<string, DeliveryGroup> = {}
      const areaSet = new Set<string>()

      ;(data || []).forEach((item: any) => {
        const stu = item.students
        const hh = stu?.households
        const key = hh?.id || `no-hh-${stu.id}`

        const areaName = hh?.area || 'Unassigned Area'
        if (hh?.area) areaSet.add(hh.area)

        if (!groupedMap[key]) {
          groupedMap[key] = {
            household_id: key,
            parent_name: hh?.parent_name || stu.full_name || 'Parent/Student',
            address: hh?.address || 'No address provided',
            area: areaName,
            students: [],
          }
        }

        // Avoid adding duplicate student class combos
        const exists = groupedMap[key].students.some(
          s => s.ps_code === stu.ps_code && s.class_type === item.class_type
        )
        if (!exists) {
          groupedMap[key].students.push({
            ps_code: stu.ps_code,
            full_name: stu.full_name || 'Student',
            grade: stu.grade || 0,
            class_type: item.class_type,
          })
        }
      })

      let result = Object.values(groupedMap)
      if (areaFilter) {
        result = result.filter(g => g.area === areaFilter)
      }

      setAreas(Array.from(areaSet).sort())
      setGroups(result)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const filteredGroups = groups.filter(g => {
    if (!search.trim()) return true
    const s = search.toLowerCase()
    return (
      g.parent_name.toLowerCase().includes(s) ||
      g.address.toLowerCase().includes(s) ||
      g.area.toLowerCase().includes(s) ||
      g.students.some(st => st.ps_code.toLowerCase().includes(s) || st.full_name.toLowerCase().includes(s))
    )
  })

  function printBatchEnvelopes() {
    if (filteredGroups.length === 0) {
      alert('No envelopes to print in current filter.')
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
            .address { font-size: 14px; line-height: 1.4; margin-top: 6px; white-space: pre-line; }
            .area { font-size: 12px; font-weight: bold; margin-top: 6px; background: #eee; padding: 2px 6px; display: inline-block; border-radius: 4px; }
            .pack-list { border-top: 1px solid #ccc; padding-top: 10px; margin-top: 10px; }
            .pack-title { font-size: 11px; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; }
            .item { font-size: 12px; margin-bottom: 4px; }
          </style>
        </head>
        <body onload="window.print()">
          <div class="grid">
            ${filteredGroups.map(g => `
              <div class="card">
                <div>
                  <div class="header">
                    <div class="title">TUTE DELIVERY ENVELOPE (ONE PACK PER HOUSE)</div>
                    <div class="to-name">To: ${g.parent_name}</div>
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

  const totalEnvelopes = filteredGroups.length
  const totalTutes = filteredGroups.reduce((acc, g) => acc + g.students.length, 0)

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Truck size={22} style={{ color: 'var(--accent-orange)' }} />
            Household Tute Delivery
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            Grouping paid Premium Tier students into 1 envelope per house
          </div>
        </div>
        <button onClick={printBatchEnvelopes} className="btn-primary" style={{ background: 'var(--accent-orange)' }}>
          <Printer size={16} /> Print All Envelope Labels ({totalEnvelopes})
        </button>
      </div>

      <div className="page-content">
        {/* Controls */}
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
              <input className="search-bar" style={{ paddingLeft: 32 }} placeholder="Search name, address, PS code..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
          <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-orange)' }}>
            <div className="stat-card label">Total Envelopes (Houses)</div>
            <div className="stat-card value" style={{ color: 'var(--accent-orange)' }}>{totalEnvelopes}</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-blue)' }}>
            <div className="stat-card label">Total Tutes Included</div>
            <div className="stat-card value" style={{ color: 'var(--accent-blue)' }}>{totalTutes}</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-green)' }}>
            <div className="stat-card label">Envelopes Saved (Combined)</div>
            <div className="stat-card value" style={{ color: 'var(--accent-green)' }}>{Math.max(0, totalTutes - totalEnvelopes)}</div>
          </div>
        </div>

        {/* Delivery Cards Grid */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Building delivery list...</div>
        ) : filteredGroups.length === 0 ? (
          <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            No Premium tier paid students found for {MONTH_NAMES[month - 1]} {year} matching these filters.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {filteredGroups.map(g => (
              <div key={g.household_id} className="glass-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{g.parent_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--accent-orange)', fontWeight: 600, marginTop: 2 }}>
                        📍 AREA: {g.area}
                      </div>
                    </div>
                    <span className="badge" style={{ background: '#2a1a1a', color: '#fb923c', fontSize: 11 }}>
                      {g.students.length} Tutes inside
                    </span>
                  </div>

                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, background: 'var(--bg-base)', padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}>
                    {g.address}
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    Included Tutes:
                  </div>

                  {g.students.map(st => (
                    <div key={`${st.ps_code}-${st.class_type}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 4 }}>
                      <Package size={14} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                      <span>
                        <strong style={{ color: 'var(--accent-blue)' }}>{st.ps_code}</strong> · {st.full_name} (Gr {st.grade})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
