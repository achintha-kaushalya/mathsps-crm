import { MONTH_NAMES } from './types'

/**
 * Standard target grades in system
 */
export const TARGET_GRADES = [6, 7, 8, 9, 10, 11] as const

/**
 * Grade visual color map for badges, charts, and table highlights
 */
export const GRADE_COLOR_MAP: Record<number, { stroke: string; fill: string; name: string }> = {
  0: { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.2)', name: 'Total All Grades' },
  6: { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.2)', name: 'Grade 6' },
  7: { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.2)', name: 'Grade 7' },
  8: { stroke: '#ec4899', fill: 'rgba(236, 72, 153, 0.2)', name: 'Grade 8' },
  9: { stroke: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.2)', name: 'Grade 9' },
  10: { stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.2)', name: 'Grade 10' },
  11: { stroke: '#f97316', fill: 'rgba(249, 115, 22, 0.2)', name: 'Grade 11' },
}

/**
 * Clean phone number for WhatsApp link
 */
export function sanitizePhoneForWhatsApp(phone?: string | null): string {
  if (!phone) return ''
  let cleaned = phone.replace(/[^0-9]/g, '')
  if (cleaned.startsWith('0')) {
    cleaned = '94' + cleaned.slice(1)
  }
  return cleaned
}

/**
 * Reusable CSV Exporter
 */
export function exportTableToCsv(filename: string, headers: string[], rows: string[][]): void {
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Format date string DD/MM/YYYY
 */
export function formatDateDMY(d: number, m: number, y: number): string {
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}
