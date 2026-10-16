"use client";

import Add from "@carbon/icons-react/es/Add";
import ChevronDown from "@carbon/icons-react/es/ChevronDown";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@crm/ui/components/sheet";
import { Switch } from "@crm/ui/components/switch";
import { Textarea } from "@crm/ui/components/textarea";
import { cn } from "@crm/ui/lib/utils";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { NotConnectedError, submitRecord } from "./actions";
import {
	COLLECTIONS,
	type CollectionKey,
	type FieldDef,
	type FieldOption,
	fieldSections,
} from "./collections";

export type RelationOptions = Partial<
	Record<NonNullable<FieldDef["relation"]>, FieldOption[]>
>;

export function FieldInput({
	field,
	users = [],
	relations = {},
	defaultValue,
}: {
	field: FieldDef;
	users?: FieldOption[];
	relations?: RelationOptions;
	defaultValue?: string;
}) {
	const id = `field-${field.key}`;
	const placeholder =
		field.placeholder ??
		(field.type === "select" ||
		field.type === "multiselect" ||
		field.type === "user" ||
		field.type === "relation"
			? `Chọn ${field.label.toLowerCase()}`
			: `Nhập ${field.label.toLowerCase()}`);
	switch (field.type) {
		case "textarea":
			return (
				<Textarea
					id={id}
					name={field.key}
					placeholder={placeholder}
					defaultValue={defaultValue}
					rows={4}
				/>
			);
		case "date":
			return (
				<Input
					id={id}
					name={field.key}
					type="date"
					defaultValue={defaultValue}
				/>
			);
		case "datetime":
			return (
				<Input
					id={id}
					name={field.key}
					type="datetime-local"
					defaultValue={defaultValue}
				/>
			);
		case "boolean":
			return (
				<div className="flex h-8 items-center">
					<Switch id={id} name={field.key} />
				</div>
			);
		case "number":
		case "money":
			return (
				<Input
					id={id}
					name={field.key}
					type="number"
					inputMode="decimal"
					placeholder={placeholder}
					defaultValue={defaultValue}
				/>
			);
		case "phone":
			return (
				<Input
					id={id}
					name={field.key}
					type="tel"
					placeholder={placeholder}
					defaultValue={defaultValue}
				/>
			);
		case "email":
			return (
				<Input
					id={id}
					name={field.key}
					type="email"
					placeholder={placeholder}
					defaultValue={defaultValue}
				/>
			);
		case "url":
			return (
				<Input
					id={id}
					name={field.key}
					type="url"
					placeholder={placeholder}
					defaultValue={defaultValue}
				/>
			);
		case "select":
		case "user":
		case "relation":
		case "multiselect": {
			const options =
				field.type === "user"
					? users
					: field.type === "relation"
						? (relations[field.relation ?? "contact"] ?? [])
						: (field.options ?? []);
			if (options.length === 0)
				return (
					<Input
						id={id}
						name={field.key}
						placeholder={placeholder}
						defaultValue={defaultValue}
						disabled={field.type === "relation" || field.type === "user"}
					/>
				);
			return (
				<Select name={field.key} defaultValue={defaultValue}>
					<SelectTrigger id={id}>
						<SelectValue placeholder={placeholder} />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							{options.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.color ? (
										<Badge variant={option.color}>{option.label}</Badge>
									) : (
										option.label
									)}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			);
		}
		default:
			return (
				<Input
					id={id}
					name={field.key}
					placeholder={placeholder}
					defaultValue={defaultValue}
					readOnly={field.type === "formula"}
				/>
			);
	}
}

export function RecordForm({
	collection,
	users,
	relations,
	defaults = {},
	onDone,
	submitLabel = "Lưu",
	twoColumns = true,
}: {
	collection: CollectionKey;
	users?: FieldOption[];
	relations?: RelationOptions;
	defaults?: Record<string, string>;
	onDone?: () => void;
	submitLabel?: string;
	twoColumns?: boolean;
}) {
	const definition = COLLECTIONS[collection];
	const params = useParams<{ shopId?: string }>();
	const router = useRouter();
	const [pending, setPending] = useState(false);
	const fields = definition.fields.filter(
		(field) => field.type !== "formula" && !field.hidden,
	);
	async function submit(form: HTMLFormElement, reset: boolean) {
		setPending(true);
		try {
			await submitRecord(
				collection,
				Object.fromEntries(new FormData(form).entries()),
				params?.shopId,
			);
			toast.success(`Đã lưu ${definition.title.toLowerCase()}.`);
			router.refresh();
			if (reset) form.reset();
			else onDone?.();
		} catch (error) {
			toast.error(
				error instanceof NotConnectedError
					? `Biểu mẫu ${definition.title.toLowerCase()} đồng bộ một chiều từ Pancake POS.`
					: "Không lưu được. Thử lại sau.",
			);
		} finally {
			setPending(false);
		}
	}
	return (
		<form
			className="flex min-h-0 flex-1 flex-col"
			onSubmit={(event) => {
				event.preventDefault();
				void submit(event.currentTarget, false);
			}}
		>
			<div className="min-h-0 flex-1 overflow-y-auto">
				{fieldSections(fields).map(([section, items]) => (
					<section key={section}>
						<h3 className="bg-muted px-5 py-2.5 font-semibold text-sm">
							{section}
						</h3>
						<div
							className={cn(
								"grid gap-x-6 gap-y-4 px-5 py-4",
								twoColumns && "md:grid-cols-2",
							)}
						>
							{items.map((field) => (
								<Field
									key={field.key}
									className={cn(field.wide && twoColumns && "md:col-span-2")}
								>
									<FieldLabel htmlFor={`field-${field.key}`}>
										{field.label}
										{field.required ? (
											<span className="text-destructive">*</span>
										) : null}
									</FieldLabel>
									<FieldInput
										field={field}
										users={users}
										relations={relations}
										defaultValue={defaults[field.key]}
									/>
								</Field>
							))}
						</div>
					</section>
				))}
			</div>
			<div className="flex items-center justify-end gap-2 border-t px-5 py-3">
				<Button
					type="button"
					variant="outline"
					disabled={pending}
					onClick={(event) => {
						const form = event.currentTarget.form;
						if (form?.reportValidity()) void submit(form, true);
					}}
				>
					Lưu & Mới
				</Button>
				<Button type="submit" disabled={pending}>
					{pending ? "Đang lưu…" : submitLabel}
				</Button>
			</div>
		</form>
	);
}

export function CreateRecordButton({
	collection,
	label = "Thêm mới",
	users,
	relations,
	defaults,
	size = "lg",
	menu,
}: {
	collection: CollectionKey;
	label?: string;
	users?: FieldOption[];
	relations?: RelationOptions;
	defaults?: Record<string, string>;
	size?: "lg" | "md";
	menu?: { label: string; onSelect?: () => void }[];
}) {
	const [open, setOpen] = useState(false);
	const definition = COLLECTIONS[collection];
	return (
		<>
			<div className="inline-flex">
				<Button
					onClick={() => setOpen(true)}
					className={cn(menu && "rounded-r-none")}
				>
					<Icon icon={Add} data-icon="inline-start" />
					{label}
				</Button>
				{menu ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								size="icon"
								aria-label="Thêm tuỳ chọn"
								className="rounded-l-none border-l border-l-white/30"
							>
								<Icon icon={ChevronDown} />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{menu.map((item) => (
								<DropdownMenuItem key={item.label} onSelect={item.onSelect}>
									{item.label}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}
			</div>
			<Sheet open={open} onOpenChange={setOpen}>
				<SheetContent
					side="right"
					size={size === "lg" ? "lg" : "md"}
					className="gap-0 p-0"
				>
					<SheetHeader className="border-b px-5 py-4">
						<SheetTitle className="text-base">
							{definition.createLabel}
						</SheetTitle>
					</SheetHeader>
					<RecordForm
						collection={collection}
						users={users}
						relations={relations}
						defaults={defaults}
						twoColumns={size === "lg"}
						onDone={() => setOpen(false)}
					/>
				</SheetContent>
			</Sheet>
		</>
	);
}
