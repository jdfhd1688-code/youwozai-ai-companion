import { getDb, getLastMigrationReport } from "../src/lib/db";

getDb();
const report = getLastMigrationReport();
if (!report) throw new Error("Migration report unavailable");

console.log(JSON.stringify(report, null, 2));
