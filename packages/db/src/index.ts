import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let _db: Db | null = null;

function getDb(): Db {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const client = postgres(url, { max: 10 });
  _db = drizzle(client, { schema });
  return _db;
}

/**
 * Drizzle client — lazily initialized on first access so that bundling
 * (e.g. `next build`) does not require DATABASE_URL to be set at module load.
 */
export const db: Db = new Proxy({} as Db, {
  get(_t, p) {
    const real = getDb();
    const value = (real as unknown as Record<PropertyKey, unknown>)[p];
    return typeof value === "function" ? (value as Function).bind(real) : value;
  },
});

export { schema };
export * from "./schema/index";
