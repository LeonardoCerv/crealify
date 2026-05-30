"use client";

import { useRef, useState } from "react";
import { mintBlockUploadUrlAction } from "./upload-actions";

type Props = {
  name: string;
  defaultValue?: string;
  label?: string;
};

const ACCEPT = "video/mp4,video/quicktime,video/webm,video/x-matroska";

/**
 * Hybrid field for uploaded video assets: a hidden text input holds the
 * public URL, plus a file picker that PUTs directly to R2 via a presigned
 * URL and fills the hidden input on success.
 */
export function UploadField({ name, defaultValue = "", label = "Asset URL" }: Props) {
  const [url, setUrl] = useState(defaultValue);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  async function onFile(file: File) {
    setError(null);
    setProgress(0);
    setFilename(file.name);
    const mint = await mintBlockUploadUrlAction({
      contentType: file.type || "video/mp4",
      filename: file.name,
      byteSize: file.size,
    });
    if (!mint.ok) {
      setError(mint.error);
      setProgress(null);
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open("PUT", mint.uploadUrl);
      xhr.setRequestHeader("content-type", file.type || "video/mp4");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(file);
    }).then(
      () => {
        setUrl(mint.publicUrl);
        setProgress(100);
      },
      (err: Error) => {
        setError(err.message);
        setProgress(null);
      },
    );
  }

  function onCancel() {
    xhrRef.current?.abort();
    setProgress(null);
    setError(null);
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs">
        <span className="text-ink/70">{label}</span>
        <input
          name={name}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…/your-clip.mp4"
          className="mt-1 block w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
        />
      </label>

      <div className="flex items-center gap-2 text-[11px]">
        <label className="cursor-pointer rounded-full border border-ink/15 bg-paper px-3 py-1 text-ink/70 hover:bg-ink/5">
          {progress === null ? "Upload file" : "Replace…"}
          <input
            type="file"
            accept={ACCEPT}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
            className="hidden"
          />
        </label>
        {progress !== null && progress < 100 ? (
          <>
            <span className="text-ink/60">
              {filename}: {progress}%
            </span>
            <button
              type="button"
              onClick={onCancel}
              className="text-red-700 underline"
            >
              cancel
            </button>
          </>
        ) : progress === 100 ? (
          <span className="text-emerald-700">Uploaded ✓</span>
        ) : null}
      </div>
      {error ? <p className="text-[11px] text-red-700">{error}</p> : null}
      {url ? (
        <video
          src={url}
          controls
          preload="metadata"
          className="mt-1 max-h-32 rounded-md border border-ink/10"
        />
      ) : null}
    </div>
  );
}
