// Grade and Course Alignment Configuration System for MathsPS CRM & Payment System

export type BillingType = 'ONE_TIME' | 'MONTHLY'

export interface CourseConfig {
  code: string
  name: string
  defaultFee: number
  grade?: number // 5, 6, 7, 8, 9, 10, 11, 12, 13 (optional for standalone courses)
  isStandalone?: boolean
  billingType?: BillingType
  description?: string // Rich physical, online, and syllabus notes for AI ingestion
  flyerUrl?: string // Promotional post image link for WhatsApp dispatch
}

export interface GradeConfig {
  grade: number
  label: string
  courses: CourseConfig[]
}

// 1. Default Grade-Aligned Classes (Monthly)
export const DEFAULT_GRADE_COURSES: Record<number, CourseConfig[]> = {
  5: [
    {
      code: 'GR5_FOUNDATION',
      name: 'Grade 5–6 — Foundation Maths',
      defaultFee: 1500,
      grade: 5,
      billingType: 'MONTHLY',
      description: 'Physical & Online Foundation: ගණිතය මූලික සංකල්ප, ලකුණු 75+ ඉලක්ක කරගත් සරල ක්‍රමවේදය.',
      flyerUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800'
    }
  ],
  6: [
    {
      code: 'GR6_THEORY',
      name: 'Grade 6 — Theory',
      defaultFee: 1500,
      grade: 6,
      billingType: 'MONTHLY',
      description: 'Online Live Zoom: සෑම සඳුදා දිනකම සවස 3.30 - 6.00 (LMS Recordings සහිතව). මුල සිට සිද්ධාන්ත සහ වාර විභාග ප්‍රශ්න සාකච්ඡාව.',
      flyerUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800'
    }
  ],
  7: [
    {
      code: 'GR7_THEORY',
      name: 'Grade 7 — Theory',
      defaultFee: 1500,
      grade: 7,
      billingType: 'MONTHLY',
      description: 'Online Live Zoom: සෑම අඟහරුවාදා දිනකම සවස 3.30 - 6.00 (LMS Recordings සහිතව). පාසල් පෙළපොත මුල සිට ආවරණය කිරීම.',
      flyerUrl: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?q=80&w=800'
    }
  ],
  8: [
    {
      code: 'GR8_THEORY',
      name: 'Grade 8 — Theory',
      defaultFee: 1500,
      grade: 8,
      billingType: 'MONTHLY',
      description: 'Online Live Zoom: සෑම බදාදා දිනකම සවස 3.30 - 6.00 (LMS Recordings සහිතව). වීජ ගණිතය සහ ජ්‍යාමිතිය ප්‍රායෝගික පුහුණුව.',
      flyerUrl: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?q=80&w=800'
    }
  ],
  9: [
    {
      code: 'GR9_THEORY',
      name: 'Grade 9 — Theory',
      defaultFee: 1500,
      grade: 9,
      billingType: 'MONTHLY',
      description: 'Online Live Zoom: සෑම බ්‍රහස්පතින්දා දිනකම සවස 3.30 - 6.00 (LMS Recordings සහිතව). 9 ශ්‍රේණිය සම්පූර්ණ සිද්ධාන්ත.',
      flyerUrl: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=800'
    },
    {
      code: 'GR9_PAPER',
      name: 'Grade 9 — Paper',
      defaultFee: 1500,
      grade: 9,
      billingType: 'MONTHLY',
      description: 'Online Live Zoom: ප්‍රශ්න පත්‍ර පන්තිය. පසුගිය වාර විභාග ප්‍රශ්න පත්‍ර සාකච්ඡාව.',
      flyerUrl: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=800'
    },
    {
      code: 'GR9_BOTH',
      name: 'Grade 9 — Theory + Paper (Both)',
      defaultFee: 2500,
      grade: 9,
      billingType: 'MONTHLY',
      description: 'සිද්ධාන්ත සහ ප්‍රශ්න පත්‍ර පන්ති දෙකම එකවර සහභාගී වන සිසුන් සඳහා විශේෂ පැකේජය.',
      flyerUrl: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=800'
    }
  ],
  10: [
    {
      code: 'GR10_THEORY',
      name: 'Grade 10 — Theory',
      defaultFee: 1800,
      grade: 10,
      billingType: 'MONTHLY',
      description: 'Physical & Online: සෑම සිකුරාදා දිනකම සවස 3.00 - 6.30 (Physical: MathsPS Kandy Hall | Online: Zoom Live). O/L ඉලක්කගත A සාමාර්ථ මඟපෙන්වීම.',
      flyerUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800'
    },
    {
      code: 'GR10_PAPER',
      name: 'Grade 10 — Paper',
      defaultFee: 1800,
      grade: 10,
      billingType: 'MONTHLY',
      description: 'සතිපතා Model Papers සහ Speed tests ලකුණු ලබාදීම සමඟ සාකච්ඡා කෙරේ.',
      flyerUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800'
    },
    {
      code: 'GR10_BOTH',
      name: 'Grade 10 — Theory + Paper (Both)',
      defaultFee: 3000,
      grade: 10,
      billingType: 'MONTHLY',
      description: '10 ශ්‍රේණිය සිද්ධාන්ත සහ ප්‍රශ්න පත්‍ර ඒකාබද්ධ පූර්ණ පාඨමාලාව.',
      flyerUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800'
    }
  ],
  11: [
    {
      code: 'GR11_THEORY',
      name: 'Grade 11 — Theory',
      defaultFee: 1800,
      grade: 11,
      billingType: 'MONTHLY',
      description: 'Physical & Online: සෑම සෙනසුරාදා දිනකම උදෑසන 8.00 - 12.30 (Physical Kandy Hall & Zoom Live). O/L සම්පූර්ණ විෂය නිර්දේශය ආවරණය කිරීම.',
      flyerUrl: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?q=80&w=800'
    },
    {
      code: 'GR11_PAPER',
      name: 'Grade 11 — Paper',
      defaultFee: 1800,
      grade: 11,
      billingType: 'MONTHLY',
      description: 'O/L Past Papers වසර 15 සහ Model Papers සාකච්ඡාව. ලකුණු ලබාදීම සහ තනි තනිව අඩුපාඩු නිවැරදි කිරීම.',
      flyerUrl: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?q=80&w=800'
    },
    {
      code: 'GR11_REVISION',
      name: 'Grade 11 — Revision',
      defaultFee: 1800,
      grade: 11,
      billingType: 'MONTHLY',
      description: 'විභාගයට පෙර කෙටි ක්‍රම සහ සිද්ධාන්ත ඉක්මන් පුනරීක්ෂණය.',
      flyerUrl: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?q=80&w=800'
    },
    {
      code: 'GR11_BOTH',
      name: 'Grade 11 — Theory + Paper + Revision (Full Package)',
      defaultFee: 3500,
      grade: 11,
      billingType: 'MONTHLY',
      description: '11 ශ්‍රේණිය O/L A සාමාර්ථයක් සහතික කෙරෙන Theory, Paper සහ Revision සියලු පන්ති ඇතුළත් Full Package එක.',
      flyerUrl: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?q=80&w=800'
    }
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
    description: 'Physical & Online: ජ්‍යාමිතිය ප්‍රමේය 20 ම සහ සාධනය කිරීම් මුල සිට A to Z. Tute නිවසටම Speed Post කෙරේ. O/L ජ්‍යාමිතිය ලකුණු 30 ම ලබාගැනීමට විශේෂ වැඩපිළිවෙල.',
    flyerUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800'
  },
  {
    code: 'BODMAS_MASTER',
    name: 'BODMAS Masterclass (BODMAS මූලධර්ම)',
    defaultFee: 1500,
    isStandalone: true,
    billingType: 'ONE_TIME',
    description: 'ගණිතයේ ලකුණු අඩුවීමට ප්‍රධාන හේතුවක් වන සෘණ/ධන ලකුණු සහ වරහන් සුළු කිරීම් සරලව ප්‍රගුණ කිරීමේ වැඩමුළුව.',
    flyerUrl: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?q=80&w=800'
  },
  {
    code: 'SHORT_QN_BANK',
    name: 'Short Questions Bank (කෙටි ප්‍රශ්න සංග්‍රහය)',
    defaultFee: 1500,
    isStandalone: true,
    billingType: 'ONE_TIME',
    description: 'පළමු ප්‍රශ්න පත්‍රයේ ලකුණු 50 න් 50 ම ලබාගැනීමට කෙටි ප්‍රශ්න 500+ ක පුහුණුව සහ වීඩියෝ විවරණ.',
    flyerUrl: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=800'
  },
  {
    code: 'SUPER_REVISION',
    name: 'Super Revision Masterclass (අවසාන පුනරීක්ෂණය)',
    defaultFee: 1800,
    isStandalone: true,
    billingType: 'ONE_TIME',
    description: 'O/L විභාගය ආසන්නයේ මුළු විෂය නිර්දේශයම දින කිහිපයකින් ආවරණය කෙරෙන දැවැන්ත සම්මන්ත්‍රණ මාලාව.',
    flyerUrl: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?q=80&w=800'
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
