import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../db/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../db/migrations");

async function ensureMigrationTable() {
  await pool.query(`
    create table if not exists schema_migrations (
      version varchar(50) primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

async function run() {
  await ensureMigrationTable();

  const files = (await readdir(migrationsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const alreadyApplied = await pool.query(
      "select 1 from schema_migrations where version = $1",
      [version],
    );

    if (alreadyApplied.rowCount) {
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    await pool.query("begin");

    try {
      await pool.query(sql);
      await pool.query("insert into schema_migrations (version) values ($1)", [version]);
      await pool.query("commit");
      console.log(`Applied migration ${version}`);
    } catch (error) {
      await pool.query("rollback");
      throw error;
    }
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

