"use client";

import { Button } from "@crm/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

export function SyncToggle({
	shopId,
	enabled,
}: {
	shopId: string;
	enabled: boolean;
}) {
	const api = useTRPC();
	const router = useRouter();
	const handlers = (message: string) => ({
		onSuccess: () => {
			toast.success(message);
			router.refresh();
		},
		onError: () =>
			toast.error(
				"Không thể thay đổi. Chỉ chủ sở hữu hoặc quản trị viên workspace được phép.",
			),
	});
	const pause = useMutation(
		api.pancake.pause.mutationOptions(handlers("Đã tạm dừng đồng bộ")),
	);
	const resume = useMutation(
		api.pancake.resume.mutationOptions(handlers("Đã tiếp tục đồng bộ")),
	);
	const pending = pause.isPending || resume.isPending;
	return enabled ? (
		<Button
			variant="outline"
			disabled={pending}
			onClick={() => pause.mutate({ shopId })}
		>
			{pause.isPending ? "Đang tạm dừng…" : "Tạm dừng đồng bộ"}
		</Button>
	) : (
		<Button disabled={pending} onClick={() => resume.mutate({ shopId })}>
			{resume.isPending ? "Đang tiếp tục…" : "Tiếp tục đồng bộ"}
		</Button>
	);
}
