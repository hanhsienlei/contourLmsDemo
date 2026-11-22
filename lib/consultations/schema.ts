import { z } from 'zod';
import { isSlotAligned } from './rules';

const requiredText = (label: string, max: number, requiredMessage = `${label} is required`) =>
  z
    .string({ error: requiredMessage })
    .trim()
    .min(1, { error: requiredMessage })
    .max(max, { error: `${label} must be ${max} characters or fewer` });

const scheduledAt = z
  .string({ error: 'Choose a day and time' })
  .trim()
  .pipe(z.iso.datetime({ offset: true, error: 'Choose a day and time' }))
  .refine((s) => isSlotAligned(new Date(s)), { error: 'Choose a time on the quarter hour' });

export const createConsultationSchema = z
  .object({
    firstName: requiredText('First name', 100),
    lastName: requiredText('Last name', 100),
    reason: requiredText('Reason', 1000, 'Tell us what the consultation is about'),
    scheduledAt,
  })
  .strict();
export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;

export const updateConsultationSchema = z.union([
  z.object({ scheduledAt }).strict(),
  z.object({ completed: z.boolean() }).strict(),
]);
export type UpdateConsultationInput = z.infer<typeof updateConsultationSchema>;

export const idSchema = z.string().uuid();

export const adminListQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type Cursor = { scheduledAt: string; id: string };

const cursorSchema = z.object({ scheduledAt: z.iso.datetime({ offset: true }), id: z.string().uuid() });

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');
}

export function decodeCursor(s: string): Cursor | null {
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(s, 'base64url').toString('utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
