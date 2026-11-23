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

/** A student's name: on the sign-up form (saved to the profile) and on each booking. */
export const studentNameSchema = z
  .object({
    firstName: requiredText('First name', 100),
    lastName: requiredText('Last name', 100),
  })
  .strict();

export const createConsultationSchema = studentNameSchema
  .extend({
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

/** Validates the admin list query and decodes its cursor. Null means the page link is invalid. */
export function parseAdminListQuery(raw: unknown): { cursor?: Cursor; limit: number } | null {
  const parsed = adminListQuerySchema.safeParse(raw);
  if (!parsed.success) return null;
  if (parsed.data.cursor === undefined) return { cursor: undefined, limit: parsed.data.limit };
  const cursor = decodeCursor(parsed.data.cursor);
  return cursor ? { cursor, limit: parsed.data.limit } : null;
}
