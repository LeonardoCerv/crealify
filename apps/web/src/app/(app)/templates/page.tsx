import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { listTemplates } from "@/lib/templates";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const userId = await requireUserId();
  const templates = await listTemplates(userId);

  return (
    <section className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Templates</h1>
          <p className="mt-1 text-sm text-ink/60">
            A template defines the ordered slots a video fills. Slots are user-defined; the default
            is <span className="font-mono text-ink/80">Opener · Problem · Solution · Demo · CTA</span>.
          </p>
        </div>
        <Link
          href="/templates/new"
          className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-paper"
        >
          New template
        </Link>
      </header>

      {templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink/15 p-8 text-center text-sm text-ink/50">
          No templates yet. Create one to lay out your video skeleton.
        </div>
      ) : (
        <ul className="space-y-3">
          {templates.map((t) => (
            <li key={t.id} className="rounded-lg border border-ink/10 bg-white p-5">
              <div className="flex items-center justify-between">
                <Link href={`/templates/${t.id}`} className="text-sm font-medium hover:underline">
                  {t.name}
                </Link>
                <span className="text-[11px] text-ink/40">
                  {t.slots.length} slot{t.slots.length === 1 ? "" : "s"}
                </span>
              </div>
              {t.description ? (
                <p className="mt-1 text-xs text-ink/60">{t.description}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {t.slots.map((s) => (
                  <span
                    key={s.id}
                    className="rounded-full border border-ink/15 bg-paper px-2.5 py-0.5 text-[11px] text-ink/70"
                  >
                    {s.label}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
