import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/session";
import { getVideo } from "@/lib/videos";
import { ensureFreeformTemplate, getTemplate } from "@/lib/templates";
import { listBlocks } from "@/lib/blocks";
import { listPersonas } from "@/lib/personas";
import { VideoComposer } from "../video-composer";
import { RenderPanel } from "./render-panel";
import { getRenderStatusAction } from "./render-actions";

export const dynamic = "force-dynamic";

export default async function EditVideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();
  const [video, freeform, blocks, personas, renderStatus] = await Promise.all([
    getVideo(userId, id),
    ensureFreeformTemplate(userId),
    listBlocks(userId),
    listPersonas(userId),
    getRenderStatusAction(id),
  ]);
  if (!video) notFound();

  // For videos that already exist on a non-freeform template, surface those
  // slot ids so the composer continues to work.
  let slotIds = freeform.slots.map((s) => s.id);
  if (video.templateId !== freeform.id) {
    const owned = await getTemplate(userId, video.templateId);
    if (owned) slotIds = owned.slots.map((s) => s.id);
  }

  return (
    <section className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{video.name}</h1>
        <p className="mt-1 text-sm text-ink/60">
          Status: <span className="font-mono">{video.status}</span>. Edits invalidate the render
          cache; previously rendered videos keep their MP4s.
        </p>
      </header>

      {renderStatus && video.bindings.length > 0 ? (
        <RenderPanel videoId={video.id} initial={renderStatus} />
      ) : null}

      <VideoComposer
        mode="edit"
        initial={{
          id: video.id,
          name: video.name,
          templateId: video.templateId,
          characterId: video.characterId,
          voiceId: video.voiceId,
          aspect: video.aspect,
          bindings: video.bindings,
        }}
        freeformSlotIds={slotIds}
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
    </section>
  );
}
