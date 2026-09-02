import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, scanforgeGenerationsTable, scanforgeUsageTable } from "@workspace/db";
import {
  GenerateCodeBody,
  GenerateCodeResponse,
  GetUsageResponse,
  ListGenerationsResponse,
  ListPlansResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const PLAN_LIMITS = {
  anonymous: 1,
  starter: 3,
  basic: 50,
  admin: Number.MAX_SAFE_INTEGER,
} as const;

const plans = [
  {
    id: "anonymous" as const,
    name: "Anonymous",
    price: 0,
    interval: "none" as const,
    dailyLimit: PLAN_LIMITS.anonymous,
    description: "Try one single entry without an account.",
    highlighted: false,
  },
  {
    id: "starter" as const,
    name: "Starter",
    price: 0,
    interval: "none" as const,
    dailyLimit: PLAN_LIMITS.starter,
    description: "Three daily transactions for single or bulk generation.",
    highlighted: false,
  },
  {
    id: "basic" as const,
    name: "Basic",
    price: 5,
    interval: "monthly" as const,
    dailyLimit: PLAN_LIMITS.basic,
    description: "Fifty daily transactions for growing teams.",
    highlighted: true,
  },
  {
    id: "admin" as const,
    name: "Admin",
    price: 0,
    interval: "none" as const,
    dailyLimit: PLAN_LIMITS.admin,
    description: "Unlimited access for the configured administrator.",
    highlighted: false,
  },
];

function getOwnerKey(req: { headers: Record<string, string | string[] | undefined> }) {
  const header = req.headers["x-scanforge-owner"];
  if (Array.isArray(header)) return header[0] ?? "anonymous";
  return header || "anonymous";
}

function getPlan(req: { headers: Record<string, string | string[] | undefined> }) {
  const adminEmail = process.env.SCANFORGE_ADMIN_EMAIL;
  const emailHeader = req.headers["x-scanforge-email"];
  const email = Array.isArray(emailHeader) ? emailHeader[0] : emailHeader;
  if (adminEmail && email && email.toLowerCase() === adminEmail.toLowerCase()) {
    return "admin" as const;
  }
  const requestedPlan = req.headers["x-scanforge-plan"];
  if (requestedPlan === "basic") return "basic" as const;
  return email ? ("starter" as const) : ("anonymous" as const);
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getResetAt() {
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);
  return tomorrow;
}

router.get("/usage", async (req, res): Promise<void> => {
  const ownerKey = getOwnerKey(req);
  const plan = getPlan(req);
  const today = getToday();
  const [usage] = await db
    .select()
    .from(scanforgeUsageTable)
    .where(
      and(
        eq(scanforgeUsageTable.ownerKey, ownerKey),
        eq(scanforgeUsageTable.usageDate, today),
      ),
    );
  const usedToday = usage?.count ?? 0;
  const dailyLimit = PLAN_LIMITS[plan];
  res.json(
    GetUsageResponse.parse({
      plan,
      dailyLimit,
      usedToday,
      remainingToday: Math.max(0, dailyLimit - usedToday),
      isAuthenticated: plan !== "anonymous",
      resetAt: getResetAt(),
    }),
  );
});

router.get("/generations", async (req, res): Promise<void> => {
  const ownerKey = getOwnerKey(req);
  const generations = await db
    .select()
    .from(scanforgeGenerationsTable)
    .where(eq(scanforgeGenerationsTable.ownerKey, ownerKey))
    .orderBy(desc(scanforgeGenerationsTable.createdAt))
    .limit(50);
  res.json(ListGenerationsResponse.parse(generations));
});

router.get("/plans", (_req, res): void => {
  res.json(ListPlansResponse.parse(plans));
});

router.post("/generate", async (req, res): Promise<void> => {
  const parsed = GenerateCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const ownerKey = getOwnerKey(req);
  const plan = getPlan(req);
  const entries = parsed.data.entries?.filter((entry) => entry.trim().length > 0) ?? [];
  const value = parsed.data.value?.trim() ?? entries[0] ?? "";
  const entryCount = entries.length > 0 ? entries.length : 1;

  if (!value) {
    res.status(400).json({ error: "Add a value or at least one bulk entry." });
    return;
  }
  if (plan === "anonymous" && entryCount > 1) {
    res.status(403).json({ error: "Create a free account to use bulk entries." });
    return;
  }

  const today = getToday();
  const [usage] = await db
    .select()
    .from(scanforgeUsageTable)
    .where(
      and(
        eq(scanforgeUsageTable.ownerKey, ownerKey),
        eq(scanforgeUsageTable.usageDate, today),
      ),
    );
  const usedToday = usage?.count ?? 0;
  if (usedToday >= PLAN_LIMITS[plan]) {
    res.status(403).json({ error: "You've reached today's generation limit." });
    return;
  }

  await db
    .insert(scanforgeUsageTable)
    .values({ ownerKey, usageDate: today, count: 1 })
    .onConflictDoUpdate({
      target: [scanforgeUsageTable.ownerKey, scanforgeUsageTable.usageDate],
      set: { count: (usedToday + 1) },
    });

  const [generation] = await db
    .insert(scanforgeGenerationsTable)
    .values({
      id: randomUUID(),
      ownerKey,
      format: parsed.data.format,
      value,
      entryCount,
      status: "ready",
    })
    .returning();

  res.status(201).json(GenerateCodeResponse.parse(generation));
});

export default router;