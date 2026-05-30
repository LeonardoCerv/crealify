import { IntegrationError, NotConfiguredError } from "@crealify/shared";
import Anthropic from "@anthropic-ai/sdk";

export type AnthropicConfig = { apiKey: string };

export const DEFAULT_SCRIPT_MODEL = "claude-opus-4-7";

export type GenerateHooksInput = {
  brief: string;
  count: number;
  slotType: string;
  styleNotes?: string | undefined;
  language?: string | undefined;
};

export type HookVariant = {
  script: string;
  rationale: string;
};

export type GenerateHooksResult = { variants: HookVariant[] };

export type GenerateCopyInput = {
  videoSummary: string;
  platform: "facebook" | "instagram" | "tiktok";
  brand?: string;
  language?: string;
};

export type GenerateCopyResult = {
  title: string;
  caption: string;
  hashtags: string[];
};

export type TranscriptSegmentInput = {
  startSec: number;
  endSec: number;
  text: string;
};

export type SegmentTranscriptInput = {
  segments: TranscriptSegmentInput[];
  totalDurationSec: number;
  brief?: string;
};

export type ProposedSection = {
  slotType: "opener" | "problem" | "solution" | "demo" | "cta" | string;
  label: string;
  startSec: number;
  endSec: number;
  rationale: string;
};

export type SegmentTranscriptResult = { sections: ProposedSection[] };

const HOOK_SYSTEM_PROMPT = `You are a senior direct-response copywriter specialising in short-form video ads (TikTok / Reels / Shorts). Your job is to write scripts for individual *blocks* of a video — opener, body, proof, or cta — not whole videos. Be ruthlessly punchy, conversational, and concrete. Never write title cards, scene directions, or stage cues. Just the spoken line(s).

Rules:
1. **Opener / hook blocks**: 1–2 short sentences max. Must stop the scroll in the first 1.5 seconds. Pattern-interrupt, surprising fact, sharp question, or contrarian claim. No filler.
2. **Body / explanation blocks**: 2–4 sentences. Translate the brief into a benefit the viewer cares about. No corporate language.
3. **Proof blocks**: cite a number, named scenario, or testimonial. Concrete > clever.
4. **CTA blocks**: imperative voice. One clear action. Optionally include urgency.
5. Always match the requested language exactly.
6. Each variant must be meaningfully different — vary angle (pain, curiosity, social proof, FOMO, contrarian), not just wording.
7. Output **only** valid JSON matching the requested schema. No prose, no markdown fences.`;

const COPY_SYSTEM_PROMPT = `You are a social-media manager writing platform-native post copy for short-form video ads. Match each platform's voice exactly: TikTok is casual, lower-case, comment-bait. Instagram Reels is polished, emoji-light, hook-forward. Facebook is direct, value-stated, slightly longer. Always output only valid JSON.`;

const SEGMENT_SYSTEM_PROMPT = `You are a video editor analysing a short-form ad's spoken transcript. The transcript is provided as an ordered list of timestamped utterances. Your job is to segment the video into structural BLOCKS that can be reused / swapped to produce variants.

Block types, in approximate order:
- **opener** (hook): the first scroll-stopping line(s). Usually 1–6 seconds. The fastest, sharpest claim or question.
- **problem**: the pain or "currently you have to..." framing. May be absent in shorter videos.
- **solution**: how the product solves the problem — the core pitch.
- **demo** (demo / proof): screen-recording moments, testimonials, named outcomes, numbers. Concrete evidence.
- **cta**: the explicit ask — "tap the link", "try X today", etc. Last 3–8 seconds usually.

Rules:
1. EVERY second of the video MUST be covered by exactly one section. No gaps, no overlaps.
2. The first section must start at 0.0s. The last section must end at the total duration.
3. Snap section boundaries to the END of a transcript segment (a complete utterance), never mid-word.
4. Use 3–5 sections. Don't over-fragment.
5. If you can't identify a distinct opener or problem or demo in this video, OMIT it — don't invent. A video can be opener → solution → cta.
6. \`label\` is a short human title (≤6 words). \`slotType\` is one of: opener, problem, solution, demo, cta.
7. \`rationale\` is one short sentence explaining why this is its own block.`;

export class AnthropicClient {
  private readonly sdk: Anthropic;

  constructor(config: AnthropicConfig) {
    if (!config.apiKey) throw new NotConfiguredError("anthropic");
    this.sdk = new Anthropic({ apiKey: config.apiKey });
  }

  async ping(): Promise<{ ok: true }> {
    return { ok: true };
  }

  async generateHooks(input: GenerateHooksInput): Promise<GenerateHooksResult> {
    const count = Math.min(Math.max(1, Math.round(input.count)), 20);
    const language = input.language ?? "English";
    const userPrompt = [
      `Slot type: ${input.slotType}`,
      `Language: ${language}`,
      `Number of variants: ${count}`,
      input.styleNotes ? `Style notes: ${input.styleNotes}` : null,
      "",
      `Brief:`,
      input.brief,
      "",
      `Call the propose_variants tool with exactly ${count} entries.`,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await this.callForTool<GenerateHooksResult>({
      systemPrompt: HOOK_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 2048,
      tool: {
        name: "propose_variants",
        description: "Return the requested script variants for this block.",
        input_schema: {
          type: "object",
          properties: {
            variants: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  script: { type: "string", description: "The spoken line(s)." },
                  rationale: {
                    type: "string",
                    description: "One short sentence explaining the angle.",
                  },
                },
                required: ["script", "rationale"],
              },
            },
          },
          required: ["variants"],
        },
      },
    });
    if (!isHookResult(result)) {
      throw new IntegrationError(
        "anthropic",
        `generateHooks: unexpected shape\n${JSON.stringify(result).slice(0, 500)}`,
      );
    }
    return result;
  }

  async segmentTranscript(input: SegmentTranscriptInput): Promise<SegmentTranscriptResult> {
    if (input.segments.length === 0) {
      throw new IntegrationError("anthropic", "segmentTranscript: empty transcript");
    }
    const lines = input.segments
      .map(
        (s, i) =>
          `[${i + 1}] ${s.startSec.toFixed(2)}s → ${s.endSec.toFixed(2)}s: ${s.text.replace(/\s+/g, " ").trim()}`,
      )
      .join("\n");
    const userPrompt = [
      `Total video duration: ${input.totalDurationSec.toFixed(2)}s`,
      input.brief ? `Brief / context: ${input.brief}` : null,
      "",
      "Transcript (with timestamps):",
      lines,
      "",
      "Call the propose_sections tool. Constraints:",
      `- First section starts at 0.0s.`,
      `- Last section ends at exactly ${input.totalDurationSec.toFixed(2)}s.`,
      `- 3 to 5 sections total. No gaps. No overlaps.`,
      `- Boundaries snap to the end of a transcript line, never mid-word.`,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await this.callForTool<SegmentTranscriptResult>({
      systemPrompt: SEGMENT_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 2048,
      tool: {
        name: "propose_sections",
        description: "Return the section breakdown for the video.",
        input_schema: {
          type: "object",
          properties: {
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slotType: {
                    type: "string",
                    enum: ["opener", "problem", "solution", "demo", "cta"],
                  },
                  label: { type: "string", description: "Short human title (≤6 words)." },
                  startSec: { type: "number" },
                  endSec: { type: "number" },
                  rationale: { type: "string" },
                },
                required: ["slotType", "label", "startSec", "endSec", "rationale"],
              },
            },
          },
          required: ["sections"],
        },
      },
    });
    if (!isSegmentResult(result)) {
      throw new IntegrationError(
        "anthropic",
        `segmentTranscript: unexpected shape\n${JSON.stringify(result).slice(0, 500)}`,
      );
    }
    return result;
  }

  async generatePostCopy(input: GenerateCopyInput): Promise<GenerateCopyResult> {
    const language = input.language ?? "English";
    const userPrompt = [
      `Platform: ${input.platform}`,
      `Language: ${language}`,
      input.brand ? `Brand: ${input.brand}` : null,
      "",
      `Video summary:`,
      input.videoSummary,
      "",
      "Call the propose_post_copy tool.",
      "- title: short, scroll-stopping (≤10 words).",
      "- caption: platform-appropriate length and tone.",
      "- hashtags: 5–8 relevant tags, no leading #.",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await this.callForTool<GenerateCopyResult>({
      systemPrompt: COPY_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1024,
      tool: {
        name: "propose_post_copy",
        description: "Return the platform-specific post copy.",
        input_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            caption: { type: "string" },
            hashtags: { type: "array", items: { type: "string" } },
          },
          required: ["title", "caption", "hashtags"],
        },
      },
    });
    if (!isCopyResult(result)) {
      throw new IntegrationError(
        "anthropic",
        `generatePostCopy: unexpected shape\n${JSON.stringify(result).slice(0, 500)}`,
      );
    }
    return result;
  }

  /** Shared structured-output helper using the tool-use mechanism. */
  private async callForTool<T>(args: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens: number;
    tool: {
      name: string;
      description: string;
      input_schema: Record<string, unknown>;
    };
  }): Promise<T> {
    const response = await this.sdk.messages.create({
      model: DEFAULT_SCRIPT_MODEL,
      max_tokens: args.maxTokens,
      system: [
        {
          type: "text",
          text: args.systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        {
          name: args.tool.name,
          description: args.tool.description,
          input_schema: args.tool.input_schema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: args.tool.name },
      messages: [{ role: "user", content: args.userPrompt }],
    });
    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (!toolUse) {
      throw new IntegrationError(
        "anthropic",
        `callForTool: model did not return a tool_use block (stop_reason=${response.stop_reason})`,
      );
    }
    return toolUse.input as T;
  }
}

function isHookResult(v: unknown): v is GenerateHooksResult {
  if (!v || typeof v !== "object") return false;
  const variants = (v as { variants?: unknown }).variants;
  return (
    Array.isArray(variants) &&
    variants.every(
      (x) =>
        x && typeof x === "object" && typeof (x as { script?: unknown }).script === "string",
    )
  );
}

function isSegmentResult(v: unknown): v is SegmentTranscriptResult {
  if (!v || typeof v !== "object") return false;
  const sections = (v as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return false;
  return sections.every((x) => {
    if (!x || typeof x !== "object") return false;
    const s = x as Record<string, unknown>;
    return (
      typeof s.slotType === "string" &&
      typeof s.label === "string" &&
      typeof s.startSec === "number" &&
      typeof s.endSec === "number" &&
      typeof s.rationale === "string"
    );
  });
}

function isCopyResult(v: unknown): v is GenerateCopyResult {
  if (!v || typeof v !== "object") return false;
  const o = v as { title?: unknown; caption?: unknown; hashtags?: unknown };
  return (
    typeof o.title === "string" &&
    typeof o.caption === "string" &&
    Array.isArray(o.hashtags) &&
    o.hashtags.every((h) => typeof h === "string")
  );
}
