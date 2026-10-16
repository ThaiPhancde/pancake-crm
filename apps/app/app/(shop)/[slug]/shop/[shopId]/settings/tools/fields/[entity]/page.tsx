import Close from "@carbon/icons-react/es/Close";
import Draggable from "@carbon/icons-react/es/Draggable";
import Locked from "@carbon/icons-react/es/Locked";
import View from "@carbon/icons-react/es/View";
import { Button } from "@crm/ui/components/button";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
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
	return (
		<SettingsFrame
			current={collection.title}
			trail={[{ label: "Bảng", href: `${ctx.base}/settings/tools` }]}
			className="bg-transparent"
		>
			<div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
				<div className="flex flex-col gap-3">
					<div className="flex items-center justify-center gap-2 rounded-lg bg-card py-2">
						<Button variant="outline" size="icon" aria-label="Xem trước">
							<Icon icon={View} />
						</Button>
						<Button variant="outline" disabled>
							<Icon icon={Close} data-icon="inline-start" />
							Bỏ thay đổi
						</Button>
						<Button variant="outline" disabled>
							✓ Lưu
						</Button>
					</div>
					<div className="rounded-lg bg-card p-5">
						{fieldSections(collection.fields).map(([section, items]) => (
							<section key={section} className="mb-6">
								<div className="mb-4 flex items-center justify-between">
									<h2 className="font-medium text-primary text-sm">
										{section}
									</h2>
									<span className="text-primary text-xs">
										Chuyển đến trước ▾
									</span>
								</div>
								<div className="grid gap-x-10 gap-y-5 md:grid-cols-2">
									{items.map((field) => (
										<div key={field.key} className="flex items-start gap-3">
											<Icon
												icon={Draggable}
												className="mt-6 size-4 shrink-0 text-muted-foreground"
											/>
											<Field className="flex-1">
												<FieldLabel
													htmlFor={`field-${field.key}`}
													className="gap-1"
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
													<span className="ml-auto rounded-sm bg-muted px-1 text-[10px] text-muted-foreground">
														{field.source === "pancake" ? "POS" : "CRM"}
													</span>
												</FieldLabel>
												<FieldInput field={field} />
											</Field>
										</div>
									))}
								</div>
							</section>
						))}
					</div>
				</div>
				<aside className="rounded-lg bg-card">
					<div className="border-b px-4 py-3">
						<span className="border-primary border-b-2 pb-2 font-medium text-primary text-sm">
							Thêm trường
						</span>
					</div>
					<ul className="divide-y">
						{FIELD_TYPES.map((item) => (
							<li key={item.type}>
								<button
									type="button"
									className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-accent/40"
								>
									<span
										className={`flex size-8 items-center justify-center rounded-md font-semibold text-white text-xs ${item.tone}`}
									>
										{item.label.charAt(0)}
									</span>
									<span className="font-medium">{item.label}</span>
								</button>
							</li>
						))}
					</ul>
				</aside>
			</div>
		</SettingsFrame>
	);
}
