import { requireUserId } from "@/lib/session";
import { listPersonas } from "@/lib/personas";
import { PersonasPanel } from "./personas-panel";

export const dynamic = "force-dynamic";

export default async function PersonasPage() {
  const userId = await requireUserId();
  const personas = await listPersonas(userId);

  return (
    <section className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Personas</h1>
        <p className="mt-1 text-sm text-ink/60">
          A persona is one image + one voice. Apply it to a video and Crealify swaps the character
          and the spoken audio across every clip — without re-cutting your timeline.
        </p>
      </header>

      <PersonasPanel
        personas={personas.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          referenceImageUrl: p.referenceImageUrl,
          soulId: p.soulId,
          voiceExternalId: p.voiceExternalId,
        }))}
      />
    </section>
  );
}
