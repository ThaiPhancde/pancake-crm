"use client";

import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { formatAmount } from "@/components/pancake/format";
import { useTRPC } from "@/lib/trpc/client";
import { REPORTS } from "./config";

const AMOUNT = /^\d{1,18}$/;

export function RevenueTarget({
	shopId,
	month,
	monthLabel,
	currency,
	target,
	booked,
	canManage,
}: {
	shopId: string;
	month: string;
	monthLabel: string;
	currency: string;
	target: string | null;
	booked: string;
	canManage: boolean;
}) {
	const api = useTRPC();
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const initial = target?.split(".")[0] ?? "";
	const [amount, setAmount] = useState(initial);
	const save = useMutation(
		api.pancakeSettings.setRevenueTarget.mutationOptions({
			onSuccess: () => {
				setOpen(false);
				toast.success("Đã lưu mục tiêu doanh thu");
				router.refresh();
			},
			onError: () => toast.error("Không thể lưu mục tiêu. Vui lòng thử lại."),
		}),
	);
	const goal = Number(target ?? 0);
	const progress = goal
		? Math.min(
				REPORTS.targetProgressMax,
				Math.round((REPORTS.percentScale * Number(booked)) / goal),
			)
		: 0;
	const cleaned = amount.replace(/[\s.,]/g, "");
	const valid = cleaned === "" || AMOUNT.test(cleaned);

	return (
		<div className="flex flex-col gap-3">
			{target ? (
				<div className="flex flex-col gap-2">
					<div className="flex items-baseline justify-between gap-3 text-xs">
						<span className="font-semibold text-base tabular-nums">
							{formatAmount(booked, currency)}
						</span>
						<span className="text-muted-foreground tabular-nums">
							Mục tiêu {monthLabel}: {formatAmount(target, currency)}
						</span>
					</div>
					<div
						className="h-2 overflow-hidden rounded-full bg-muted"
						role="progressbar"
						aria-valuenow={progress}
						aria-valuemin={0}
						aria-valuemax={REPORTS.targetProgressMax}
						aria-label="Tiến độ mục tiêu doanh thu"
					>
						<div
							className="h-full rounded-full bg-primary"
							style={{ width: `${progress}%` }}
						/>
					</div>
					<span className="text-muted-foreground text-xs">
						Đạt {progress}% · doanh thu chốt (không gồm đơn hủy, hoàn) trong
						tháng
					</span>
				</div>
			) : (
				<p className="text-muted-foreground text-xs">
					Chưa đặt mục tiêu cho {monthLabel}.
				</p>
			)}
			<div>
				<Button
					variant="link"
					size="sm"
					className="px-0"
					disabled={!canManage}
					title={canManage ? undefined : "Chỉ quản lý shop được đặt mục tiêu"}
					onClick={() => {
						setAmount(initial);
						setOpen(true);
					}}
				>
					Thiết lập mục tiêu
				</Button>
			</div>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							if (!valid) return;
							save.mutate({
								shopId,
								month,
								currency,
								amount: cleaned || null,
							});
						}}
					>
						<DialogHeader>
							<DialogTitle>Mục tiêu doanh thu {monthLabel}</DialogTitle>
							<DialogDescription>
								Nhập số tiền nguyên ({currency}). Để trống để xoá mục tiêu.
							</DialogDescription>
						</DialogHeader>
						<Field className="py-4">
							<FieldLabel htmlFor="revenue-target">Mục tiêu</FieldLabel>
							<Input
								id="revenue-target"
								inputMode="decimal"
								value={amount}
								onChange={(event) => setAmount(event.target.value)}
								aria-invalid={!valid}
								placeholder="Ví dụ: 500000000"
							/>
						</Field>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setOpen(false)}
							>
								Huỷ
							</Button>
							<Button type="submit" disabled={!valid || save.isPending}>
								Lưu
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
