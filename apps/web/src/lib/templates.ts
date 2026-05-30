import "server-only";
import { eq, and, desc } from "drizzle-orm";
import { db, templates, DEFAULT_SLOTS, type Template, type NewTemplate } from "@crealify/db";

export type SlotInput = NonNullable<Template["slots"]>[number];

export type TemplateInput = {
  name: string;
  description?: string | null;
  slots: SlotInput[];
  globalOverlays?: Template["globalOverlays"];
};

export async function listTemplates(userId: string): Promise<Template[]> {
  return db
    .select()
    .from(templates)
    .where(eq(templates.userId, userId))
    .orderBy(desc(templates.createdAt));
}

export async function getTemplate(userId: string, id: string): Promise<Template | null> {
  const rows = await db
    .select()
    .from(templates)
    .where(and(eq(templates.userId, userId), eq(templates.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createTemplate(
  userId: string,
  input: TemplateInput,
): Promise<Template> {
  const values: NewTemplate = {
    userId,
    name: input.name,
    description: input.description ?? null,
    slots: input.slots,
    globalOverlays: input.globalOverlays ?? {},
  };
  const rows = await db.insert(templates).values(values).returning();
  const row = rows[0];
  if (!row) throw new Error("Failed to create template");
  return row;
}

export async function updateTemplate(
  userId: string,
  id: string,
  input: Partial<TemplateInput>,
): Promise<Template | null> {
  const rows = await db
    .update(templates)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.slots !== undefined ? { slots: input.slots } : {}),
      ...(input.globalOverlays !== undefined ? { globalOverlays: input.globalOverlays } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(templates.userId, userId), eq(templates.id, id)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteTemplate(userId: string, id: string): Promise<void> {
  await db.delete(templates).where(and(eq(templates.userId, userId), eq(templates.id, id)));
}

export { DEFAULT_SLOTS };

/**
 * Internal "freeform" template every user gets exactly one of. Used as the
 * implicit container for videos composed via the timeline-style UI — the
 * user never sees it. Slot count is generous so we can append blocks
 * without re-creating the template; assembly walks bindings in array order
 * so the slot ids themselves don't matter.
 */
const FREEFORM_NAME = "__freeform__";
const FREEFORM_SLOTS = 32;

export async function ensureFreeformTemplate(userId: string): Promise<Template> {
  const rows = await db
    .select()
    .from(templates)
    .where(and(eq(templates.userId, userId), eq(templates.name, FREEFORM_NAME)))
    .limit(1);
  if (rows[0]) return rows[0];

  const slots: SlotInput[] = Array.from({ length: FREEFORM_SLOTS }, (_, i) => ({
    id: `slot_${i + 1}`,
    slotType: "freeform",
    label: `Item ${i + 1}`,
    transitionOut: "cut",
  }));
  return createTemplate(userId, {
    name: FREEFORM_NAME,
    description: "Internal freeform template used by the timeline composer.",
    slots,
  });
}

export async function listUserVisibleTemplates(userId: string): Promise<Template[]> {
  const all = await listTemplates(userId);
  return all.filter((t) => t.name !== FREEFORM_NAME);
}
