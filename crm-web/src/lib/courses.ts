// Grade and Course Alignment Configuration System for MathsPS CRM & Payment System

export interface CourseConfig {
  code: string
  name: string
  defaultFee: number
  grade: number // 6, 7, 8, 9, 10, 11 (or other custom grade)
}

export interface GradeConfig {
  grade: number
  label: string
  courses: CourseConfig[]
}

export const DEFAULT_GRADE_COURSES: Record<number, CourseConfig[]> = {
  6: [
    { code: 'GR6_THEORY', name: 'Grade 6 — Theory', defaultFee: 1500, grade: 6 }
  ],
  7: [
    { code: 'GR7_THEORY', name: 'Grade 7 — Theory', defaultFee: 1500, grade: 7 }
  ],
  8: [
    { code: 'GR8_THEORY', name: 'Grade 8 — Theory', defaultFee: 1500, grade: 8 }
  ],
  9: [
    { code: 'GR9_THEORY', name: 'Grade 9 — Theory', defaultFee: 1500, grade: 9 },
    { code: 'GR9_PAPER', name: 'Grade 9 — Paper', defaultFee: 1500, grade: 9 },
    { code: 'GR9_BOTH', name: 'Grade 9 — Theory + Paper (Both)', defaultFee: 2500, grade: 9 }
  ],
  10: [
    { code: 'GR10_THEORY', name: 'Grade 10 — Theory', defaultFee: 1800, grade: 10 },
    { code: 'GR10_PAPER', name: 'Grade 10 — Paper', defaultFee: 1800, grade: 10 },
    { code: 'GR10_BOTH', name: 'Grade 10 — Theory + Paper (Both)', defaultFee: 3000, grade: 10 }
  ],
  11: [
    { code: 'GR11_THEORY', name: 'Grade 11 — Theory', defaultFee: 1800, grade: 11 },
    { code: 'GR11_PAPER', name: 'Grade 11 — Paper', defaultFee: 1800, grade: 11 },
    { code: 'GR11_REVISION', name: 'Grade 11 — Revision', defaultFee: 1800, grade: 11 },
    { code: 'GR11_BOTH', name: 'Grade 11 — Theory + Paper + Revision (Full Package)', defaultFee: 3500, grade: 11 }
  ]
}

// Flat mapping for backward compatibility and quick label lookup
export function getAllCourseLabels(gradeCourses: Record<number, CourseConfig[]> = DEFAULT_GRADE_COURSES): Record<string, string> {
  const map: Record<string, string> = {
    // Legacy support
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

  Object.values(gradeCourses).forEach(list => {
    list.forEach(c => {
      map[c.code] = c.name
    })
  })

  return map
}

export function getAllCourseFees(gradeCourses: Record<number, CourseConfig[]> = DEFAULT_GRADE_COURSES): Record<string, number> {
  const map: Record<string, number> = {
    MAIN_GR6: 1500, MAIN_GR7: 1500, MAIN_GR8: 1500, MAIN_GR9: 1500,
    MAIN_GR10: 1800, MAIN_GR11: 1800, MAIN_MIXED: 1500,
    SHORT_QN: 1500, GEOMETRY_BOOK: 1500, SUPER_REVISION: 1800
  }

  Object.values(gradeCourses).forEach(list => {
    list.forEach(c => {
      map[c.code] = c.defaultFee
    })
  })

  return map
}
