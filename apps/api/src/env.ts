import { z } from 'zod';

const isTest = process.env['NODE_ENV'] === 'test';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  // Supabase JWT secret — required in production/development, defaulted in test
  SUPABASE_JWT_SECRET: isTest
    ? z.string().default('test-secret-do-not-use-in-prod')
    : z.string().min(1),

  // Supabase project URL — required in production/development, defaulted in test
  SUPABASE_URL: isTest
    ? z.string().url().default('http://localhost:54321')
    : z.string().url(),

  // Supabase service role key — required in production/development, defaulted in test
  SUPABASE_SERVICE_ROLE_KEY: isTest
    ? z.string().default('test-service-role-key-do-not-use-in-prod')
    : z.string().min(1),

  // Port — default 3001 to avoid collision with mockups/Vite on 5173 and apps/web on 5174
  PORT: z.coerce.number().int().positive().default(3001),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
