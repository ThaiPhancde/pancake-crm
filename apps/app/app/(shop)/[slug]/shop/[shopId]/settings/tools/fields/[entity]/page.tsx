import Add from "@carbon/icons-react/es/Add";
import Checkmark from "@carbon/icons-react/es/Checkmark";
import Close from "@carbon/icons-react/es/Close";
import Draggable from "@carbon/icons-react/es/Draggable";
import Locked from "@carbon/icons-react/es/Locked";
import View from "@carbon/icons-react/es/View";
import { Button } from "@crm/ui/components/button";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import {
	COLLECTIONS,
	FIELD_TYPES,
	fieldSections,
	isCollectionKey,
} from "@/components/shop/collections";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { FieldInput } from "@/components/shop/record-sheet";
import { SettingsFrame } from "@/components/shop/settings-frame";

const ENTITY_BACK_PATH: Record<string, string> = {
	lead: "/leads",
	contact: "/contacts",
	order: "/orders",
	product: "/products",
	appointment: "/calendar",
	ticket: "/tickets",
	task: "/reports/tasks",
};

const FIELD_ICON_SYMBOL: Record<string, string> = {
	phone: "📞",
	money: "$",
	number: "123",
	text: "T=",
	textarea: "¶",
	datetime: "📅",
	boolean: "✓",
	select: "◉",
	multiselect: "☑",
	email: "✉",
	url: "🌐",
	formula: "fx",
};

export default function FieldsPage({
	params,
}: {
	params: Promise<ShopRoute & { entity: string }>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Fields params={params} />
		</Suspense>
	);
}

async function Fields({
	params,
}: {
	params: Promise<ShopRoute & { entity: string }>;
}) {
	const [ctx, { entity }] = await Promise.all([loadShop(params), params]);
	if (!isCollectionKey(entity)) notFound();
	const collection = COLLECTIONS[entity];
	const backHref = `${ctx.base}${ENTITY_BACK_PATH[entity] ?? ""}`;
	const sections = fieldSections(collection.fields);

	return (
		<SettingsFrame
			current={collection.title}
			trail={[{ label: "Bảng", href: `${ctx.base}/settings/tools` }]}
			className="bg-transparent"
		>
			<div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_310px]">
				<div className="flex flex-col gap-3">
					<div className="flex items-center justify-center gap-2 rounded-lg border bg-card py-2.5 shadow-2xs">
						<Button
							asChild
							variant="outline"
							size="icon"
							aria-label="Xem danh sách"
						>
							<Link href={backHref}>
								<Icon icon={View} />
							</Link>
						</Button>
						<Button variant="outline" disabled>
							<Icon icon={Close} data-icon="inline-start" />
							Bỏ thay đổi
						</Button>
						<Button variant="outline" disabled>
							<Icon icon={Checkmark} data-icon="inline-start" />
							Lưu
						</Button>
					</div>
					<div className="rounded-lg border bg-card p-6 shadow-2xs">
						{sections.map(([section, items], sectionIdx) => (
							<div key={section}>
								{sectionIdx > 0 ? (
									<div className="my-6 flex items-center gap-3">
										<div className="h-px flex-1 bg-border" />
										<button
											type="button"
											aria-label="Thêm nhóm trường"
											className="flex size-6 items-center justify-center rounded-sm border bg-background text-muted-foreground hover:border-primary hover:text-primary"
										>
											<Icon icon={Add} className="size-3.5" />
										</button>
										<div className="h-px flex-1 bg-border" />
									</div>
								) : null}
								<section className="mb-4">
									<div className="mb-4 flex items-center justify-between">
										<h2 className="font-semibold text-[#1677ff] text-sm">
											{section}
										</h2>
										<span className="cursor-pointer font-medium text-[#1677ff] text-xs hover:underline">
											Chuyển đến trước ▾
										</span>
									</div>
									<div className="grid gap-x-10 gap-y-5 md:grid-cols-2">
										{items.map((field) => (
											<div key={field.key} className="flex items-start gap-3">
												<Icon
													icon={Draggable}
													className="mt-7 size-4 shrink-0 cursor-grab text-muted-foreground/70"
												/>
												<Field className="flex-1">
													<FieldLabel
														htmlFor={`field-${field.key}`}
														className="gap-1 font-medium text-xs"
													>
														{field.required ? (
															<span className="text-destructive">*</span>
														) : null}
														{field.label}
														{field.locked ? (
															<Icon
																icon={Locked}
																className="size-3 text-muted-foreground"
															/>
														) : null}
													</FieldLabel>
													<FieldInput field={field} />
												</Field>
											</div>
										))}
									</div>
								</section>
							</div>
						))}
					</div>
				</div>
				<aside className="rounded-lg border bg-card shadow-2xs">
					<div className="border-b px-4 pt-3">
						<span className="inline-block border-[#1677ff] border-b-2 pb-2.5 font-semibold text-[#1677ff] text-sm">
							Thêm trường
						</span>
					</div>
					<ul className="divide-y">
						{FIELD_TYPES.map((item) => (
							<li key={item.type}>
								<button
									type="button"
									className="flex w-full items-center gap-3.5 px-4 py-3 text-left text-sm transition-colors hover:bg-accent/40"
								>
									<span
										className={`flex size-9 shrink-0 items-center justify-center rounded-lg font-semibold text-white text-xs shadow-2xs ${item.tone}`}
									>
										{FIELD_ICON_SYMBOL[item.type] ?? item.label.charAt(0)}
									</span>
									<span className="font-medium text-foreground">
										{item.label}
									</span>
								</button>
							</li>
						))}
					</ul>
				</aside>
			</div>
		</SettingsFrame>
	);
}
