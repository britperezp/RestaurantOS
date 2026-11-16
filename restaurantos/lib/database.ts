import "server-only";

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const configuredPath = process.env.RESTAURANTOS_DATABASE_PATH;
const databasePath = configuredPath === ":memory:"
  ? ":memory:"
  : configuredPath
    ? resolve(/* turbopackIgnore: true */ process.cwd(), configuredPath)
    : join(process.cwd(), "data", "restaurantos.sqlite");

if (databasePath !== ":memory:") mkdirSync(dirname(databasePath), { recursive: true });

const globalDatabase = globalThis as typeof globalThis & { restaurantOSDatabase?: Database.Database };

function initializeDatabase() {
  const instance = new Database(databasePath);
  instance.pragma("journal_mode = WAL");
  instance.pragma("foreign_keys = ON");
  return instance;
}

export const database = globalDatabase.restaurantOSDatabase ?? initializeDatabase();
globalDatabase.restaurantOSDatabase = database;