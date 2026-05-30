import "server-only";
import { Inngest, EventSchemas } from "inngest";

type Events = {
  "block.render.requested": {
    data: { userId: string; renderId: string };
  };
  "video.render.requested": {
    data: { userId: string; videoId: string };
  };
  "video.assemble.requested": {
    data: { userId: string; videoId: string };
  };
  "video.publish.requested": {
    data: {
      userId: string;
      videoId: string;
      platforms: Array<"facebook" | "instagram" | "tiktok">;
    };
  };
};

export const inngest = new Inngest({
  id: "crealify",
  schemas: new EventSchemas().fromRecord<Events>(),
  eventKey: process.env.INNGEST_EVENT_KEY,
  isDev: process.env.INNGEST_DEV === "1" || process.env.NODE_ENV !== "production",
});

export type CrealifyEvents = Events;
