import { z } from 'zod'

/**
 * Single Payment Item for a class/course
 */
export const PaymentItemSchema = z.object({
  class_type: z.string().min(1, { message: 'Class/course code is required' }),
  amount_due: z.number().min(0, { message: 'Amount due must be 0 or positive' }),
  amount_paid: z.number()
    .min(0, { message: 'Amount paid must be 0 or positive' })
    .refine(val => Number(val.toFixed(2)) === val, {
      message: 'Amount paid cannot have more than 2 decimal places'
    }),
  deliver_tute: z.boolean().optional().default(false),
  enrollment_id: z.string().uuid().optional().nullable(),
  fee: z.number().min(0).optional()
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
  payment_type: z.string().min(1, { message: 'Payment type is required' }),
  bank_name: z.string().optional().nullable(),
  date_paid: z.string().min(1, { message: 'Payment date is required' }),
  added_to_group: z.boolean().optional().default(false),
  notes: z.string().max(1000).optional().nullable(),
  slip_url: z.string().url().optional().nullable().or(z.literal('')),
  items: z.array(PaymentItemSchema).min(1, { message: 'At least one class payment item is required' })
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
  courseCode: z.string().min(1, { message: 'Course code is required' }),
  fee: z.number().min(0, { message: 'Fee must be 0 or positive' }).refine(fee => fee > 0, {
    message: 'Standard course enrollment fee must be greater than 0'
  }),
  isStandalone: z.boolean().optional()
})

/**
 * Student Creation Schema (includes household, enrollments, and optional immediate payment)
 */
export const StudentCreateSchema = z.object({
  ps_code: z.string().min(3, { message: 'PS Code is required' }),
  full_name: z.string().min(1, { message: 'Student name is required' }).max(100, { message: 'Student name cannot exceed 100 characters' }),
  grade: z.number().int().min(1).max(13, { message: 'Grade must be between 1 and 13' }),
  lms_number: z.string().optional().nullable(),
  fcode_ref: z.string().optional().nullable(),
  parent_name: z.string().min(1, { message: 'Parent/Guardian name is required' }).max(100),
  parent_phone: z.string().regex(/^\d{9,11}$/, { message: 'Parent phone must contain 9 to 11 digits only' }),
  address: z.string().min(1, { message: 'Address is required for delivery' }).max(300),
  area: z.string().optional().nullable(),
  enrollments: z.array(EnrollmentItemSchema).min(1, { message: 'At least one class enrollment is required' }),
  immediate_payment: z.object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2024).max(new Date().getFullYear() + 1),
    payment_type: z.string().min(1),
    bank_name: z.string().optional().nullable(),
    date_paid: z.string().optional().nullable(),
    added_to_group: z.boolean().optional(),
    notes: z.string().optional().nullable(),
    items: z.array(z.object({
      courseCode: z.string(),
      amount_paid: z.number().min(0),
      deliver_tute: z.boolean().optional()
    }))
  }).optional().nullable()
})

export type StudentCreateInput = z.infer<typeof StudentCreateSchema>

/**
 * Student Edit / Update Schema
 */
export const StudentUpdateSchema = z.object({
  full_name: z.string().min(1).max(100).optional().nullable(),
  grade: z.number().int().min(1).max(13).optional().nullable(),
  school: z.string().max(150).optional().nullable(),
  notes: z.string().optional().nullable(),
  lms_number: z.string().optional().nullable(),
  fcode_ref: z.string().optional().nullable()
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
  area: z.string().optional().nullable()
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
