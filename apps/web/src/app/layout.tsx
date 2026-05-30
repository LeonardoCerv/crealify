import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Crealify", template: "%s · Crealify" },
  description:
    "Block-based AI-character video automation. Compose short-form ads from reusable Opener / Problem / Solution / Demo / CTA blocks. Open source.",
  metadataBase: new URL("https://crealify.xyz"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
