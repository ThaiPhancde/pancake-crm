"use client";

import { Button } from "@crm/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

export function ConvertLeadButton({
	shopId,
	id,
	converted,
	canWrite,
}: {
	shopId: string;
	id: string;
	converted: boolean;
	canWrite: boolean;
}) {
	const api = useTRPC();
	const router = useRouter();
	const mutation = useMutation(
		api.pancake.convertLead.mutationOptions({
			onSuccess: () => {
				toast.success("Đã chuyển đổi thành liên hệ");
				router.refresh();
			},
			onError: () => toast.error("Không thể chuyển đổi. Vui lòng thử lại."),
		}),
	);
	const reason = converted
		? "Tiềm năng này đã được chuyển đổi"
		: canWrite
			? undefined
			: "Bạn không có quyền chỉnh sửa tiềm năng này";
	return (
		<span title={reason} className="w-fit">
			<Button
				disabled={Boolean(reason) || mutation.isPending}
				onClick={() => mutation.mutate({ shopId, id })}
			>
				{converted
					? "Đã chuyển đổi"
					: mutation.isPending
						? "Đang chuyển đổi…"
						: "Chuyển đổi thành liên hệ"}
			</Button>
		</span>
	);
}
