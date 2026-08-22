// Database type definitions — matches our schema.sql exactly

export type PaymentType = 'BANK' | 'CASH' | 'FREE' | 'SIPSA' | 'PHYSICAL' | 'OTHER'
export type EnrollmentTier = 'STANDARD' | 'PREMIUM'
export type MemberRole = 'member' | 'admin' | 'owner' | 'callcenter' | 'payments'
export type LinkConfidence = 'MANUAL' | 'AUTO' | 'CONFIRMED'

export type LeadStatus =
  | 'New' | 'Contacted' | 'Interested' | 'Converted'
  | 'No Answer' | 'Not Interested' | 'Follow-up'
  | 'Second Call Pending' | 'Off' | 'Invalid'
  | 'Wrong number' | 'Busy' | 'Call Another Number'

export const CLASS_TYPES = [
  'MAIN_GR6', 'MAIN_GR7', 'MAIN_GR8', 'MAIN_GR9',
  'MAIN_GR10', 'MAIN_GR11', 'MAIN_MIXED',
  'SHORT_QN', 'GEOMETRY_BOOK', 'SUPER_REVISION'
] as const
export type ClassType = typeof CLASS_TYPES[number]

export const CLASS_LABELS: Record<string, string> = {
  MAIN_GR6: 'Main Class — Grade 6',
  MAIN_GR7: 'Main Class — Grade 7',
  MAIN_GR8: 'Main Class — Grade 8',
  MAIN_GR9: 'Main Class — Grade 9',
  MAIN_GR10: 'Main Class — Grade 10',
  MAIN_GR11: 'Main Class — Grade 11',
  MAIN_MIXED: 'Main Class (Mixed)',
  SHORT_QN: 'කෙටි ප්‍රශ්න (Short Questions)',
  GEOMETRY_BOOK: 'ජ්‍යාමිතිය පොත (Geometry Book)',
  SUPER_REVISION: 'Super Revision',
}

export const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export const LEAD_STATUSES: LeadStatus[] = [
  'New','Contacted','Interested','Converted',
  'No Answer','Not Interested','Follow-up',
  'Second Call Pending','Off','Invalid',
  'Wrong number','Busy','Call Another Number'
]

// ── Database row types ──────────────────────────────────────

export interface Household {
  id: string
  parent_name: string | null
  parent_phone: string | null
  address: string | null
  area: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Student {
  id: string
  ps_code: string
  household_id: string | null
  full_name: string | null
  grade: number | null
  school: string | null
  notes: string | null
  fcode_ref: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // joined
  household?: Household
  enrollments?: Enrollment[]
  payments?: Payment[]
}

export interface Enrollment {
  id: string
  student_id: string
  class_type: string
  tier: EnrollmentTier
  fee_amount: number
  active: boolean
  enrolled_at: string
  created_at: string
}

export interface Payment {
  id: string
  student_id: string
  class_type: string
  month: number
  year: number
  amount_due: number
  amount_paid: number
  balance_before: number
  balance_after: number
  payment_type: PaymentType | null
  bank_name: string | null
  date_paid: string | null
  added_to_group: boolean
  tute_delivered: boolean
  recorded_by: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Member {
  id: string
  name: string
  email: string | null
  role: MemberRole
  active: boolean
  date_joined: string | null
  notes: string | null
  created_at: string
}

export interface Lead {
  id: string
  fcode: string
  raw_phone: string | null
  normalized_phone: string | null
  assigned_member: string | null
  date_added: string | null
  status: LeadStatus
  grade: string | null
  comments: string | null
  campaign: string | null
  repeat_student: boolean
  prev_fcode: string | null
  second_call_done: boolean
  second_call_notes: string | null
  paid: boolean
  paid_grades: string | null
  ps_code_ref: string | null
  created_at: string
  updated_at: string
}

export interface StudentLeadLink {
  id: string
  ps_code: string
  fcode: string
  confidence: LinkConfidence
  linked_by: string | null
  notes: string | null
  linked_at: string
}

// ── View types ──────────────────────────────────────────────

export interface StudentBalance {
  student_id: string
  class_type: string
  total_paid: number
  total_due: number
  current_balance: number
  paid_months: number
  last_payment_date: string | null
}

export interface MonthlyRevenue {
  year: number
  month: number
  class_type: string
  payment_type: string
  payment_count: number
  total_amount: number
}
