import { MONTH_NAMES } from './types'

/**
 * Standard target grades in system
 */
export const TARGET_GRADES = [5, 6, 7, 8, 9, 10, 11] as const

/**
 * Grade visual color map for badges, charts, and table highlights
 */
export const GRADE_COLOR_MAP: Record<number, { stroke: string; fill: string; name: string }> = {
  0: { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.2)', name: 'Total All Grades' },
  5: { stroke: '#14b8a6', fill: 'rgba(20, 184, 166, 0.2)', name: 'Grade 5' },
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

/**
 * Extract grade (5-11) from payment class_type, with fallback to student profile grade.
 * e.g., 'GR6_THEORY' -> 6, 'GR11_BOTH' -> 11, 'GR5_FOUNDATION' -> 5
 */
export function getGradeFromPayment(payment: any): number {
  const cls = (payment?.class_type || '').toUpperCase().trim()
  if (cls.includes('GR5') || cls.includes('GRADE 5') || cls.includes('G5')) return 5
  if (cls.includes('GR6') || cls.includes('GRADE 6') || cls.includes('G6')) return 6
  if (cls.includes('GR7') || cls.includes('GRADE 7') || cls.includes('G7')) return 7
  if (cls.includes('GR8') || cls.includes('GRADE 8') || cls.includes('G8')) return 8
  if (cls.includes('GR9') || cls.includes('GRADE 9') || cls.includes('G9')) return 9
  if (cls.includes('GR10') || cls.includes('GRADE 10') || cls.includes('G10')) return 10
  if (cls.includes('GR11') || cls.includes('GRADE 11') || cls.includes('G11')) return 11

  // Fallback to student profile grade if class_type is not specific (e.g. RECORDING or custom)
  const stGrade = Array.isArray(payment?.students) ? payment?.students[0]?.grade : payment?.students?.grade
  return Number(stGrade) || 0
}
