import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before initializing Better Auth.");
}

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  basePath: "/api/auth",
  secret: process.env.SESSION_SECRET,
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    database: {
    generateId: () => randomUUID(),
    },
  },
});