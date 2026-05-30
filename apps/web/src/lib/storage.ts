import "server-only";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let _client: S3Client | null = null;

function client(): S3Client {
  if (_client) return _client;
  const endpoint = process.env.STORAGE_ENDPOINT;
  const region = process.env.STORAGE_REGION ?? "auto";
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Storage is not configured. Set STORAGE_ENDPOINT, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY.",
    );
  }
  _client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  return _client;
}

function bucket(): string {
  const b = process.env.STORAGE_BUCKET;
  if (!b) throw new Error("STORAGE_BUCKET is required");
  return b;
}

export type UploadInput = {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
  cacheControl?: string;
};

export async function uploadObject(input: UploadInput): Promise<{ key: string; url: string }> {
  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: input.cacheControl ?? "public, max-age=31536000, immutable",
    }),
  );
  return { key: input.key, url: publicUrl(input.key) };
}

export function publicUrl(key: string): string {
  const base = process.env.STORAGE_PUBLIC_URL;
  if (base) return `${base.replace(/\/$/, "")}/${key}`;
  // Fallback: endpoint/bucket/key (MinIO with anonymous download enabled).
  const endpoint = process.env.STORAGE_ENDPOINT;
  if (!endpoint) throw new Error("STORAGE_ENDPOINT or STORAGE_PUBLIC_URL required");
  return `${endpoint.replace(/\/$/, "")}/${bucket()}/${key}`;
}

export async function signedGetUrl(key: string, expiresInSec = 60 * 60): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn: expiresInSec },
  );
}

export async function signedPutUrl(
  key: string,
  contentType: string,
  expiresInSec = 60 * 5,
): Promise<string> {
  return getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    { expiresIn: expiresInSec },
  );
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await client().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Download a remote URL to a Buffer. Used to stage Higgsfield outputs into R2. */
export async function fetchToBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const ab = await res.arrayBuffer();
  return { buffer: Buffer.from(ab), contentType };
}

/** Convenience: download a remote URL and immediately re-host in R2 under a content-addressed key. */
export async function rehostUrl(
  prefix: string,
  url: string,
  cacheKey: string,
  extensionHint?: string,
): Promise<{ key: string; url: string; contentType: string }> {
  const { buffer, contentType } = await fetchToBuffer(url);
  const ext =
    extensionHint ??
    (contentType.includes("mp4")
      ? "mp4"
      : contentType.includes("mp3") || contentType.includes("mpeg")
        ? "mp3"
        : contentType.includes("wav")
          ? "wav"
          : contentType.includes("png")
            ? "png"
            : contentType.includes("jpeg") || contentType.includes("jpg")
              ? "jpg"
              : "bin");
  const key = `${prefix.replace(/\/$/, "")}/${cacheKey}.${ext}`;
  const { url: hosted } = await uploadObject({
    key,
    body: buffer,
    contentType,
  });
  return { key, url: hosted, contentType };
}
