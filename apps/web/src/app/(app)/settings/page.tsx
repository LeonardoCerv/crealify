import { requireUserId } from "@/lib/session";
import { listTokenStatuses } from "@/lib/tokens";
import { ProviderCard } from "./provider-card";

export const dynamic = "force-dynamic";

const PROVIDER_META = {
  higgsfield: {
    label: "Higgsfield",
    help: "Cloud API token (Soul ID, Lipsync, DoP, Motion Control).",
    secretLabel: "API token",
    extraFields: [
      { name: "baseUrl", label: "Base URL (optional)", placeholder: "https://api.higgsfield.ai" },
    ],
  },
  elevenlabs: {
    label: "ElevenLabs",
    help: "API key for voice synthesis. Live ping verifies the key.",
    secretLabel: "API key",
    extraFields: [],
  },
  anthropic: {
    label: "Anthropic",
    help: "API key for script + post-copy generation. Live ping verifies the key.",
    secretLabel: "API key",
    extraFields: [],
  },
  openai: {
    label: "OpenAI (optional)",
    help: "Fallback for script generation. Optional.",
    secretLabel: "API key",
    extraFields: [],
  },
  meta: {
    label: "Meta (Facebook + Instagram)",
    help: "Page access token. Provide FB Page ID and IG Business ID.",
    secretLabel: "Page access token",
    extraFields: [
      { name: "facebookPageId", label: "Facebook Page ID", placeholder: "1234567890" },
      { name: "instagramBusinessId", label: "Instagram Business ID", placeholder: "1789012345" },
    ],
  },
  tiktok: {
    label: "TikTok",
    help: "Content Posting API access token.",
    secretLabel: "Access token",
    extraFields: [{ name: "openId", label: "Open ID (optional)", placeholder: "open_id_value" }],
  },
} as const;

export default async function SettingsPage() {
  const userId = await requireUserId();
  const statuses = await listTokenStatuses(userId);

  return (
    <section className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-ink/60">
          BYOK — tokens are encrypted at rest with AES-256-GCM and never logged. Verify pings the
          provider live.
        </p>
      </header>

      <div className="space-y-3">
        {statuses.map((status) => {
          const meta = PROVIDER_META[status.provider];
          return (
            <ProviderCard
              key={status.provider}
              provider={status.provider}
              label={meta.label}
              help={meta.help}
              secretLabel={meta.secretLabel}
              extraFields={[...meta.extraFields]}
              configured={status.configured}
              lastVerifiedAt={status.lastVerifiedAt?.toISOString() ?? null}
              lastError={status.lastError}
              metadata={status.metadata}
            />
          );
        })}
      </div>
    </section>
  );
}
