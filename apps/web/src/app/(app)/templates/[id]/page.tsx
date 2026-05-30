import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/session";
import { getTemplate } from "@/lib/templates";
import { TemplateForm } from "../template-form";

export const dynamic = "force-dynamic";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();
  const template = await getTemplate(userId, id);
  if (!template) notFound();

  return (
    <section className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Edit template</h1>
        <p className="mt-1 text-sm text-ink/60">
          Changes affect future videos. Already-rendered videos keep their cached renders.
        </p>
      </header>

      <TemplateForm
        mode="edit"
        initial={{
          id: template.id,
          name: template.name,
          description: template.description ?? "",
          slots: template.slots,
        }}
      />
    </section>
  );
}
