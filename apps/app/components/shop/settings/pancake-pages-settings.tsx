"use client";

import Key from "@carbon/icons-react/es/Key";
import Renew from "@carbon/icons-react/es/Renew";
import Search from "@carbon/icons-react/es/Search";
import WarningAlt from "@carbon/icons-react/es/WarningAlt";
import { Avatar, AvatarFallback, AvatarImage } from "@crm/ui/components/avatar";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { cn } from "@crm/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "api/app-router";
import { useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/components/pancake/format";
import { initials } from "@/lib/initials";
import { useTRPC } from "@/lib/trpc/client";

type FilterKind = "all" | "matching_shop" | "has_token" | "missing_token";

type TokenDialogTarget = {
	pageId: string;
	name: string;
	roleInPage: string | null;
	tokenMasked: string | null;
	tokenStatus: string;
	tokenReason: string | null;
};

function makeClient() {
	return createTRPCClient<AppRouter>({
		links: [httpBatchLink({ url: "/api/trpc" })],
	});
}

function tokenStatusBadge(status: string) {
	if (status === "active") {
		return { label: "Đã có token", variant: "green" as const };
	}
	if (status === "invalid") {
		return { label: "Lỗi giải mã token", variant: "red" as const };
	}
	if (status === "expired" || status === "revoked") {
		return { label: "Token hết hạn / thu hồi", variant: "red" as const };
	}
	if (status === "permission_denied") {
		return { label: "Thiếu quyền Page", variant: "orange" as const };
	}
	return { label: "Chưa có token", variant: "gray" as const };
}

export function PancakePagesSettings({
	shopId,
	shopName,
}: {
	shopId: string;
	shopName: string;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<FilterKind>("all");
	const [pageIndex, setPageIndex] = useState(1);
	const [userTokenInput, setUserTokenInput] = useState("");
	const [busyAction, setBusyAction] = useState<string | null>(null);
	const [tokenModal, setTokenModal] = useState<TokenDialogTarget | null>(null);
	const [manualPat, setManualPat] = useState("");
	const [confirmReplaceChecked, setConfirmReplaceChecked] = useState(false);

	const pagesQuery = useQuery(
		trpc.pancakeSettings.pages.queryOptions({
			shopId,
			q: search,
			filter,
		}),
	);

	const data = pagesQuery.data;
	const allFilteredPages = data?.pages ?? [];
	const pageSize = 50;
	const totalPages = Math.max(1, Math.ceil(allFilteredPages.length / pageSize));
	const safePageIndex = Math.min(pageIndex, totalPages);
	const visiblePages = allFilteredPages.slice(
		(safePageIndex - 1) * pageSize,
		safePageIndex * pageSize,
	);

	async function refreshPages() {
		await queryClient.invalidateQueries({
			queryKey: trpc.pancakeSettings.pages.queryKey({
				shopId,
				q: search,
				filter,
			}),
		});
		await pagesQuery.refetch();
	}

	async function handleConnectDiscover(e: React.FormEvent) {
		e.preventDefault();
		setBusyAction("discover");
		try {
			const client = makeClient();
			const res = await client.pancakeSettings.connectPagesAccount.mutate({
				shopId,
				userAccessToken: userTokenInput.trim() || undefined,
			});
			setUserTokenInput("");
			toast.success(
				`Đã tải ${res.discoveredCount} Page từ Pancake (${res.existingTokensSaved} Page có sẵn token).`,
			);
			await refreshPages();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể kết nối Pancake User Access Token.",
			);
		} finally {
			setBusyAction(null);
		}
	}

	async function handleSaveManualToken() {
		if (!tokenModal || !manualPat.trim() || !confirmReplaceChecked) return;
		setBusyAction("manualToken");
		try {
			const client = makeClient();
			const res = await client.pancakeSettings.setPageManualToken.mutate({
				shopId,
				pageId: tokenModal.pageId,
				pageAccessToken: manualPat.trim(),
				confirmReplace: true,
			});
			toast.success(
				`Đã lưu Page Access Token (${res.tokenMasked}) cho Page ${tokenModal.name}.`,
			);
			setTokenModal(null);
			setManualPat("");
			setConfirmReplaceChecked(false);
			await refreshPages();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể lưu Page Access Token.",
			);
		} finally {
			setBusyAction(null);
		}
	}

	async function handleConfirmGenerateToken() {
		if (!tokenModal || !confirmReplaceChecked) return;
		setBusyAction("generateToken");
		try {
			const client = makeClient();
			const res = await client.pancakeSettings.confirmGeneratePageToken.mutate({
				shopId,
				pageId: tokenModal.pageId,
				confirmReplace: true,
			});
			toast.success(
				`Đã tạo và mã hóa Page Access Token (${res.tokenMasked}) cho Page ${tokenModal.name}.`,
			);
			setTokenModal(null);
			setManualPat("");
			setConfirmReplaceChecked(false);
			await refreshPages();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể tạo Page Access Token từ Pancake.",
			);
		} finally {
			setBusyAction(null);
		}
	}

	const filterTabs: { value: FilterKind; label: string; count?: number }[] = [
		{ value: "all", label: "Tất cả", count: data?.summary.total },
		{
			value: "matching_shop",
			label: `Khớp mã shop (${shopId})`,
			count: data?.summary.matchingShop,
		},
		{
			value: "has_token",
			label: "Đã có token",
			count: data?.summary.activeToken,
		},
		{
			value: "missing_token",
			label: "Thiếu quyền / token",
			count: data?.summary.missingToken,
		},
	];

	return (
		<div className="flex flex-col gap-5">
			<div className="rounded-lg border bg-card p-4 shadow-2xs">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<div className="flex flex-wrap items-center gap-2">
							<h2 className="font-semibold text-sm">
								Kết nối Pancake Pages & Hội thoại ({shopName})
							</h2>
							{data?.connection.status === "active" ? (
								<Badge variant="green">Đã kết nối User Token</Badge>
							) : data?.connection.status === "env_ready" ? (
								<Badge variant="soft-green">Sẵn sàng từ biến môi trường</Badge>
							) : data?.connection.status === "expired" ||
								data?.connection.status === "invalid" ? (
								<Badge variant="red">Token hết hạn / không hợp lệ</Badge>
							) : (
								<Badge variant="gray">Chưa kết nối</Badge>
							)}
						</div>
						<p className="mt-1 text-muted-foreground text-xs">
							Tải danh sách Page từ Pancake User Access Token và giữ Page Access
							Token hiện có. Hội thoại không được import vào CRM: tab Hội thoại
							của liên hệ tải trực tiếp từ Pancake khi mở.
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-2 text-xs">
						{data?.connection.tokenMasked ? (
							<span className="rounded border bg-muted/40 px-2.5 py-1 font-mono">
								User Token: {data.connection.tokenMasked}
							</span>
						) : null}
						{data?.connection.lastVerifiedAt ? (
							<span className="text-muted-foreground">
								Xác minh: {formatDate(data.connection.lastVerifiedAt)}
							</span>
						) : null}
					</div>
				</div>

				{data?.connection.lastError ? (
					<div className="mt-3 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-xs">
						<Icon icon={WarningAlt} className="size-4 shrink-0" />
						<span>
							Lỗi xác thực User Token: {data.connection.lastError}. Vui lòng cập
							nhật lại User Access Token (hệ thống đã dừng thử lại tự động).
						</span>
					</div>
				) : null}

				<form
					onSubmit={handleConnectDiscover}
					className="mt-4 flex flex-col gap-3 border-t pt-4"
				>
					<div className="grid gap-3 md:grid-cols-[1fr_auto]">
						<Input
							type="password"
							value={userTokenInput}
							onChange={(e) => setUserTokenInput(e.target.value)}
							placeholder={
								data?.connection.hasEnvToken || data?.connection.connected
									? "Nhập Pancake User Access Token mới (hoặc để trống để dùng token đã cấu hình)..."
									: "Nhập Pancake User Access Token (từ pages.fm)..."
							}
							className="text-xs"
						/>
						<Button
							type="submit"
							size="sm"
							disabled={busyAction !== null || !data?.canManage}
						>
							<Icon icon={Renew} data-icon="inline-start" />
							{busyAction === "discover"
								? "Đang tải danh sách Page..."
								: "Kết nối & Tải danh sách Page"}
						</Button>
					</div>
				</form>
			</div>

			<div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-2xs">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap gap-1.5">
						{filterTabs.map((item) => (
							<button
								key={item.value}
								type="button"
								onClick={() => {
									setFilter(item.value);
									setPageIndex(1);
								}}
								className={cn(
									"inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-medium text-xs transition-colors",
									filter === item.value
										? "border-[#1677ff] bg-[#f0f7ff] text-[#1677ff]"
										: "border-transparent bg-muted/50 text-muted-foreground hover:text-foreground",
								)}
							>
								<span>{item.label}</span>
								{item.count !== undefined ? (
									<span className="rounded-full bg-background px-1.5 py-0.2 text-[10px] tabular-nums">
										{item.count}
									</span>
								) : null}
							</button>
						))}
					</div>

					<div className="relative min-w-64 flex-1 sm:max-w-xs">
						<Icon
							icon={Search}
							className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							value={search}
							onChange={(e) => {
								setSearch(e.target.value);
								setPageIndex(1);
							}}
							placeholder="Tìm theo tên Page, ID Page, username..."
							className="pl-8 text-xs"
						/>
					</div>
				</div>

				{pagesQuery.isLoading ? (
					<div className="py-12 text-center text-muted-foreground text-xs">
						Đang tải danh sách Page Pancake...
					</div>
				) : pagesQuery.isError ? (
					<div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-destructive text-xs">
						Không tải được danh sách Page: {pagesQuery.error.message}
					</div>
				) : allFilteredPages.length === 0 ? (
					<div className="rounded-md border border-dashed py-10 text-center text-muted-foreground text-xs">
						Chưa có Page nào khớp bộ lọc. Hãy bấm &ldquo;Kết nối & Tải danh sách
						Page&rdquo; ở trên để lấy Page từ tài khoản Pancake.
					</div>
				) : (
					<div className="overflow-x-auto rounded-md border">
						<table className="w-full text-left text-xs">
							<thead>
								<tr className="border-b bg-muted/50 text-muted-foreground">
									<th className="p-2.5 font-semibold">Page</th>
									<th className="p-2.5 font-semibold">Quyền & Token</th>
									<th className="p-2.5 text-right font-semibold">Thao tác</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{visiblePages.map((page) => {
									const tokBadge = tokenStatusBadge(page.tokenStatus);
									return (
										<tr key={page.pageId} className="hover:bg-accent/20">
											<td className="p-2.5 align-top">
												<div className="flex items-start gap-2.5">
													<Avatar className="size-8 shrink-0">
														{page.avatarUrl ? (
															<AvatarImage
																src={page.avatarUrl}
																alt={page.name}
															/>
														) : null}
														<AvatarFallback>
															{initials(page.name)}
														</AvatarFallback>
													</Avatar>
													<div className="min-w-0">
														<div className="flex flex-wrap items-center gap-1.5">
															<span className="font-semibold text-foreground">
																{page.name}
															</span>
															{page.matchesShop ? (
																<Badge variant="soft-green">
																	Khớp shop {shopId}
																</Badge>
															) : page.sourceShopId ? (
																<Badge variant="secondary">
																	Shop #{page.sourceShopId}
																</Badge>
															) : null}
														</div>
														<div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
															ID: {page.pageId} · {page.platform}
															{page.roleInPage
																? ` · Quyền: ${page.roleInPage}`
																: ""}
														</div>
													</div>
												</div>
											</td>
											<td className="max-w-xs p-2.5 align-top">
												<div className="flex flex-wrap items-center gap-1.5">
													<Badge variant={tokBadge.variant}>
														{tokBadge.label}
													</Badge>
													{page.tokenMasked ? (
														<span className="font-mono text-[11px] text-muted-foreground">
															{page.tokenMasked}
														</span>
													) : null}
												</div>
												{page.tokenReason ? (
													<p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
														{page.tokenReason}
													</p>
												) : null}
											</td>
											<td className="p-2.5 text-right align-top">
												<div className="flex justify-end gap-1.5">
													<Button
														type="button"
														variant="outline"
														size="xs"
														disabled={!data?.canManage || busyAction !== null}
														onClick={() => {
															setTokenModal({
																pageId: page.pageId,
																name: page.name,
																roleInPage: page.roleInPage,
																tokenMasked: page.tokenMasked,
																tokenStatus: page.tokenStatus,
																tokenReason: page.tokenReason,
															});
															setManualPat("");
															setConfirmReplaceChecked(false);
														}}
													>
														<Icon icon={Key} data-icon="inline-start" />
														Token
													</Button>
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}

				{allFilteredPages.length > pageSize ? (
					<div className="flex items-center justify-between pt-2 text-xs">
						<span className="text-muted-foreground">
							Hiển thị {(safePageIndex - 1) * pageSize + 1}–
							{Math.min(safePageIndex * pageSize, allFilteredPages.length)} trên{" "}
							{allFilteredPages.length} Page
						</span>
						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="outline"
								size="xs"
								disabled={safePageIndex <= 1}
								onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
							>
								Trang trước
							</Button>
							<span className="tabular-nums">
								Trang {safePageIndex} / {totalPages}
							</span>
							<Button
								type="button"
								variant="outline"
								size="xs"
								disabled={safePageIndex >= totalPages}
								onClick={() => setPageIndex((p) => Math.min(totalPages, p + 1))}
							>
								Trang sau
							</Button>
						</div>
					</div>
				) : null}
			</div>

			<Dialog
				open={tokenModal !== null}
				onOpenChange={(open) => {
					if (!open) {
						setTokenModal(null);
						setManualPat("");
						setConfirmReplaceChecked(false);
					}
				}}
			>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle className="text-base">
							Quản lý Page Access Token · {tokenModal?.name}
						</DialogTitle>
						<DialogDescription className="text-xs">
							Mã Page: <code className="font-mono">{tokenModal?.pageId}</code>
							{tokenModal?.roleInPage
								? ` · Quyền tài khoản: ${tokenModal.roleInPage}`
								: ""}
							{tokenModal?.tokenMasked
								? ` · Token hiện tại: ${tokenModal.tokenMasked}`
								: ""}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-2 text-xs">
						{tokenModal?.tokenReason ? (
							<div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-300">
								{tokenModal.tokenReason}
							</div>
						) : null}

						<div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-muted-foreground">
							<strong className="text-foreground">Lưu ý an toàn:</strong> Việc
							tạo mới Page Access Token từ Pancake API có thể làm vô hiệu hóa
							token cũ đang được hệ thống khác sử dụng. Hãy ưu tiên nhập token
							hiện có nếu Page đã được cấp token ở hệ thống khác.
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="manual-pat-input"
								className="font-medium text-foreground"
							>
								Cách 1 (Khuyên dùng): Nhập Page Access Token hiện có
							</label>
							<Input
								id="manual-pat-input"
								type="password"
								value={manualPat}
								onChange={(e) => setManualPat(e.target.value)}
								placeholder="Dán Page Access Token hiện có của Page này..."
								className="text-xs"
							/>
						</div>

						<label
							htmlFor="confirm-replace-token"
							className="flex cursor-pointer items-start gap-2 pt-1"
						>
							<Checkbox
								id="confirm-replace-token"
								checked={confirmReplaceChecked}
								onCheckedChange={(v) => setConfirmReplaceChecked(Boolean(v))}
							/>
							<span>
								Tôi xác nhận muốn tạo hoặc thay thế Page Access Token cho Page{" "}
								<strong>{tokenModal?.name}</strong> và hiểu tác động tới các hệ
								thống dùng chung token.
							</span>
						</label>
					</div>

					<DialogFooter className="flex flex-wrap justify-between gap-2 sm:justify-between">
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={
								!confirmReplaceChecked ||
								busyAction !== null ||
								(Boolean(tokenModal?.roleInPage) &&
									tokenModal?.roleInPage !== "ADMINISTER")
							}
							onClick={handleConfirmGenerateToken}
						>
							{busyAction === "generateToken"
								? "Đang tạo token..."
								: "Tạo mới Token từ Pancake API"}
						</Button>
						<div className="flex gap-2">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setTokenModal(null)}
							>
								Hủy
							</Button>
							<Button
								type="button"
								size="sm"
								disabled={
									!confirmReplaceChecked ||
									!manualPat.trim() ||
									busyAction !== null
								}
								onClick={handleSaveManualToken}
							>
								{busyAction === "manualToken"
									? "Đang lưu..."
									: "Lưu Token đã nhập"}
							</Button>
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
