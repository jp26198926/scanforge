type PaypalResponse = Record<string, unknown>;

export type PaypalSubscription = {
  id: string;
  status: string;
  approvalUrl: string | null;
};

function getPaypalBaseUrl() {
  return process.env.PAYPAL_ENVIRONMENT === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export function isPaypalCheckoutConfigured() {
  return Boolean(
    process.env.PAYPAL_CLIENT_ID &&
      process.env.PAYPAL_CLIENT_SECRET &&
      process.env.PAYPAL_PLAN_ID_BASIC &&
      process.env.PAYPAL_RETURN_URL &&
      process.env.PAYPAL_CANCEL_URL,
  );
}

export function isPaypalWebhookConfigured() {
  return Boolean(
    isPaypalCheckoutConfigured() && process.env.PAYPAL_WEBHOOK_ID,
  );
}

class PaypalApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PaypalApiError";
    this.status = status;
  }
}

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new PaypalApiError("PayPal credentials are not configured.", 503);
  }

  const response = await fetch(`${getPaypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });
  const payload = (await response.json().catch(() => ({}))) as PaypalResponse;
  if (!response.ok || typeof payload.access_token !== "string") {
    throw new PaypalApiError("PayPal authentication failed.", response.status);
  }
  return payload.access_token;
}

async function paypalRequest<T extends PaypalResponse>(
  path: string,
  init: RequestInit,
) {
  const accessToken = await getAccessToken();
  const response = await fetch(`${getPaypalBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T;
  if (!response.ok) {
    const detail =
      typeof payload.message === "string" ? payload.message : "PayPal request failed.";
    throw new PaypalApiError(detail, response.status);
  }
  return payload;
}

export async function createPaypalBasicSubscription(userId: string) {
  const planId = process.env.PAYPAL_PLAN_ID_BASIC;
  const returnUrl = process.env.PAYPAL_RETURN_URL;
  const cancelUrl = process.env.PAYPAL_CANCEL_URL;
  if (!planId || !returnUrl || !cancelUrl) {
    throw new PaypalApiError("PayPal checkout is not configured.", 503);
  }

  const payload = await paypalRequest<PaypalResponse>("/v1/billing/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      plan_id: planId,
      custom_id: userId,
      application_context: {
        brand_name: "ScanForge",
        user_action: "SUBSCRIBE_NOW",
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  });

  const id = typeof payload.id === "string" ? payload.id : null;
  if (!id) {
    throw new PaypalApiError("PayPal did not return a subscription ID.", 502);
  }
  const links = Array.isArray(payload.links) ? payload.links : [];
  const approvalLink = links.find(
    (link): link is { href: string; rel?: string } =>
      typeof link === "object" &&
      link !== null &&
      typeof (link as { href?: unknown }).href === "string" &&
      (link as { rel?: unknown }).rel === "approve",
  );

  return {
    id,
    status: typeof payload.status === "string" ? payload.status : "CREATED",
    approvalUrl: approvalLink?.href ?? null,
  } satisfies PaypalSubscription;
}

export async function cancelPaypalBasicSubscription(subscriptionId: string) {
  await paypalRequest<PaypalResponse>(
    `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: "Cancelled by the ScanForge account owner.",
      }),
    },
  );
}

export async function verifyPaypalWebhook(
  headers: Record<string, string | undefined>,
  event: PaypalResponse,
) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId || !isPaypalWebhookConfigured()) return false;

  const requiredHeaders = [
    "paypal-transmission-id",
    "paypal-transmission-time",
    "paypal-cert-url",
    "paypal-auth-algo",
    "paypal-transmission-sig",
  ] as const;
  if (requiredHeaders.some((name) => !headers[name])) return false;

  const payload = await paypalRequest<PaypalResponse>(
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_algo: headers["paypal-auth-algo"],
        cert_url: headers["paypal-cert-url"],
        transmission_id: headers["paypal-transmission-id"],
        transmission_sig: headers["paypal-transmission-sig"],
        transmission_time: headers["paypal-transmission-time"],
        webhook_id: webhookId,
        webhook_event: event,
      }),
    },
  );
  return payload.verification_status === "SUCCESS";
}

export function isPaypalApiError(error: unknown): error is PaypalApiError {
  return error instanceof PaypalApiError;
}