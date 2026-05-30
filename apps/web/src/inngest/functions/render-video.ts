import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db, blocks, characters, videos, voices } from "@crealify/db";
import { ensureRender } from "@/lib/renders";
import { inngest } from "../client";

/**
 * Compose a video: ensure a block render exists for each binding, enqueue any
 * pending renders, then hand off to assembly when all renders are ready.
 */
export const renderVideoFunction = inngest.createFunction(
  {
    id: "render-video",
    retries: 1,
  },
  { event: "video.render.requested" },
  async ({ event, step }) => {
    const { userId, videoId } = event.data;

    const ctx = await step.run("load-video", async () => {
      const rows = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
      const video = rows[0];
      if (!video) throw new Error(`Video ${videoId} not found`);
      if (video.userId !== userId) throw new Error("Cross-user video access");
      const blockIds = video.bindings.map((b) => b.blockId);
      const blockRows = blockIds.length
        ? await db.select().from(blocks).where(inArray(blocks.id, blockIds))
        : [];
      const character = video.characterId
        ? await db
            .select()
            .from(characters)
            .where(eq(characters.id, video.characterId))
            .limit(1)
            .then((r) => r[0] ?? null)
        : null;
      const voice = video.voiceId
        ? await db
            .select()
            .from(voices)
            .where(eq(voices.id, video.voiceId))
            .limit(1)
            .then((r) => r[0] ?? null)
        : null;
      return { video, blockRows, character, voice };
    });

    // A Persona applies across every script-bearing clip — including imported
    // (upload-source) blocks where featuresCharacter is false by default.
    // The featuresCharacter flag only gates the legacy character-generated
    // sources (lipsync/dop) where it's meaningful for cache invalidation.
    const personaActive = !!ctx.character?.voiceExternalId;

    // 1. Ensure a render exists for each binding. Enqueue jobs for newly-created ones.
    const renders = await step.run("ensure-renders", async () => {
      const out: Array<{ renderId: string; created: boolean }> = [];
      for (const binding of ctx.video.bindings) {
        const block = ctx.blockRows.find((b) => b.id === binding.blockId);
        if (!block) throw new Error(`Block ${binding.blockId} missing`);
        const includeCharacter = personaActive || block.featuresCharacter === 1;
        const { render, created } = await ensureRender(userId, {
          block,
          character: includeCharacter ? ctx.character : null,
          voice: includeCharacter ? ctx.voice : null,
          aspect: ctx.video.aspect,
          backgroundVariantId: binding.backgroundVariantId ?? null,
        });
        out.push({ renderId: render.id, created });
      }
      return out;
    });

    await step.run("mark-video-rendering", async () => {
      await db.update(videos).set({ status: "rendering" }).where(eq(videos.id, videoId));
    });

    // Fire off block render events for newly-created pending renders.
    const newly = renders.filter((r) => r.created);
    if (newly.length > 0) {
      await step.sendEvent(
        "enqueue-block-renders",
        newly.map((r) => ({
          name: "block.render.requested" as const,
          data: { userId, renderId: r.renderId },
        })),
      );
    }

    // 2. Wait until each render reaches a terminal state.
    // Phase 3 uses a polling loop. Future: subscribe to `block.render.completed` events.
    const finalStates = await step.run("poll-renders", async () => {
      const { blockRenders } = await import("@crealify/db");
      const renderIds = renders.map((r) => r.renderId);
      const maxAttempts = 180; // 15 minutes at 5s intervals
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((r) => setTimeout(r, 5_000));
        const rows = await db
          .select()
          .from(blockRenders)
          .where(inArray(blockRenders.id, renderIds));
        const failed = rows.find((r) => r.status === "failed");
        if (failed) {
          throw new Error(
            `Render ${failed.id} failed: ${failed.error ?? "unknown error"}`,
          );
        }
        if (rows.every((r) => r.status === "succeeded")) return rows;
      }
      throw new Error("Render did not complete within timeout");
    });

    // 3. Hand off to the assembler.
    await step.sendEvent("enqueue-assembly", {
      name: "video.assemble.requested",
      data: { userId, videoId },
    });

    return {
      videoId,
      renderIds: finalStates.map((r) => r.id),
    };
  },
);
