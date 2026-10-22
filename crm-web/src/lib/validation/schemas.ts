import { z } from 'zod'

/**
 * Payment Creation & Verification Schema
 */
export const PaymentCreateSchema = z.object({
  student_id: z.string().uuid({ message: 'Valid student ID is required' }),
  amount_paid: z.number().positive({ message: 'Amount paid must be greater than 0' }),
  payment_type: z.enum(['BANK', 'CASH', 'ONLINE'], {
    message: 'Payment type must be BANK, CASH, or ONLINE'
  }),
  course_id: z.string().optional().nullable(),
  month: z.string().optional().nullable(),
  year: z.number().int().min(2020).max(2040).optional().nullable(),
  payment_date: z.string().optional().nullable(),
  slip_url: z.string().url().optional().nullable().or(z.literal('')),
  status: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional().default('VERIFIED'),
  notes: z.string().max(1000).optional().nullable(),
  source: z.string().optional().nullable()
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
