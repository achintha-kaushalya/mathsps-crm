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
  groupLink?: string // WhatsApp community/group link for this grade/class
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
      name: 'Grade 5–6 — Foundation Maths (පදනම් ගණිතය)',
      defaultFee: 1500,
      grade: 5,
      billingType: 'MONTHLY',
      groupLink: 'https://chat.whatsapp.com/ILXpa5icYao6Kwpk5Qvawn',
      flyerUrl: 'https://wpp.raybeamdigital.com/assets/media/flow_nodes/2d0a1a83-67e5-40c8-9534-93963ea1fb98-5cbcd4f1-920c-49c6-9fc4-0fb1fd79330c.jpeg',
      description: 'Online: ලංකාවටම Online — බදාදා හවස 6.00 ට.\n• ශිෂ්‍යත්වය නිමකළ 5 න් 6 ට යන පොඩ්ඩන්ගේ Logic එක හදන්නම ඇරඹෙන පදනම් ගණිතය.\n• WhatsApp Group: https://chat.whatsapp.com/ILXpa5icYao6Kwpk5Qvawn\n• LMS: www.prabuddhamaths.com | Tutes Speed Post මඟින් නිවසටම.'
    }
  ],
  6: [
    {
      code: 'GR6_THEORY',
      name: 'Grade 6 — Theory',
      defaultFee: 1500,
      grade: 6,
      billingType: 'MONTHLY',
      description: 'Physical: කුරුණෑගල - පේරාදෙණි ආයතනය (රජපිහිල්ල පාර)\n• සාමාන්‍ය පන්තිය: අඟහරුවාදා ප.ව 2.30 - 4.30\n• රාත්‍රී පන්තිය: සඳුදා ප.ව 5.00 - 7.00\n• Paper Class: සිකුරාදා ප.ව 6.00 - 7.00 (Online)\nLMS / Recordings: www.prabuddhamaths.com | Contact: 077 9649617',
      flyerUrl: 'https://mathsps-lead-crm.vercel.app/flyers/kurunegala-peradeniya-schedule.jpg'
    }
  ],
  7: [
    {
      code: 'GR7_THEORY',
      name: 'Grade 7 — Theory',
      defaultFee: 1500,
      grade: 7,
      billingType: 'MONTHLY',
      description: 'Physical: කුරුණෑගල - පේරාදෙණි ආයතනය (රජපිහිල්ල පාර)\n• සාමාන්‍ය පන්තිය: සෙනසුරාදා ප.ව 2.30 - 4.30\n• රාත්‍රී පන්තිය: ඉරිදා ප.ව 5.00 - 7.00\n• Paper Class: අඟහරුවාදා ප.ව 5.00 - 6.00 (Online)\nLMS / Recordings: www.prabuddhamaths.com | Contact: 077 9649617',
      flyerUrl: 'https://mathsps-lead-crm.vercel.app/flyers/kurunegala-peradeniya-schedule.jpg'
    }
  ],
  8: [
    {
      code: 'GR8_THEORY',
      name: 'Grade 8 — Theory',
      defaultFee: 1500,
      grade: 8,
      billingType: 'MONTHLY',
      description: 'Physical: කුරුණෑගල - පේරාදෙණි ආයතනය (රජපිහිල්ල පාර)\n• සාමාන්‍ය පන්තිය: සඳුදා ප.ව 2.30 - 4.30\n• රාත්‍රී පන්තිය: සෙනසුරාදා ප.ව 5.00 - 7.00\n• Paper Class: අඟහරුවාදා ප.ව 6.00 - 7.00 (Online)\nLMS / Recordings: www.prabuddhamaths.com | Contact: 077 9649617',
      flyerUrl: 'https://mathsps-lead-crm.vercel.app/flyers/kurunegala-peradeniya-schedule.jpg'
    }
  ],
  9: [
    {
      code: 'GR9_THEORY',
      name: 'Grade 9 — Theory',
      defaultFee: 1500,
      grade: 9,
      billingType: 'MONTHLY',
      description: 'Physical: කුරුණෑගල - පේරාදෙණි ආයතනය (රජපිහිල්ල පාර)\n• සාමාන්‍ය Theory: සෙනසුරාදා පෙ.ව 10.00 - 12.00 | රාත්‍රී Theory: සඳුදා ප.ව 7.00 - 9.00\n• Paper Class (Physical): සිකුරාදා ප.ව 3.00 - 5.00\n• Revision: අඟහරුවාදා ප.ව 9.30 - 10.30 (Online)\nLMS / Recordings: www.prabuddhamaths.com | Contact: 077 9649617',
      flyerUrl: 'https://mathsps-lead-crm.vercel.app/flyers/kurunegala-peradeniya-schedule.jpg'
    },
    {
      code: 'GR9_PAPER',
      name: 'Grade 9 — Paper',
      defaultFee: 1500,
      grade: 9,
      billingType: 'MONTHLY',
      description: 'Physical: කුරුණෑගල - පේරාදෙණි ආයතනය (රජපිහිල්ල පාර)\n• Paper Class (Physical): සිකුරාදා ප.ව 3.00 - 5.00\nLMS / Recordings: www.prabuddhamaths.com',
      flyerUrl: 'https://mathsps-lead-crm.vercel.app/flyers/kurunegala-peradeniya-schedule.jpg'
    },
    {
      code: 'GR9_BOTH',
      name: 'Grade 9 — Theory + Paper (Both)',
      defaultFee: 2500,
      grade: 9,
      billingType: 'MONTHLY',
      description: 'Physical: කුරුණෑගල - පේරාදෙණි ආයතනය (රජපිහිල්ල පාර)\n• Theory & Paper ඒකාබද්ධ පැකේජය\n• Revision: අඟහරුවාදා ප.ව 9.30 - 10.30 (Online)\nLMS / Recordings: www.prabuddhamaths.com | Contact: 077 9649617',
      flyerUrl: 'https://mathsps-lead-crm.vercel.app/flyers/kurunegala-peradeniya-schedule.jpg'
    }
  ],
  10: [
    {
      code: 'GR10_THEORY',
      name: 'Grade 10 — Theory',
      defaultFee: 1800,
      grade: 10,
      billingType: 'MONTHLY',
      description: 'Physical: කුරුණෑගල - පේරාදෙණි ආයතනය (රජපිහිල්ල පාර)\n• සාමාන්‍ය Theory: සෙනසුරාදා ප.ව 12.00 - 3.00 | රාත්‍රී Theory: සෙනසුරාදා ප.ව 7.15 - 9.30\n• Paper Class (Physical): ඉරිදා ප.ව 3.00 - 5.00 හෝ බදාදා ප.ව 7.15 - 9.30\n• Revision: සිකුරාදා ප.ව 9.30 - 10.30 (Online)\nLMS / Recordings: www.prabuddhamaths.com | Contact: 077 9649617',
      flyerUrl: 'https://mathsps-lead-crm.vercel.app/flyers/kurunegala-peradeniya-schedule.jpg'
    },
    {
      code: 'GR10_PAPER',
      name: 'Grade 10 — Paper',
      defaultFee: 1800,
      grade: 10,
      billingType: 'MONTHLY',
      description: 'Physical: කුරුණෑගල - පේරාදෙණි ආයතනය (රජපිහිල්ල පාර)\n• Paper Class (Physical): ඉරිදා ප.ව 3.00 - 5.00 හෝ බදාදා ප.ව 7.15 - 9.30\nLMS / Recordings: www.prabuddhamaths.com',
      flyerUrl: 'https://mathsps-lead-crm.vercel.app/flyers/kurunegala-peradeniya-schedule.jpg'
    },
    {
      code: 'GR10_BOTH',
      name: 'Grade 10 — Theory + Paper (Both)',
      defaultFee: 3000,
      grade: 10,
      billingType: 'MONTHLY',
      description: 'Physical: කුරුණෑගල - පේරාදෙණි ආයතනය (රජපිහිල්ල පාර)\n• 10 ශ්‍රේණිය Theory + Paper ඒකාබද්ධ පූර්ණ පාඨමාලාව\n• Revision: සිකුරාදා ප.ව 9.30 - 10.30 (Online)\nLMS / Recordings: www.prabuddhamaths.com | Contact: 077 9649617',
      flyerUrl: 'https://mathsps-lead-crm.vercel.app/flyers/kurunegala-peradeniya-schedule.jpg'
    }
  ],
  11: [
    {
      code: 'GR11_THEORY',
      name: 'Grade 11 — Theory',
      defaultFee: 1800,
      grade: 11,
      billingType: 'MONTHLY',
      description: 'Physical: කුරුණෑගල - පේරාදෙණි ආයතනය (රජපිහිල්ල පාර)\n• සාමාන්‍ය Theory: සෙනසුරාදා පෙ.ව 7.30 - 10.00 | රාත්‍රී Theory: සිකුරාදා ප.ව 7.00 - 9.30\n• Paper Class (Physical): ඉරිදා ප.ව 1.00 - 3.00 හෝ අඟහරුවාදා ප.ව 7.15 - 9.30\n• Revision: බදාදා ප.ව 9.30 - 11.30 (Online)\n• සතියට පැයක් ජ්‍යාමිතිය (නොමිලේ): සඳුදා ප.ව 9.30 - 10.30 (Online)\nLMS / Recordings: www.prabuddhamaths.com | Contact: 077 9649617',
      flyerUrl: 'https://mathsps-lead-crm.vercel.app/flyers/kurunegala-peradeniya-schedule.jpg'
    },
    {
      code: 'GR11_PAPER',
      name: 'Grade 11 — Paper',
      defaultFee: 1800,
      grade: 11,
      billingType: 'MONTHLY',
      description: 'Physical: කුරුණෑගල - පේරාදෙණි ආයතනය (රජපිහිල්ල පාර)\n• Paper Class (Physical): ඉරිදා ප.ව 1.00 - 3.00 හෝ අඟහරුවාදා ප.ව 7.15 - 9.30\nLMS / Recordings: www.prabuddhamaths.com',
      flyerUrl: 'https://mathsps-lead-crm.vercel.app/flyers/kurunegala-peradeniya-schedule.jpg'
    },
    {
      code: 'GR11_REVISION',
      name: 'Grade 11 — Revision',
      defaultFee: 1800,
      grade: 11,
      billingType: 'MONTHLY',
      description: 'Online Live Zoom: බදාදා ප.ව 9.30 - 11.30 O/L ඉක්මන් පුනරීක්ෂණය\nLMS / Recordings: www.prabuddhamaths.com',
      flyerUrl: 'https://mathsps-lead-crm.vercel.app/flyers/kurunegala-peradeniya-schedule.jpg'
    },
    {
      code: 'GR11_BOTH',
      name: 'Grade 11 — Theory + Paper + Revision (Full Package)',
      defaultFee: 3500,
      grade: 11,
      billingType: 'MONTHLY',
      description: 'Physical: කුරුණෑගල - පේරාදෙණි ආයතනය (රජපිහිල්ල පාර)\n• Theory + Paper + Revision + සතියට පැයක් නොමිලේ ජ්‍යාමිතිය සියල්ල ඇතුළත් Full Package\nLMS / Recordings: www.prabuddhamaths.com | Contact: 077 9649617',
      flyerUrl: 'https://mathsps-lead-crm.vercel.app/flyers/kurunegala-peradeniya-schedule.jpg'
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
