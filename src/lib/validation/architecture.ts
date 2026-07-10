import { z } from 'zod';

export const ARCHITECTURE_ENVIRONMENTS = ['production', 'testing', 'recovery'] as const;
export const ARCHITECTURE_STATUSES = ['active', 'inactive', 'archived'] as const;

export const createArchitectureSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(4000).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  product: z.string().max(200).optional().nullable(),
  environment: z.enum(ARCHITECTURE_ENVIRONMENTS).default('production'),
  objective: z.string().max(2000).optional().nullable(),
  status: z.enum(ARCHITECTURE_STATUSES).default('active'),
});

export const updateArchitectureSchema = createArchitectureSchema.partial();

export const assignRoleSchema = z.object({
  architecture_id: z.string().uuid().nullable(),
  role: z.string().max(50).nullable(),
});

export const createChecklistSchema = z.object({
  title: z.string().min(1).max(200),
  items: z.array(z.object({ key: z.string(), label: z.string() })).min(1),
});

export type CreateArchitectureInput = z.infer<typeof createArchitectureSchema>;
export type UpdateArchitectureInput = z.infer<typeof updateArchitectureSchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
export type CreateChecklistInput = z.infer<typeof createChecklistSchema>;
