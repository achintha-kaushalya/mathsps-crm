import { z } from 'zod'

/**
 * Single Payment Item for a class/course
 */
export const PaymentItemSchema = z.object({
  class_type: z.string().min(1, { message: 'Class/course code is required' }),
  amount_due: z.number().min(0, { message: 'Amount due must be 0 or positive' }),
  amount_paid: z.number().min(0, { message: 'Amount paid must be 0 or positive' }),
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
  year: z.number().int().min(2020).max(2040, { message: 'Year must be between 2020 and 2040' }),
  payment_type: z.string().min(1, { message: 'Payment type is required' }),
  bank_name: z.string().optional().nullable(),
  date_paid: z.string().min(1, { message: 'Payment date is required' }),
  added_to_group: z.boolean().optional().default(false),
  notes: z.string().max(1000).optional().nullable(),
  slip_url: z.string().url().optional().nullable().or(z.literal('')),
  items: z.array(PaymentItemSchema).min(1, { message: 'At least one class payment item is required' })
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
  fee: z.number().min(0, { message: 'Fee must be 0 or positive' }),
  isStandalone: z.boolean().optional()
})

/**
 * Student Creation Schema (includes household, enrollments, and optional immediate payment)
 */
export const StudentCreateSchema = z.object({
  ps_code: z.string().min(3, { message: 'PS Code is required' }),
  full_name: z.string().min(1, { message: 'Student name is required' }),
  grade: z.number().int().min(1).max(13, { message: 'Grade must be between 1 and 13' }),
  lms_number: z.string().optional().nullable(),
  fcode_ref: z.string().optional().nullable(),
  parent_name: z.string().min(1, { message: 'Parent/Guardian name is required' }),
  parent_phone: z.string().min(9, { message: 'Valid Sri Lankan phone number is required' }),
  address: z.string().min(1, { message: 'Address is required for delivery' }),
  area: z.string().optional().nullable(),
  enrollments: z.array(EnrollmentItemSchema).min(1, { message: 'At least one class enrollment is required' }),
  immediate_payment: z.object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2020).max(2040),
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
  full_name: z.string().min(1).optional().nullable(),
  grade: z.number().int().min(1).max(13).optional().nullable(),
  school: z.string().optional().nullable(),
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
  parent_name: z.string().min(1).optional().nullable(),
  parent_phone: z.string().min(9).optional().nullable(),
  address: z.string().optional().nullable(),
  area: z.string().optional().nullable()
})

export type HouseholdUpdateInput = z.infer<typeof HouseholdUpdateSchema>

/**
 * Lead Update Schema
 */
export const LeadUpdateSchema = z.object({
  lead_id: z.string().uuid({ message: 'Valid lead ID is required' }),
  status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'LOST', 'FOLLOW_UP']).optional(),
  assigned_to: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  phone: z.string().optional(),
  name: z.string().optional()
})

export type LeadUpdateInput = z.infer<typeof LeadUpdateSchema>
