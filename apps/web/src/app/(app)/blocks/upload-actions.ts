"use server";

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireUserId } from "@/lib/session";
import { publicUrl, signedPutUrl } from "@/lib/storage";

const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB
const ALLOWED_CONTENT_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
] as const;

const mintSchema = z.object({
  contentType: z.enum(ALLOWED_CONTENT_TYPES),
  filename: z.string().min(1).max(200),
  byteSize: z.coerce.number().int().positive().max(MAX_VIDEO_BYTES),
});

export type MintUploadResult =
  | {
      ok: true;
      uploadUrl: string;
      publicUrl: string;
      key: string;
      expiresInSec: number;
    }
  | { ok: false; error: string };

const EXTENSION: Record<(typeof ALLOWED_CONTENT_TYPES)[number], string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-matroska": "mkv",
};

export async function mintBlockUploadUrlAction(input: {
  contentType: string;
  filename: string;
  byteSize: number;
}): Promise<MintUploadResult> {
  const userId = await requireUserId();
  const parsed = mintSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const expiresInSec = 60 * 10;
  const ext = EXTENSION[parsed.data.contentType];
  const key = `uploads/${userId}/${randomUUID()}.${ext}`;
  try {
    const uploadUrl = await signedPutUrl(key, parsed.data.contentType, expiresInSec);
    return { ok: true, uploadUrl, publicUrl: publicUrl(key), key, expiresInSec };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
