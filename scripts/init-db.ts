import { getDb } from "../src/lib/db";

const db = getDb();
console.log(`Database ready at ${db}`.replace(/\[object Object\]/, "SQLite"));
