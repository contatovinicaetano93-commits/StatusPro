import { neon } from "@neondatabase/serverless";
import { getEnv } from "@/lib/env";

export function getSql() {
  const { DATABASE_URL } = getEnv();
  return neon(DATABASE_URL);
}

export type SqlClient = ReturnType<typeof getSql>;
