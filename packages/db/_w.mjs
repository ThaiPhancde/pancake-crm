import pg from "pg";
import { readFileSync } from "node:fs";
const url = readFileSync("D:/CRM/comp-ai-crm/.env", "utf8").match(/^DATABASE_URL="?([^"\n]+)"?/m)[1];
const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 15000 });
await c.connect();
const r = await c.query(`select "shopId", to_char(max("sourceCreatedAt"),'MM-DD HH24:MI') latest, count(*) filter (where "fetchedAt" > now() - interval '15 minutes')::int fetched15 from "pancakeOrder" group by 1 order by 1`);
console.log(r.rows.map(x => `${x.shopId} latest=${x.latest} fetched15m=${x.fetched15}`).join(" | "));
await c.end();
