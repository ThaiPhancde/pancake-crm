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
import { LIST_CONFIG } from "./lists/config";

export type RelationOptions = Partial<
	Record<NonNullable<FieldDef["relation"]>, FieldOption[]>
>;

export function FieldInput({
	field,
	users = [],
	relations = {},
	defaultValue,
	locked,
}: {
	field: FieldDef;
	users?: FieldOption[];
	relations?: RelationOptions;
	defaultValue?: string;
	locked?: FieldOption;
}) {
	const id = `field-${field.key}`;
	if (locked)
		return (
			<>
				<Input id={id} value={locked.label} disabled />
				<input type="hidden" name={field.key} value={locked.value} />
			</>
		);
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

type RecordFormProps = {
	collection: CollectionKey;
	users?: FieldOption[];
	relations?: RelationOptions;
	defaults?: Record<string, string>;
	locked?: Record<string, FieldOption>;
	hidden?: Record<string, string>;
	onDone?: () => void;
	submitLabel?: string;
	twoColumns?: boolean;
};

export function RecordForm({
	collection,
	users,
	relations,
	defaults = {},
	locked = {},
	hidden = {},
	onDone,
	submitLabel = "Lưu",
	twoColumns = true,
}: RecordFormProps) {
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
										locked={locked[field.key]}
									/>
								</Field>
							))}
						</div>
					</section>
				))}
			</div>
			{Object.entries(hidden).map(([name, value]) => (
				<input key={name} type="hidden" name={name} value={value} />
			))}
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
	disabledReason,
}: {
	collection: CollectionKey;
	label?: string;
	users?: FieldOption[];
	relations?: RelationOptions;
	defaults?: Record<string, string>;
	size?: "lg" | "md";
	menu?: { label: string; onSelect?: () => void }[];
	disabledReason?: string;
}) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<div className="inline-flex" title={disabledReason}>
				<Button
					onClick={() => setOpen(true)}
					disabled={Boolean(disabledReason)}
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
								<div
									key={item.label}
									title={item.onSelect ? undefined : LIST_CONFIG.oneWayReason}
								>
									<DropdownMenuItem
										disabled={!item.onSelect}
										onSelect={item.onSelect}
									>
										{item.label}
									</DropdownMenuItem>
								</div>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}
			</div>
			<RecordSheet
				collection={collection}
				open={open}
				onOpenChange={setOpen}
				size={size}
				users={users}
				relations={relations}
				defaults={defaults}
			/>
		</>
	);
}

export function RecordSheet({
	open,
	onOpenChange,
	size = "lg",
	...form
}: Omit<RecordFormProps, "onDone" | "twoColumns"> & {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	size?: "lg" | "md";
}) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" size={size} className="gap-0 p-0">
				<SheetHeader className="border-b px-5 py-4">
					<SheetTitle className="text-base">
						{COLLECTIONS[form.collection].createLabel}
					</SheetTitle>
				</SheetHeader>
				<RecordForm
					{...form}
					twoColumns={size === "lg"}
					onDone={() => onOpenChange(false)}
				/>
			</SheetContent>
		</Sheet>
	);
}
