import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { renderBlockFunction } from "@/inngest/functions/render-block";

export const maxDuration = 300;
import { renderVideoFunction } from "@/inngest/functions/render-video";
import { assembleVideoFunction } from "@/inngest/functions/assemble-video";
import { publishVideoFunction } from "@/inngest/functions/publish-video";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    renderBlockFunction,
    renderVideoFunction,
    assembleVideoFunction,
    publishVideoFunction,
  ],
});
