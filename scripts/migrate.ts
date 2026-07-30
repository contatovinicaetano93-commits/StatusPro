import { readFileSync, readdirSync } from "fs";
import path from "path";
import { config } from "dotenv";
import pg from "pg";

config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const dir = path.resolve(process.cwd(), "db/migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const id = file.replace(/\.sql$/, "");
    const exists = await client.query("SELECT 1 FROM schema_migrations WHERE id = $1", [id]);
    if (exists.rowCount && exists.rowCount > 0) {
      console.log(`skip ${file}`);
      continue;
    }
    const sql = readFileSync(path.join(dir, file), "utf8");
    console.log(`apply ${file}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [id]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }

  await client.end();
  console.log("migrations done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
