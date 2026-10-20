import "@crm/env/load";
import { db } from "../src/client";

const BATCH = 2000;

let updated = 0;
try {
	for (;;) {
		const changed = await db.$executeRaw`
			WITH batch AS (
				SELECT ctid FROM "pancakeCustomer"
				WHERE "sourceCreatedAt" IS NULL
					AND raw->>'inserted_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
				LIMIT ${BATCH}
				FOR UPDATE SKIP LOCKED
			)
			UPDATE "pancakeCustomer" AS c
			SET "sourceCreatedAt" = (
				CASE
					WHEN c.raw->>'inserted_at' ~ '([Zz]|[+-][0-9]{2}:[0-9]{2})$'
						THEN (c.raw->>'inserted_at')::timestamptz
					ELSE ((c.raw->>'inserted_at') || 'Z')::timestamptz
				END
			) AT TIME ZONE 'UTC'
			FROM batch
			WHERE c.ctid = batch.ctid
		`;
		if (changed === 0) break;
		updated += changed;
		process.stdout.write(
			`${JSON.stringify({ event: "backfill_progress", updated })}\n`,
		);
	}
	process.stdout.write(
		`${JSON.stringify({ event: "backfill_done", updated })}\n`,
	);
} finally {
	await db.$disconnect();
}
