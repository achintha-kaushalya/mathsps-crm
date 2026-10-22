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
 * Student Creation Schema
 */
export const StudentCreateSchema = z.object({
  full_name: z.string().min(2, { message: 'Full name must have at least 2 characters' }),
  grade: z.number().int().min(1).max(13, { message: 'Grade must be between 1 and 13' }),
  whatsapp_number: z.string().optional().nullable(),
  school: z.string().optional().nullable(),
  guardian_name: z.string().optional().nullable(),
  guardian_phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  lms_number: z.string().optional().nullable(),
  household_id: z.string().uuid().optional().nullable()
})

export type StudentCreateInput = z.infer<typeof StudentCreateSchema>

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
