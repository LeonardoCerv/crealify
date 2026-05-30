import { requireUserId } from "@/lib/session";
import { listTokenStatuses } from "@/lib/tokens";
import { FactoryPanel } from "./factory-panel";

export const dynamic = "force-dynamic";

export default async function HookFactoryPage() {
  const userId = await requireUserId();
  const statuses = await listTokenStatuses(userId);
  const anthropic = statuses.find((s) => s.provider === "anthropic");
  const anthropicReady = !!(anthropic?.configured && !anthropic?.lastError);

  return (
    <section className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Hook factory</h1>
        <p className="mt-1 text-sm text-ink/60">
          Generate N script variants in one shot. Accept the ones you like as new blocks bound to a
          slot type. Powered by Claude.
        </p>
      </header>

      {!anthropicReady ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
          Anthropic isn&apos;t configured or hasn&apos;t verified yet. Add and verify your key in{" "}
          <a href="/settings" className="underline">
            Settings
          </a>{" "}
          first.
        </div>
      ) : null}

      <FactoryPanel disabled={!anthropicReady} />
    </section>
  );
}
