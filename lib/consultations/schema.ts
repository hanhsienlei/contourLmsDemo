import { z } from 'zod';
import { isSlotAligned } from './rules';

const name = z.string().trim().min(1).max(100);

const scheduledAt = z
  .string()
  .trim()
  .pipe(z.iso.datetime({ offset: true }))
  .refine((s) => isSlotAligned(new Date(s)), { message: 'Must be aligned to a 15-minute slot' });

export const createConsultationSchema = z
  .object({
    firstName: name,
    lastName: name,
    reason: z.string().trim().min(1).max(1000),
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
