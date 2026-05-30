import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { CrealifyWordmark } from "@/components/brand/logo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6">
      <header className="flex items-center justify-between border-b border-ink/10 py-5">
        <Link href="/dashboard" className="text-ink">
          <CrealifyWordmark size="sm" />
        </Link>
        <nav className="flex items-center gap-5 text-sm text-ink/70">
          <Link href="/videos" className="hover:text-ink">
            Videos
          </Link>
          <Link href="/blocks" className="hover:text-ink">
            Blocks
          </Link>
          <Link href="/personas" className="hover:text-ink">
            Personas
          </Link>
          <Link href="/settings" className="hover:text-ink">
            Settings
          </Link>
          <span className="text-ink/40">|</span>
          <span className="text-xs text-ink/50">{user.email}</span>
        </nav>
      </header>
      <main className="flex-1 py-8">{children}</main>
    </div>
  );
}
