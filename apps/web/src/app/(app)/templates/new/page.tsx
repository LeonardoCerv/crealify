import { DEFAULT_SLOTS } from "@/lib/templates";
import { TemplateForm } from "../template-form";

export const dynamic = "force-dynamic";

export default function NewTemplatePage() {
  return (
    <section className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">New template</h1>
        <p className="mt-1 text-sm text-ink/60">
          Slots are user-defined. Start from the default 4-slot structure or build your own.
        </p>
      </header>

      <TemplateForm
        mode="create"
        initial={{
          id: null,
          name: "",
          description: "",
          slots: DEFAULT_SLOTS,
        }}
      />
    </section>
  );
}
