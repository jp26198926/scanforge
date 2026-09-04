import { createHash } from "node:crypto";

const CLOUDINARY_UPLOAD_TIMEOUT_MS = 30_000;

export class CloudinaryConfigError extends Error {
  constructor() {
    super("Cloudinary asset storage is not configured for this workspace.");
    this.name = "CloudinaryConfigError";
  }
}

export class CloudinaryUploadError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "CloudinaryUploadError";
    this.status = status;
  }
}

export function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

function getSignature(params: Record<string, string>, apiSecret: string) {
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHash("sha1")
    .update(`${serialized}${apiSecret}`)
    .digest("hex");
}

export async function uploadAssetToCloudinary({
  asset,
  format,
  generationId,
}: {
  asset: string;
  format: "svg" | "png";
  generationId: string;
}) {
  if (!isCloudinaryConfigured()) {
    throw new CloudinaryConfigError();
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const uploadParams = {
    folder: "scanforge",
    public_id: `${generationId}-${format}`,
    timestamp,
  };
  const signature = getSignature(uploadParams, apiSecret);
  const body = new URLSearchParams({
    ...uploadParams,
    api_key: apiKey,
    signature,
    file: asset,
    resource_type: "image",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLOUDINARY_UPLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        signal: controller.signal,
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | { secure_url?: unknown; error?: { message?: unknown } }
      | null;
    if (!response.ok) {
      const providerMessage =
        typeof payload?.error?.message === "string"
          ? payload.error.message
          : "Cloudinary rejected the asset upload.";
      throw new CloudinaryUploadError(providerMessage);
    }
    if (typeof payload?.secure_url !== "string" || !payload.secure_url) {
      throw new CloudinaryUploadError("Cloudinary did not return an asset URL.");
    }
    return payload.secure_url;
  } catch (error) {
    if (error instanceof CloudinaryUploadError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new CloudinaryUploadError("Cloudinary upload timed out.");
    }
    throw new CloudinaryUploadError("Cloudinary could not be reached.");
  } finally {
    clearTimeout(timeout);
  }
}