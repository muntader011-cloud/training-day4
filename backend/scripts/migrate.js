// Runs every sql/*.sql file in name order against DATABASE_URL.
// Optional: ASSIGN_EXISTING_TO=<user email> assigns customers without an owner to that user.
import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "../src/db.js";

const sqlDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sql");

try {
  const files = (await readdir(sqlDir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await pool.query(await readFile(path.join(sqlDir, file), "utf8"));
    console.log(`Applied ${file}`);
  }

  const assignTo = process.env.ASSIGN_EXISTING_TO;
  if (assignTo) {
    const { rows } = await pool.query("SELECT id FROM users WHERE lower(email) = lower($1)", [assignTo]);
    if (!rows[0]) throw new Error(`No user with email ${assignTo}`);
    const { rowCount } = await pool.query("UPDATE customers SET sales_user_id = $1 WHERE sales_user_id IS NULL", [rows[0].id]);
    console.log(`Assigned ${rowCount} unowned customer(s) to ${assignTo}`);
  }
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
