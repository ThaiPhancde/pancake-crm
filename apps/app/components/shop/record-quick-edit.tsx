"use client";

import { Badge } from "@crm/ui/components/badge";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { FieldOption } from "./collections";

const UNASSIGNED = "none";

export function RecordQuickEdit({
	kind,
	field,
	id,
	shopId,
	value,
	options,
	disabled = false,
	placeholder,
}: {
	kind: "lead" | "appointment" | "ticket";
	field: "status" | "assigneeId";
	id: string;
	shopId: string;
	value: string | null;
	options: FieldOption[];
	disabled?: boolean;
	placeholder?: string;
}) {
	const api = useTRPC();
	const router = useRouter();
	const handlers = {
		onSuccess: () => {
			toast.success("Đã cập nhật");
			router.refresh();
		},
		onError: () => toast.error("Không thể cập nhật. Vui lòng thử lại."),
	};
	const lead = useMutation(api.pancake.updateLead.mutationOptions(handlers));
	const appointment = useMutation(
		api.pancake.updateAppointment.mutationOptions(handlers),
	);
	const ticket = useMutation(
		api.pancake.updateTicket.mutationOptions(handlers),
	);
	const mutation = { lead, appointment, ticket }[kind];
	const choices =
		field === "assigneeId"
			? [{ value: UNASSIGNED, label: "Chưa phân công" }, ...options]
			: options;
	const current = value ?? (field === "assigneeId" ? UNASSIGNED : "");

	function change(next: string) {
		if (next === current) return;
		const patch =
			field === "status"
				? { id, shopId, status: next }
				: { id, shopId, assigneeId: next === UNASSIGNED ? null : next };
		if (kind === "lead") lead.mutate(patch);
		else if (kind === "appointment") appointment.mutate(patch);
		else ticket.mutate(patch);
	}

	return (
		<Select
			value={current}
			onValueChange={change}
			disabled={disabled || mutation.isPending}
		>
			<SelectTrigger
				size="sm"
				aria-label={field === "status" ? "Đổi trạng thái" : "Đổi phân công"}
				onClick={(event) => event.stopPropagation()}
			>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					{choices.map((option) => (
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
