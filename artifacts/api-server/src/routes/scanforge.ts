import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  authUserTable,
  db,
  scanforgeGenerationsTable,
  scanforgeSubscriptionsTable,
  scanforgeUsageTable,
} from "@workspace/db";
import {
  CreateBasicCheckoutResponse,
  GenerateCodeBody,
  GenerateCodeResponse,
  GetBasicSubscriptionResponse,
  GetUsageResponse,
  ListGenerationsResponse,
  ListPlansResponse,
} from "@workspace/api-zod";
import { auth } from "../lib/auth";
import {
  createPaypalBasicSubscription,
  isPaypalApiError,
  isPaypalCheckoutConfigured,
  isPaypalWebhookConfigured,
  verifyPaypalWebhook,
} from "../lib/paypal";

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

type RequestIdentity = { userId: string; email: string };

function getOwnerHeader(req: { headers: Record<string, string | string[] | undefined> }) {
  const header = req.headers["x-scanforge-owner"];
  if (Array.isArray(header)) return header[0] ?? "anonymous";
  return header || "anonymous";
}

function getAuthHeaders(req: { headers: Record<string, string | string[] | undefined> }) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(",") : value);
  }
  return headers;
}

async function getIdentity(req: { headers: Record<string, string | string[] | undefined> }) {
  const session = await auth.api.getSession({ headers: getAuthHeaders(req) });
  if (!session) return null;
  return { userId: session.user.id, email: session.user.email } satisfies RequestIdentity;
}

function getOwnerKey(
  req: { headers: Record<string, string | string[] | undefined> },
  identity: RequestIdentity | null,
) {
  return identity?.userId ?? getOwnerHeader(req);
}

async function getPlan(identity: RequestIdentity | null) {
  const adminEmail = process.env.SCANFORGE_ADMIN_EMAIL;
  if (adminEmail && identity?.email.toLowerCase() === adminEmail.toLowerCase()) {
    return "admin" as const;
  }
  if (identity) {
    const [subscription] = await db
      .select({ id: scanforgeSubscriptionsTable.id })
      .from(scanforgeSubscriptionsTable)
      .where(
        and(
          eq(scanforgeSubscriptionsTable.userId, identity.userId),
          eq(scanforgeSubscriptionsTable.plan, "basic"),
          eq(scanforgeSubscriptionsTable.status, "active"),
        ),
      )
      .limit(1);
    if (subscription) return "basic" as const;
    return "starter" as const;
  }
  return "anonymous" as const;
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
  const identity = await getIdentity(req);
  const ownerKey = getOwnerKey(req, identity);
  const plan = await getPlan(identity);
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
  const identity = await getIdentity(req);
  const ownerKey = getOwnerKey(req, identity);
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

  const identity = await getIdentity(req);
  const ownerKey = getOwnerKey(req, identity);
  const plan = await getPlan(identity);
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

router.get("/billing/basic", async (req, res): Promise<void> => {
  const identity = await getIdentity(req);
  if (!identity) {
    res.json(
      GetBasicSubscriptionResponse.parse({
        plan: "starter",
        status: "inactive",
        configured: isPaypalCheckoutConfigured(),
        subscriptionId: null,
        approvalUrl: null,
        message: "Sign in to upgrade to Basic.",
      }),
    );
    return;
  }

  const [subscription] = await db
    .select()
    .from(scanforgeSubscriptionsTable)
    .where(eq(scanforgeSubscriptionsTable.userId, identity.userId))
    .orderBy(desc(scanforgeSubscriptionsTable.updatedAt))
    .limit(1);
  const status =
    subscription?.status === "active"
      ? "active"
      : subscription?.status === "pending"
        ? "pending"
        : subscription?.status === "failed"
          ? "error"
          : "inactive";
  res.json(
    GetBasicSubscriptionResponse.parse({
      plan: status === "active" ? "basic" : "starter",
      status,
      configured: isPaypalCheckoutConfigured(),
      subscriptionId: subscription?.paypalSubscriptionId ?? null,
      approvalUrl: subscription?.approvalUrl ?? null,
      message:
        status === "active"
          ? "Basic is active for this account."
          : status === "pending"
            ? "Finish checkout in PayPal to activate Basic."
            : status === "error"
              ? "The last PayPal payment failed. Your Starter allowance remains active."
              : null,
    }),
  );
});

router.post("/billing/basic/checkout", async (req, res): Promise<void> => {
  const identity = await getIdentity(req);
  if (!identity) {
    res.status(401).json({ error: "Sign in before starting a Basic subscription." });
    return;
  }
  if (!isPaypalCheckoutConfigured()) {
    res.status(503).json({ error: "PayPal checkout is not configured for this workspace." });
    return;
  }

  const [existing] = await db
    .select()
    .from(scanforgeSubscriptionsTable)
    .where(eq(scanforgeSubscriptionsTable.userId, identity.userId))
    .orderBy(desc(scanforgeSubscriptionsTable.updatedAt))
    .limit(1);
  if (existing?.status === "active") {
    res.json(
      CreateBasicCheckoutResponse.parse({
        plan: "basic",
        status: "active",
        subscriptionId: existing.paypalSubscriptionId,
        approvalUrl: null,
        message: "Basic is already active for this account.",
      }),
    );
    return;
  }
  if (existing?.status === "pending" && existing.approvalUrl) {
    res.json(
      CreateBasicCheckoutResponse.parse({
        plan: "basic",
        status: "pending",
        subscriptionId: existing.paypalSubscriptionId,
        approvalUrl: existing.approvalUrl,
        message: "Continue the pending PayPal checkout to activate Basic.",
      }),
    );
    return;
  }

  try {
    const paypalSubscription = await createPaypalBasicSubscription(identity.userId);
    await db
      .insert(scanforgeSubscriptionsTable)
      .values({
        id: randomUUID(),
        userId: identity.userId,
        paypalSubscriptionId: paypalSubscription.id,
        plan: "basic",
        status: "pending",
        approvalUrl: paypalSubscription.approvalUrl,
      })
      .onConflictDoUpdate({
        target: scanforgeSubscriptionsTable.paypalSubscriptionId,
        set: {
          status: "pending",
          approvalUrl: paypalSubscription.approvalUrl,
          updatedAt: new Date(),
        },
      });

    res.status(201).json(
      CreateBasicCheckoutResponse.parse({
        plan: "basic",
        status: "pending",
        subscriptionId: paypalSubscription.id,
        approvalUrl: paypalSubscription.approvalUrl,
        message: "Checkout created. Approve the subscription in PayPal.",
      }),
    );
  } catch (error) {
    const status = isPaypalApiError(error) ? error.status : 502;
    res.status(status >= 500 && status <= 599 ? status : 502).json({
      error: error instanceof Error ? error.message : "PayPal checkout could not be created.",
    });
  }
});

function getPaypalHeader(
  req: { headers: Record<string, string | string[] | undefined> },
  name: string,
) {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function getSubscriptionIdFromWebhook(event: Record<string, unknown>) {
  const resource = event.resource;
  if (!resource || typeof resource !== "object") return null;
  const record = resource as Record<string, unknown>;
  if (typeof record.id === "string" && event.event_type?.toString().startsWith("BILLING.SUBSCRIPTION.")) {
    return record.id;
  }
  if (typeof record.billing_agreement_id === "string") return record.billing_agreement_id;
  const supplementary = event.supplementary_data;
  if (supplementary && typeof supplementary === "object") {
    const relatedIds = (supplementary as Record<string, unknown>).related_ids;
    if (relatedIds && typeof relatedIds === "object") {
      const subscriptionId = (relatedIds as Record<string, unknown>).subscription_id;
      if (typeof subscriptionId === "string") return subscriptionId;
    }
  }
  return null;
}

router.post("/billing/paypal/webhook", async (req, res): Promise<void> => {
  if (!isPaypalWebhookConfigured()) {
    res.status(503).json({ error: "PayPal webhook verification is not configured." });
    return;
  }

  const event = req.body as Record<string, unknown>;
  const headers = {
    "paypal-transmission-id": getPaypalHeader(req, "paypal-transmission-id"),
    "paypal-transmission-time": getPaypalHeader(req, "paypal-transmission-time"),
    "paypal-cert-url": getPaypalHeader(req, "paypal-cert-url"),
    "paypal-auth-algo": getPaypalHeader(req, "paypal-auth-algo"),
    "paypal-transmission-sig": getPaypalHeader(req, "paypal-transmission-sig"),
  };
  try {
    if (!(await verifyPaypalWebhook(headers, event))) {
      res.status(400).json({ error: "PayPal webhook signature could not be verified." });
      return;
    }
  } catch {
    res.status(400).json({ error: "PayPal webhook signature could not be verified." });
    return;
  }

  const subscriptionId = getSubscriptionIdFromWebhook(event);
  const eventType = typeof event.event_type === "string" ? event.event_type : "";
  if (!subscriptionId) {
    res.status(400).json({ error: "PayPal webhook did not include a subscription ID." });
    return;
  }

  const status =
    eventType === "BILLING.SUBSCRIPTION.ACTIVATED" ||
    eventType === "PAYMENT.SALE.COMPLETED"
      ? "active"
      : eventType === "BILLING.SUBSCRIPTION.PAYMENT.FAILED" ||
          eventType === "PAYMENT.SALE.DENIED"
        ? "failed"
        : eventType === "BILLING.SUBSCRIPTION.CANCELLED" ||
            eventType === "BILLING.SUBSCRIPTION.EXPIRED" ||
            eventType === "BILLING.SUBSCRIPTION.SUSPENDED"
          ? "cancelled"
          : null;

  if (status) {
    await db
      .update(scanforgeSubscriptionsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(scanforgeSubscriptionsTable.paypalSubscriptionId, subscriptionId));
  }
  res.sendStatus(200);
});

export default router;