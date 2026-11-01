import { z } from 'zod'

/**
 * Single Payment Item for a class/course
 */
export const PaymentItemSchema = z.object({
  class_type: z.string().min(1, { message: 'Class/course code is required' }).max(80, { message: 'Course code cannot exceed 80 characters' }),
  amount_due: z.number()
    .min(0, { message: 'Amount due must be 0 or positive' })
    .max(500000, { message: 'Amount due exceeds maximum allowed limit' })
    .refine(val => Number(val.toFixed(2)) === val, {
      message: 'Amount due cannot have more than 2 decimal places'
    }),
  amount_paid: z.number()
    .min(0, { message: 'Amount paid must be 0 or positive' })
    .max(500000, { message: 'Amount paid exceeds maximum allowed limit' })
    .refine(val => Number(val.toFixed(2)) === val, {
      message: 'Amount paid cannot have more than 2 decimal places'
    }),
  deliver_tute: z.boolean().optional().default(false),
  enrollment_id: z.string().uuid().optional().nullable(),
  fee: z.number().min(0).max(500000).optional()
})

export type PaymentItemInput = z.infer<typeof PaymentItemSchema>

/**
 * Payment Creation & Processing Schema (Supports single or multi-class batch recording)
 */
export const PaymentCreateSchema = z.object({
  student_id: z.string().uuid({ message: 'Valid student ID is required' }),
  month: z.number().int().min(1).max(12, { message: 'Month must be between 1 and 12' }),
  year: z.number().int().min(2024).max(new Date().getFullYear() + 1, {
    message: `Year must be between 2024 and ${new Date().getFullYear() + 1}`
  }),
  payment_type: z.enum(['BANK', 'ONLINE', 'CASH', 'FREE', 'IMS'], {
    message: 'Payment type must be BANK, ONLINE, CASH, FREE, or IMS'
  }),
  bank_name: z.string().max(100).optional().nullable(),
  date_paid: z.string().regex(/^\d{4}-\d{2}-\d{2}/, { message: 'Payment date must be in YYYY-MM-DD format' }),
  added_to_group: z.boolean().optional().default(false),
  notes: z.string().max(1000).optional().nullable(),
  slip_url: z.string().url().optional().nullable().or(z.literal('')),
  items: z.array(PaymentItemSchema)
    .min(1, { message: 'At least one class payment item is required' })
    .max(20, { message: 'Cannot process more than 20 class items in a single batch' })
    .refine(items => {
      const codes = items.map(i => i.class_type.trim().toUpperCase())
      return new Set(codes).size === codes.length
    }, { message: 'Duplicate class_type items are not allowed in the same payment submission' })
}).refine(data => {
  // If payment_type is BANK/ONLINE and deliver_tute is true, amount_paid MUST be > 0 (No zero-dollar delivery fraud)
  if (data.payment_type !== 'FREE') {
    for (const item of data.items) {
      if (item.deliver_tute && item.amount_paid <= 0) {
        return false
      }
    }
  }
  return true
}, {
  message: 'Tute delivery cannot be authorized for unpaid items unless class is marked as FREE.'
})

export type PaymentCreateInput = z.infer<typeof PaymentCreateSchema>

/**
 * Payment Status Update Schema
 */
export const PaymentUpdateStatusSchema = z.object({
  payment_id: z.string().uuid({ message: 'Valid payment ID is required' }),
  status: z.enum(['PENDING', 'VERIFIED', 'REJECTED'], {
    message: 'Status must be PENDING, VERIFIED, or REJECTED'
  }),
  rejection_reason: z.string().max(500).optional().nullable()
})

export type PaymentUpdateStatusInput = z.infer<typeof PaymentUpdateStatusSchema>

/**
 * Enrollment Item Schema for student registration
 */
export const EnrollmentItemSchema = z.object({
  courseCode: z.string().min(1, { message: 'Course code is required' }).max(80, { message: 'Course code cannot exceed 80 characters' }),
  fee: z.number().min(0, { message: 'Fee must be 0 or positive' }).max(500000).refine(fee => fee > 0, {
    message: 'Standard course enrollment fee must be greater than 0'
  }),
  isStandalone: z.boolean().optional()
})

/**
 * Student Creation Schema (includes household, enrollments, and optional immediate payment)
 */
export const StudentCreateSchema = z.object({
  ps_code: z.string().min(3, { message: 'PS Code is required' }).max(30),
  full_name: z.string().min(1, { message: 'Student name is required' }).max(100, { message: 'Student name cannot exceed 100 characters' }),
  grade: z.number().int().min(1).max(13, { message: 'Grade must be between 1 and 13' }),
  lms_number: z.string().regex(/^[a-zA-Z0-9_\-\.\s]*$/, { message: 'LMS number contains invalid characters' }).max(50).optional().nullable(),
  fcode_ref: z.string().max(30).optional().nullable(),
  parent_name: z.string().min(1, { message: 'Parent/Guardian name is required' }).max(100),
  parent_phone: z.string().regex(/^\d{9,11}$/, { message: 'Parent phone must contain 9 to 11 digits only' }),
  address: z.string().min(1, { message: 'Address is required for delivery' }).max(300),
  area: z.string().max(100).optional().nullable(),
  enrollments: z.array(EnrollmentItemSchema).min(1, { message: 'At least one class enrollment is required' }).max(20),
  immediate_payment: z.object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2024).max(new Date().getFullYear() + 1),
    payment_type: z.enum(['BANK', 'ONLINE', 'CASH', 'FREE', 'IMS']),
    bank_name: z.string().max(100).optional().nullable(),
    date_paid: z.string().optional().nullable(),
    added_to_group: z.boolean().optional(),
    notes: z.string().max(1000).optional().nullable(),
    items: z.array(z.object({
      courseCode: z.string().max(80),
      amount_paid: z.number().min(0).max(500000).refine(val => Number(val.toFixed(2)) === val, {
        message: 'Amount paid cannot have more than 2 decimal places'
      }),
      deliver_tute: z.boolean().optional()
    })).max(20)
  }).optional().nullable()
}).refine(data => {
  // If immediate payment specified with deliver_tute, require positive amount_paid unless FREE
  if (data.immediate_payment && data.immediate_payment.payment_type !== 'FREE') {
    for (const item of data.immediate_payment.items) {
      if (item.deliver_tute && item.amount_paid <= 0) {
        return false
      }
    }
  }
  return true
}, {
  message: 'Tute delivery cannot be authorized for unpaid immediate registration payment unless marked as FREE.'
})

export type StudentCreateInput = z.infer<typeof StudentCreateSchema>

/**
 * Student Edit / Update Schema
 */
export const StudentUpdateSchema = z.object({
  full_name: z.string().min(1).max(100).optional().nullable(),
  grade: z.number().int().min(1).max(13).optional().nullable(),
  school: z.string().max(150).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  lms_number: z.string().max(50).optional().nullable(),
  fcode_ref: z.string().max(30).optional().nullable()
})

export type StudentUpdateInput = z.infer<typeof StudentUpdateSchema>

/**
 * Household Edit / Update Schema
 */
export const HouseholdUpdateSchema = z.object({
  household_id: z.string().uuid().optional().nullable(),
  parent_name: z.string().min(1).max(100).optional().nullable(),
  parent_phone: z.string().regex(/^\d{9,11}$/).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  area: z.string().max(100).optional().nullable()
})

export type HouseholdUpdateInput = z.infer<typeof HouseholdUpdateSchema>

/**
 * Lead Creation Schema
 */
export const LeadCreateSchema = z.object({
  raw_phone: z.string().min(8, { message: 'Phone number is required' }).max(20),
  grade: z.number().int().min(1).max(13).optional().nullable(),
  campaign: z.string().max(30, { message: 'Campaign tag cannot exceed 30 characters' }).optional().default('S26'),
  comments: z.string().max(1000).optional().nullable(),
  assigned_member: z.string().optional().nullable(),
  second_call_notes: z.string().max(1000).optional().nullable()
})

export type LeadCreateInput = z.infer<typeof LeadCreateSchema>

/**
 * Lead Update Schema (Cell edits & detail edits)
 */
export const LeadUpdateSchema = z.object({
  id: z.string().uuid().optional(),
  assigned_member: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  grade: z.number().int().min(1).max(13).optional().nullable(),
  comments: z.string().max(2000).optional().nullable(),
  campaign: z.string().max(30).optional().nullable(),
  second_call_done: z.boolean().optional(),
  second_call_notes: z.string().max(2000).optional().nullable(),
  paid: z.boolean().optional(),
  ps_code_ref: z.string().optional().nullable(),
  normalized_phone: z.string().optional().nullable()
})

export type LeadUpdateInput = z.infer<typeof LeadUpdateSchema>
