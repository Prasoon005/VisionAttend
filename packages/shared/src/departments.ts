import { z } from 'zod';

export const departmentSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  code: z.string().nullable(),
  employeeCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
});

/** Optional short code such as "ENG"; an empty string clears it. */
const departmentCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .max(20)
  .regex(/^[A-Z0-9_-]*$/, 'Use letters, digits, hyphens and underscores')
  .transform((code) => code || null)
  .nullable();

/** POST /departments */
export const createDepartmentRequestSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: departmentCodeSchema.optional(),
});

/** PATCH /departments/:id */
export const updateDepartmentRequestSchema = createDepartmentRequestSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update');

/**
 * Departments are a short reference list (they feed pickers), so the list is
 * returned whole, sorted by name, without pagination.
 */
export const departmentListResponseSchema = z.object({ items: z.array(departmentSchema) });

export type Department = z.infer<typeof departmentSchema>;
export type CreateDepartmentRequest = z.infer<typeof createDepartmentRequestSchema>;
export type UpdateDepartmentRequest = z.infer<typeof updateDepartmentRequestSchema>;
export type DepartmentListResponse = z.infer<typeof departmentListResponseSchema>;
