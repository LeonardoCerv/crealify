import { BlockForm } from "../block-form";

export const dynamic = "force-dynamic";

export default async function NewBlockPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string }>;
}) {
  const { slot } = await searchParams;

  return (
    <section className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">New block</h1>
        <p className="mt-1 text-sm text-ink/60">
          Build a reusable piece. Bind it to template slots later to assemble videos.
        </p>
      </header>

      <BlockForm
        mode="create"
        initial={{
          id: null,
          name: "",
          slotType: slot ?? "opener",
          source: "higgsfield_lipsync",
          script: "",
          featuresCharacter: true,
          estimatedDurationMs: null,
          uploadedAssetUrl: "",
          hasBurnedCaptions: false,
        }}
      />
    </section>
  );
}
