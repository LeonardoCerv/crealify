import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/session";
import { getBlock } from "@/lib/blocks";
import { BlockForm } from "../block-form";

export const dynamic = "force-dynamic";

export default async function EditBlockPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();
  const block = await getBlock(userId, id);
  if (!block) notFound();

  return (
    <section className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Edit block</h1>
        <p className="mt-1 text-sm text-ink/60">
          Edits invalidate the render cache for this block — videos that use it will need a
          re-render.
        </p>
      </header>

      <BlockForm
        mode="edit"
        initial={{
          id: block.id,
          name: block.name,
          slotType: block.slotType,
          source: block.source,
          script: block.script ?? "",
          featuresCharacter: block.featuresCharacter === 1,
          estimatedDurationMs: block.estimatedDurationMs ?? null,
          uploadedAssetUrl: block.uploadedAssetUrl ?? "",
          hasBurnedCaptions: block.hasBurnedCaptions === 1,
        }}
      />
    </section>
  );
}
