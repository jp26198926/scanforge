import {
  date,
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scanforgeGenerationsTable = pgTable("scanforge_generations", {
  id: text("id").primaryKey(),
  ownerKey: text("owner_key").notNull(),
  format: text("format").notNull(),
  value: text("value").notNull(),
  entryCount: integer("entry_count").notNull().default(1),
  status: text("status").notNull().default("ready"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const scanforgeUsageTable = pgTable("scanforge_usage", {
  ownerKey: text("owner_key").notNull(),
  usageDate: date("usage_date", { mode: "string" }).notNull(),
  count: integer("count").notNull().default(0),
}, (table) => ({
  usageKey: primaryKey({ columns: [table.ownerKey, table.usageDate] }),
}));

export const insertScanforgeGenerationSchema = createInsertSchema(
  scanforgeGenerationsTable,
).omit({ createdAt: true });
export type InsertScanforgeGeneration = z.infer<
  typeof insertScanforgeGenerationSchema
>;
export type ScanforgeGeneration =
  typeof scanforgeGenerationsTable.$inferSelect;

export const authUserTable = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

export const authSessionTable = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => authUserTable.id, { onDelete: "cascade" }),
});

export const authAccountTable = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  issuer: text("issuer").notNull(),
  userId: text("userId").notNull().references(() => authUserTable.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

export const authVerificationTable = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});