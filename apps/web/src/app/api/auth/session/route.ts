import { NextResponse } from "next/server";
import { createSession, destroySession, getSessionUser } from "@/lib/session";
import { upsertUserFromSession } from "@/lib/users";

export async function POST(request: Request) {
  const { idToken } = (await request.json()) as { idToken?: string };
  if (!idToken) {
    return NextResponse.json({ error: "idToken required" }, { status: 400 });
  }
  try {
    await createSession(idToken);
    const session = await getSessionUser();
    if (session) await upsertUserFromSession(session);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 401 },
    );
  }
}

export async function DELETE() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
