// Grade and Course Alignment Configuration System for MathsPS CRM & Payment System

export type BillingType = 'ONE_TIME' | 'MONTHLY'

export interface CourseConfig {
  code: string
  name: string
  defaultFee: number
  grade?: number // 5, 6, 7, 8, 9, 10, 11, 12, 13 (optional for standalone courses)
  isStandalone?: boolean
  billingType?: BillingType
  description?: string
}

export interface GradeConfig {
  grade: number
  label: string
  courses: CourseConfig[]
}

// 1. Default Grade-Aligned Classes (Monthly)
export const DEFAULT_GRADE_COURSES: Record<number, CourseConfig[]> = {
  5: [
    { code: 'GR5_FOUNDATION', name: 'Grade 5–6 — Foundation Maths', defaultFee: 1500, grade: 5, billingType: 'MONTHLY' }
  ],
  6: [
    { code: 'GR6_THEORY', name: 'Grade 6 — Theory', defaultFee: 1500, grade: 6, billingType: 'MONTHLY' }
  ],
  7: [
    { code: 'GR7_THEORY', name: 'Grade 7 — Theory', defaultFee: 1500, grade: 7, billingType: 'MONTHLY' }
  ],
  8: [
    { code: 'GR8_THEORY', name: 'Grade 8 — Theory', defaultFee: 1500, grade: 8, billingType: 'MONTHLY' }
  ],
  9: [
    { code: 'GR9_THEORY', name: 'Grade 9 — Theory', defaultFee: 1500, grade: 9, billingType: 'MONTHLY' },
    { code: 'GR9_PAPER', name: 'Grade 9 — Paper', defaultFee: 1500, grade: 9, billingType: 'MONTHLY' },
    { code: 'GR9_BOTH', name: 'Grade 9 — Theory + Paper (Both)', defaultFee: 2500, grade: 9, billingType: 'MONTHLY' }
  ],
  10: [
    { code: 'GR10_THEORY', name: 'Grade 10 — Theory', defaultFee: 1800, grade: 10, billingType: 'MONTHLY' },
    { code: 'GR10_PAPER', name: 'Grade 10 — Paper', defaultFee: 1800, grade: 10, billingType: 'MONTHLY' },
    { code: 'GR10_BOTH', name: 'Grade 10 — Theory + Paper (Both)', defaultFee: 3000, grade: 10, billingType: 'MONTHLY' }
  ],
  11: [
    { code: 'GR11_THEORY', name: 'Grade 11 — Theory', defaultFee: 1800, grade: 11, billingType: 'MONTHLY' },
    { code: 'GR11_PAPER', name: 'Grade 11 — Paper', defaultFee: 1800, grade: 11, billingType: 'MONTHLY' },
    { code: 'GR11_REVISION', name: 'Grade 11 — Revision', defaultFee: 1800, grade: 11, billingType: 'MONTHLY' },
    { code: 'GR11_BOTH', name: 'Grade 11 — Theory + Paper + Revision (Full Package)', defaultFee: 3500, grade: 11, billingType: 'MONTHLY' }
  ]
}

// 2. Default Standalone / Specialist Courses (Geometry, BODMAS, Short Qns, etc.)
export const DEFAULT_STANDALONE_COURSES: CourseConfig[] = [
  {
    code: 'GEOMETRY_FULL',
    name: 'Geometry Full Course (ජ්‍යාමිතිය සම්පූර්ණ පාඨමාලාව)',
    defaultFee: 2500,
    isStandalone: true,
    billingType: 'ONE_TIME',
    description: 'Comprehensive Geometry concepts from Grade 6 to 11 with proofs and exercises.'
  },
  {
    code: 'BODMAS_MASTER',
    name: 'BODMAS Masterclass (BODMAS මූලධර්ම)',
    defaultFee: 1500,
    isStandalone: true,
    billingType: 'ONE_TIME',
    description: 'Master order of operations, signs, and algebraic simplifications from the ground up.'
  },
  {
    code: 'SHORT_QN_BANK',
    name: 'Short Questions Bank (කෙටි ප්‍රශ්න සංග්‍රහය)',
    defaultFee: 1500,
    isStandalone: true,
    billingType: 'ONE_TIME',
    description: '500+ Essential short question practice pack with video breakdown.'
  },
  {
    code: 'SUPER_REVISION',
    name: 'Super Revision Masterclass (අවසාන පුනරීක්ෂණය)',
    defaultFee: 1800,
    isStandalone: true,
    billingType: 'ONE_TIME',
    description: 'High-yield exam review covering the entire syllabus.'
  }
]

// Flat mapping for backward compatibility and quick label lookup
export function getAllCourseLabels(
  gradeCourses: Record<number, CourseConfig[]> = DEFAULT_GRADE_COURSES,
  standaloneCourses: CourseConfig[] = DEFAULT_STANDALONE_COURSES
): Record<string, string> {
  const map: Record<string, string> = {
    // Legacy support
    GR5_FOUNDATION: 'Grade 5–6 — Foundation Maths',
    MAIN_GR6: 'Grade 6 — Theory',
    MAIN_GR7: 'Grade 7 — Theory',
    MAIN_GR8: 'Grade 8 — Theory',
    MAIN_GR9: 'Grade 9 — Theory',
    MAIN_GR10: 'Grade 10 — Theory',
    MAIN_GR11: 'Grade 11 — Theory',
    MAIN_MIXED: 'Main Class (Mixed)',
    SHORT_QN: 'කෙටි ප්‍රශ්න (Short Questions)',
    GEOMETRY_BOOK: 'ජ්‍යාමිතිය පොත (Geometry Book)',
    SUPER_REVISION: 'Super Revision'
  }

  // Add all grade courses
  Object.values(gradeCourses).forEach(list => {
    list.forEach(c => {
      map[c.code] = c.name
    })
  })

  // Add all standalone courses
  standaloneCourses.forEach(c => {
    map[c.code] = c.name
  })

  return map
}

export function getAllCourseFees(
  gradeCourses: Record<number, CourseConfig[]> = DEFAULT_GRADE_COURSES,
  standaloneCourses: CourseConfig[] = DEFAULT_STANDALONE_COURSES
): Record<string, number> {
  const map: Record<string, number> = {
    MAIN_GR6: 1500, MAIN_GR7: 1500, MAIN_GR8: 1500, MAIN_GR9: 1500,
    MAIN_GR10: 1800, MAIN_GR11: 1800, MAIN_MIXED: 1500,
    SHORT_QN: 1500, GEOMETRY_BOOK: 1500, SUPER_REVISION: 1800
  }

  // Add all grade courses
  Object.values(gradeCourses).forEach(list => {
    list.forEach(c => {
      map[c.code] = c.defaultFee
    })
  })

  // Add all standalone courses
  standaloneCourses.forEach(c => {
    map[c.code] = c.defaultFee
  })

  return map
}

// 3. Payment Methods & Banks Configuration
export const DEFAULT_PAYMENT_METHODS = ['BANK', 'CASH', 'FREE', 'IMS', 'PHYSICAL']

export const DEFAULT_BANKS = [
  'BOC',
  'Sampath',
  'Commercial',
  'HNB',
  "People's Bank",
  'NSB',
  'Seylan',
  'NTB',
  'Other'
]

export function getCourseBillingType(
  courseCode: string,
  gradeCourses: Record<number, CourseConfig[]> = DEFAULT_GRADE_COURSES,
  standaloneCourses: CourseConfig[] = DEFAULT_STANDALONE_COURSES
): BillingType {
  const foundStandalone = standaloneCourses.find(c => c.code === courseCode)
  if (foundStandalone?.billingType) return foundStandalone.billingType

  for (const list of Object.values(gradeCourses)) {
    const found = list.find(c => c.code === courseCode)
    if (found?.billingType) return found.billingType
  }

  return 'MONTHLY'
}
