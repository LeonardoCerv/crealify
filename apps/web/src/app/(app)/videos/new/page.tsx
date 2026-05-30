import { requireUserId } from "@/lib/session";
import { ensureFreeformTemplate } from "@/lib/templates";
import { listBlocks } from "@/lib/blocks";
import { listPersonas } from "@/lib/personas";
import { VideoComposer } from "../video-composer";

export const dynamic = "force-dynamic";

export default async function NewVideoPage() {
  const userId = await requireUserId();
  const [freeform, blocks, personas] = await Promise.all([
    ensureFreeformTemplate(userId),
    listBlocks(userId),
    listPersonas(userId),
  ]);

  return (
    <VideoComposer
      mode="create"
      initial={{
        id: null,
        name: "",
        templateId: freeform.id,
        characterId: null,
        voiceId: null,
        aspect: "9:16",
        bindings: [],
      }}
      freeformSlotIds={freeform.slots.map((s) => s.id)}
      blocks={blocks.map((b) => ({
        id: b.id,
        name: b.name,
        slotType: b.slotType,
        source: b.source,
        script: b.script,
        posterUrl: b.posterUrl,
        uploadedAssetUrl: b.uploadedAssetUrl,
        estimatedDurationMs: b.estimatedDurationMs,
        hasBurnedCaptions: b.hasBurnedCaptions === 1,
      }))}
      personas={personas.map((p) => ({
        id: p.id,
        name: p.name,
        referenceImageUrl: p.referenceImageUrl,
        voiceExternalId: p.voiceExternalId,
      }))}
    />
  );
}
