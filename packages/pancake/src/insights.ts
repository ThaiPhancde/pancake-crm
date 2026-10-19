import { type Db, Prisma } from "@crm/db";
import { z } from "zod";
import {
	assertShopReader,
	canWrite,
	orderScope,
	PancakeAccessError,
} from "./access";
import { writeAudit } from "./admin";
import { PANCAKE, shopTimezone } from "./config";
import {
	type bulkUpdateInput,
	customerProfileWire,
	type ListInput,
	type ReportInput,
	type recordRefInput,
} from "./contracts";
import {
	customerScope,
	fillDays,
	leadRow,
	orderSqlWhere,
	updateAppointment,
	updateLead,
	updateTicket,
	zonedDay,
} from "./queries";

export const searchInput = z.object({
	shopId: z.string().min(1),
	q: z.string().trim().min(1).max(120),
});

export async function globalSearch(
	db: Db,
	userId: string,
	input: z.infer<typeof searchInput>,
) {
	const grants = await assertShopReader(db, userId, input.shopId);
	const { q, shopId } = input;
	const take = PANCAKE.searchLimit;
	const text = { contains: q, mode: "insensitive" as const };
	const [customers, orders, leads, tickets] = await Promise.all([
		db.pancakeCustomer.findMany({
			where: {
				AND: [
					customerScope(grants, shopId),
					{ OR: [{ name: text }, { phone: { contains: q } }] },
				],
			},
			select: { customerId: true, name: true, phone: true },
			orderBy: [{ sourceUpdatedAt: "desc" }, { customerId: "asc" }],
			take,
		}),
		db.pancakeOrder.findMany({
			where: {
				AND: [
					orderScope(grants, shopId),
					{
						OR: [
							{ orderId: { contains: q } },
							{ customerPhone: { contains: q } },
							{ customerName: text },
						],
					},
				],
			},
			select: {
				orderId: true,
				customerName: true,
				customerPhone: true,
				status: true,
				currency: true,
				totalPrice: true,
				sourceCreatedAt: true,
			},
			orderBy: [{ sourceCreatedAt: "desc" }, { orderId: "asc" }],
			take,
		}),
		db.pancakeLead.findMany({
			where: {
				shopId,
				OR: [{ name: text }, { phone: { contains: q } }, { email: text }],
			},
			select: { id: true, name: true, phone: true, status: true },
			orderBy: [{ createdAt: "desc" }, { id: "asc" }],
			take,
		}),
		db.pancakeTicket.findMany({
			where: {
				shopId,
				OR: [
					{ title: text },
					{ contactName: text },
					{ phone: { contains: q } },
					{ orderId: { contains: q } },
				],
			},
			select: { id: true, title: true, contactName: true, status: true },
			orderBy: [{ createdAt: "desc" }, { id: "asc" }],
			take,
		}),
	]);
	return {
		customers,
		orders: orders.map((row) => ({
			...row,
			totalPrice: row.totalPrice.toString(),
			sourceCreatedAt: row.sourceCreatedAt.toISOString(),
		})),
		leads,
		tickets,
	};
}

export async function leadDetail(
	db: Db,
	userId: string,
	input: z.infer<typeof recordRefInput>,
) {
	const grants = await assertShopReader(db, userId, input.shopId);
	const row = await db.pancakeLead.findFirst({
		where: { id: input.id, shopId: input.shopId },
	});
	if (!row) throw new PancakeAccessError();
	const [creator, assignee] = await Promise.all([
		db.user.findUnique({
			where: { id: row.createdById },
			select: { name: true },
		}),
		row.assigneeId
			? db.pancakeEmployee.findUnique({
					where: {
						shopId_employeeId: {
							shopId: input.shopId,
							employeeId: row.assigneeId,
						},
					},
					select: { name: true },
				})
			: null,
	]);
	return {
		...leadRow(row),
		creatorName: creator?.name ?? null,
		assigneeName: assignee?.name ?? null,
		converted: row.status === PANCAKE.leadConvertedStatus,
		canWrite: canWrite(grants, input.shopId),
	};
}

export async function convertLead(
	db: Db,
	userId: string,
	input: z.infer<typeof recordRefInput>,
) {
	const row = await updateLead(db, userId, {
		id: input.id,
		shopId: input.shopId,
		status: PANCAKE.leadConvertedStatus,
	});
	await writeAudit(db, {
		shopId: input.shopId,
		userId,
		area: "record",
		action: "lead_convert",
		summary: `Chuyển đổi tiềm năng ${row.name}`,
	});
	return row;
}

export async function bulkUpdate(
	db: Db,
	userId: string,
	input: z.infer<typeof bulkUpdateInput>,
) {
	const updated: {
		id: string;
		title: string;
		assigneeId: string | null;
	}[] = [];
	const failed: string[] = [];
	for (const id of [...new Set(input.ids)]) {
		const patch = {
			id,
			shopId: input.shopId,
			status: input.status,
			assigneeId: input.assigneeId,
		};
		try {
			if (input.entity === "lead") {
				const row = await updateLead(db, userId, patch);
				updated.push({ id, title: row.name, assigneeId: row.assigneeId });
			} else if (input.entity === "appointment") {
				const row = await updateAppointment(db, userId, patch);
				updated.push({ id, title: row.title, assigneeId: row.assigneeId });
			} else {
				const row = await updateTicket(db, userId, patch);
				updated.push({ id, title: row.title, assigneeId: row.assigneeId });
			}
		} catch (error) {
			if (!(error instanceof PancakeAccessError)) throw error;
			failed.push(id);
		}
	}
	return { updated, failed };
}

export const GENDER_BUCKETS = ["male", "female", "other", "unknown"] as const;

export function genderBucket(
	value: string | null | undefined,
): (typeof GENDER_BUCKETS)[number] {
	const text = (value ?? "").trim().toLowerCase();
	if (!text) return "unknown";
	if (["male", "nam", "m"].includes(text)) return "male";
	if (["female", "nữ", "nu", "f"].includes(text)) return "female";
	return "other";
}

export function ageLabels(): string[] {
	const edges = PANCAKE.ageBuckets;
	return [
		`<${edges[0]}`,
		...edges.slice(1).map((edge, index) => `${edges[index]}-${edge - 1}`),
		`${edges[edges.length - 1]}+`,
		"unknown",
	];
}

export function ageBucket(
	birthday: string | null | undefined,
	now: Date,
): string {
	const labels = ageLabels();
	const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthday ?? "");
	if (!match) return "unknown";
	const [year, month, day] = [
		Number(match[1]),
		Number(match[2]),
		Number(match[3]),
	];
	const today = now.toISOString().slice(5, 10);
	const age =
		now.getUTCFullYear() -
		year -
		(today < `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
			? 1
			: 0);
	if (age < 0 || age > 120) return "unknown";
	const index = PANCAKE.ageBuckets.findIndex((edge) => age < edge);
	return labels[index === -1 ? PANCAKE.ageBuckets.length : index] ?? "unknown";
}

const profileRow = customerProfileWire.extend({ count: z.number() });
const purchaseRow = z.object({
	bucket: z.number().int(),
	currency: z.string(),
	revenue: z.string(),
});
const bucketCount = z.object({
	bucket: z.number().int(),
	customers: z.number(),
});

function percent(part: number, whole: number) {
	return whole ? Number(((100 * part) / whole).toFixed(1)) : 0;
}

function reportListInput(input: ReportInput): ListInput {
	return {
		view: "all",
		sort: "newest",
		q: "",
		page: 1,
		pageSize: 1,
		shopId: input.shopId,
		from: input.from,
		to: input.to,
	};
}

export async function customerReport(
	db: Db,
	userId: string,
	input: ReportInput,
) {
	const grants = await assertShopReader(db, userId, input.shopId);
	const grant = grants.find((item) => item.shopId === input.shopId);
	const employee = grant?.employeeId ?? "__unmapped__";
	const telesale =
		grant?.role === "TELESALE"
			? Prisma.sql`AND (c."assignedEmployeeId" = ${employee} OR EXISTS (SELECT 1 FROM "pancakeOrder" o WHERE o."shopId" = c."shopId" AND o."customerId" = c."customerId" AND o."sellerId" = ${employee}))`
			: Prisma.empty;
	const scope = orderSqlWhere(grants, reportListInput(input));
	const excluded = Prisma.join([...PANCAKE.bookedExcludedStatuses]);
	const per = Prisma.sql`
		WITH per AS (
			SELECT o."shopId", o."customerId", LEAST(count(*), ${PANCAKE.purchaseBuckets})::int AS bucket
			FROM "pancakeOrder" o
			WHERE ${scope} AND o."customerId" IS NOT NULL AND o.status NOT IN (${excluded})
			GROUP BY 1, 2
		)`;
	const [profiles, revenueRows, countRows] = await Promise.all([
		db.$queryRaw`
			SELECT c.raw->'gender' AS gender, c.raw->'date_of_birth' AS date_of_birth, count(*)::float8 AS count
			FROM "pancakeCustomer" c
			WHERE c."shopId" = ${input.shopId} ${telesale}
			GROUP BY 1, 2`,
		db.$queryRaw`${per}
			SELECT per.bucket, o.currency, COALESCE(sum(o."totalPrice"), 0)::text AS revenue
			FROM per JOIN "pancakeOrder" o ON o."shopId" = per."shopId" AND o."customerId" = per."customerId"
			WHERE ${scope} AND o.status NOT IN (${excluded})
			GROUP BY 1, 2
			ORDER BY 1, 2`,
		db.$queryRaw`${per}
			SELECT bucket, count(*)::float8 AS customers FROM per GROUP BY 1 ORDER BY 1`,
	]);
	const now = new Date();
	const genders = new Map<string, number>(GENDER_BUCKETS.map((g) => [g, 0]));
	const ages = new Map<string, number>(ageLabels().map((label) => [label, 0]));
	let totalCustomers = 0;
	for (const row of z.array(profileRow).parse(profiles)) {
		totalCustomers += row.count;
		const gender = genderBucket(row.gender);
		genders.set(gender, (genders.get(gender) ?? 0) + row.count);
		const age = ageBucket(row.date_of_birth, now);
		ages.set(age, (ages.get(age) ?? 0) + row.count);
	}
	const counts = z.array(bucketCount).parse(countRows);
	const buyers = counts.reduce((sum, row) => sum + row.customers, 0);
	const revenue = z.array(purchaseRow).parse(revenueRows);
	const purchases = Array.from(
		{ length: PANCAKE.purchaseBuckets },
		(_, index) => {
			const bucket = index + 1;
			const customers =
				counts.find((row) => row.bucket === bucket)?.customers ?? 0;
			return {
				bucket:
					bucket === PANCAKE.purchaseBuckets
						? `>${PANCAKE.purchaseBuckets - 1}`
						: String(bucket),
				customers,
				share: percent(customers, buyers),
				revenue: revenue
					.filter((row) => row.bucket === bucket)
					.map((row) => ({ currency: row.currency, amount: row.revenue })),
			};
		},
	);
	return {
		totalCustomers,
		buyers,
		gender: [...genders].map(([gender, count]) => ({
			gender,
			count,
			share: percent(count, totalCustomers),
		})),
		age: [...ages].map(([bucket, count]) => ({
			bucket,
			count,
			share: percent(count, totalCustomers),
		})),
		purchases,
	};
}

type TaskPoint = {
	createdAt: Date;
	completedAt: Date | null;
	dueAt: Date;
	status: "OPEN" | "DONE";
};

function within(at: Date, range: { from?: string; to?: string }) {
	return (
		(!range.from || at >= new Date(range.from)) &&
		(!range.to || at < new Date(range.to))
	);
}

export function taskSeries(
	tasks: TaskPoint[],
	range: { from?: string; to?: string },
	now: Date,
	timeZone: string,
) {
	const buckets = new Map<
		string,
		{ date: string; created: number; done: number; overdue: number }
	>();
	const bump = (at: Date, key: "created" | "done" | "overdue") => {
		const date = zonedDay(at, timeZone);
		const row = buckets.get(date) ?? {
			date,
			created: 0,
			done: 0,
			overdue: 0,
		};
		row[key] += 1;
		buckets.set(date, row);
	};
	for (const task of tasks) {
		if (within(task.createdAt, range)) bump(task.createdAt, "created");
		if (
			task.status === "DONE" &&
			task.completedAt &&
			within(task.completedAt, range)
		)
			bump(task.completedAt, "done");
		if (task.status === "OPEN" && task.dueAt < now && within(task.dueAt, range))
			bump(task.dueAt, "overdue");
	}
	const days = fillDays(buckets, range, now, timeZone, (date) => ({
		date,
		created: 0,
		done: 0,
		overdue: 0,
	}));
	return {
		created: days.reduce((sum, row) => sum + row.created, 0),
		done: days.reduce((sum, row) => sum + row.done, 0),
		overdue: days.reduce((sum, row) => sum + row.overdue, 0),
		days,
	};
}

export async function taskReport(db: Db, userId: string, input: ReportInput) {
	const grants = await assertShopReader(db, userId, input.shopId);
	const range =
		input.from || input.to
			? {
					gte: input.from ? new Date(input.from) : undefined,
					lt: input.to ? new Date(input.to) : undefined,
				}
			: undefined;
	const tasks = await db.pancakeTask.findMany({
		where: {
			order: orderScope(grants, input.shopId),
			OR: range
				? [{ createdAt: range }, { completedAt: range }, { dueAt: range }]
				: undefined,
		},
		select: { createdAt: true, completedAt: true, dueAt: true, status: true },
		take: PANCAKE.exportMaxRows,
	});
	return {
		timezone: shopTimezone(input.shopId),
		...taskSeries(tasks, input, new Date(), shopTimezone(input.shopId)),
	};
}
