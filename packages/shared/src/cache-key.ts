import { createHash } from "node:crypto";

export type CacheInputs = {
  blockId: string;
  characterId: string | null;
  voiceId: string | null;
  backgroundVariantId: string | null;
  aspect: string;
  scriptHash: string;
  higgsfieldModelVersion: string;
};

export function hashScript(script: string | null | undefined): string {
  return createHash("sha256")
    .update(script ?? "")
    .digest("hex")
    .slice(0, 16);
}

export function computeCacheKey(inputs: CacheInputs): string {
  const canonical = [
    inputs.blockId,
    inputs.characterId ?? "_",
    inputs.voiceId ?? "_",
    inputs.backgroundVariantId ?? "_",
    inputs.aspect,
    inputs.scriptHash,
    inputs.higgsfieldModelVersion,
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}
