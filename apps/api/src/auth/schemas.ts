import { z } from 'zod'

import { passwordPolicy } from './password.js'

const nameSchema = z.string().trim().min(1).max(120)
const emailSchema = z.email().max(320)
const passwordSchema = z
  .string()
  .min(passwordPolicy.minLength)
  .max(passwordPolicy.maxLength)

export const registerSchema = z
  .object({ name: nameSchema, email: emailSchema, password: passwordSchema })
  .strict()

export const loginSchema = z
  .object({ email: emailSchema, password: passwordSchema })
  .strict()

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
