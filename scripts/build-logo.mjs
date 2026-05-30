#!/usr/bin/env node
// One-shot script: generate a 1000x1000 png logo for the Build Night submission.
// We render the Crealify isotype (lowercase "a" with a play triangle) as SVG,
// then rasterize via the @ffmpeg-installer ffmpeg binary that the worker
// already ships with — avoids adding a heavy image-processing dep.

import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..");
const outPath = join(projectRoot, "project-logo.png");
const tmpSvg = join(projectRoot, "project-logo.svg");

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  <rect width="1000" height="1000" rx="220" fill="#fafbfc"/>
  <g transform="translate(140 0) scale(13)">
    <path d="M44 8h6v48h-6v-6c-3 4-8 7-14 7C13 57 4 47 4 34s9-23 26-23c5 0 11 2 14 5V8zM26 49c10 0 18-7 18-15s-8-15-18-15S8 26 8 34s8 15 18 15z" fill="#1f2937"/>
    <circle cx="26" cy="34" r="11" fill="#fafbfc"/>
    <polygon points="22,28 22,40 33,34" fill="#1f2937"/>
  </g>
</svg>`;

function findFfmpeg() {
  const plat = `${process.platform}-${process.arch}`;
  let dir = projectRoot;
  for (let i = 0; i < 6; i++) {
    const nm = join(dir, "node_modules");
    if (existsSync(nm)) {
      const pnpm = join(nm, ".pnpm");
      if (existsSync(pnpm)) {
        const prefix = `@ffmpeg-installer+${plat}@`;
        const match = readdirSync(pnpm).find((d) => d.startsWith(prefix));
        if (match) {
          const candidate = join(pnpm, match, "node_modules", "@ffmpeg-installer", plat, "ffmpeg");
          if (existsSync(candidate)) return candidate;
        }
      }
    }
    dir = join(dir, "..");
  }
  return "ffmpeg";
}

const ffmpeg = findFfmpeg();
await mkdir(projectRoot, { recursive: true });
await writeFile(tmpSvg, SVG);

await new Promise((resolve, reject) => {
  const child = spawn(
    ffmpeg,
    ["-y", "-i", tmpSvg, "-vf", "scale=1000:1000", outPath],
    { stdio: "inherit" },
  );
  child.on("error", reject);
  child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
});

console.log("Wrote", outPath);
