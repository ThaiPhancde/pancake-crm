"use client";

import CheckmarkFilled from "@carbon/icons-react/es/CheckmarkFilled";
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

type FilterKind =
	| "all"
	| "assigned"
	| "matching_shop"
	| "has_token"
	| "missing_token"
	| "error";

type RangePreset = "7d" | "30d" | "90d" | "custom";

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
	if (status === "expired" || status === "revoked") {
		return { label: "Token hết hạn / thu hồi", variant: "red" as const };
	}
	if (status === "permission_denied") {
		return { label: "Thiếu quyền Page", variant: "orange" as const };
	}
	return { label: "Chưa có token", variant: "gray" as const };
}

function syncPhaseBadge(phase: string, syncEnabled: boolean, tokenStatus: string) {
	if (tokenStatus === "expired" || tokenStatus === "revoked") {
		return { label: "Dừng: cần kết nối lại", variant: "red" as const };
	}
	if (phase === "paused_auth_error") {
		return { label: "Dừng do lỗi quyền/token", variant: "red" as const };
	}
	if (!syncEnabled) {
		return { label: "Tắt đồng bộ", variant: "gray" as const };
	}
	if (phase === "importing") {
		return { label: "Đang import theo đợt", variant: "blue" as const };
	}
	if (phase === "incremental") {
		return { label: "Đồng bộ gia tăng", variant: "soft-green" as const };
	}
	return { label: "Chờ chạy", variant: "secondary" as const };
}

function computeRangeDates(
	preset: RangePreset,
	customFrom: string,
	customUntil: string,
) {
	const now = new Date();
	if (preset === "7d") {
		const from = new Date(now.getTime() - 7 * 86_400_000);
		return { importFrom: from.toISOString(), importUntil: now.toISOString() };
	}
	if (preset === "30d") {
		const from = new Date(now.getTime() - 30 * 86_400_000);
		return { importFrom: from.toISOString(), importUntil: now.toISOString() };
	}
	if (preset === "90d") {
		const from = new Date(now.getTime() - 90 * 86_400_000);
		return { importFrom: from.toISOString(), importUntil: now.toISOString() };
	}
	return {
		importFrom: customFrom ? new Date(customFrom).toISOString() : null,
		importUntil: customUntil ? new Date(customUntil).toISOString() : null,
	};
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
	const [autoAssignMatching, setAutoAssignMatching] = useState(true);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [rangePreset, setRangePreset] = useState<RangePreset>("30d");
	const [customFrom, setCustomFrom] = useState("");
	const [customUntil, setCustomUntil] = useState("");
	const [busyAction, setBusyAction] = useState<string | null>(null);
	const [tokenModal, setTokenModal] = useState<TokenDialogTarget | null>(null);
	const [manualPat, setManualPat] = useState("");
	const [confirmReplaceChecked, setConfirmReplaceChecked] = useState(false);

	const pagesQuery = useQuery(
		trpc.pancakeSettings.pages.queryOptions(
			{
				shopId,
				q: search,
				filter,
			},
			{
				refetchInterval: 8_000,
			},
		),
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
	const selectedSet = new Set(selectedIds);

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
				autoAssignMatchingShop: autoAssignMatching,
			});
			setUserTokenInput("");
			toast.success(
				`Đã tải ${res.discoveredCount} Page từ Pancake (${res.existingTokensSaved} Page có sẵn token, gán tự động ${res.autoAssigned} Page).`,
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

	function togglePageSelection(pageId: string, checked: boolean) {
		setSelectedIds((prev) => {
			if (checked) {
				return prev.includes(pageId) ? prev : [...prev, pageId];
			}
			return prev.filter((id) => id !== pageId);
		});
	}

	function selectAllFiltered() {
		setSelectedIds(allFilteredPages.map((p) => p.pageId));
	}

	function selectMatchingShopPages() {
		setSelectedIds(
			allFilteredPages.filter((p) => p.matchesShop).map((p) => p.pageId),
		);
	}

	function clearSelection() {
		setSelectedIds([]);
	}

	async function handleBulkAssign(assigned: boolean) {
		if (selectedIds.length === 0) return;
		setBusyAction(assigned ? "assign" : "unassign");
		try {
			const range = computeRangeDates(rangePreset, customFrom, customUntil);
			const client = makeClient();
			const res = await client.pancakeSettings.bulkAssignPages.mutate({
				shopId,
				pageIds: selectedIds,
				assigned,
				syncEnabled: assigned ? true : false,
				importFrom: assigned ? range.importFrom : undefined,
				importUntil: assigned ? range.importUntil : undefined,
			});
			if (assigned) {
				toast.success(
					`Đã gán ${res.updatedCount} Page vào shop (${res.activeSyncCount} Page bật đồng bộ, ${res.missingTokenCount} Page chờ cấp token).`,
				);
			} else {
				toast.success(`Đã bỏ gán ${res.updatedCount} Page khỏi shop.`);
			}
			await refreshPages();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể cập nhật gán Page hàng loạt.",
			);
		} finally {
			setBusyAction(null);
		}
	}

	async function handleApplySyncRange(resetCursor: boolean) {
		const targetIds =
			selectedIds.length > 0
				? selectedIds
				: allFilteredPages.filter((p) => p.assigned).map((p) => p.pageId);
		if (targetIds.length === 0) {
			toast.error("Hãy chọn ít nhất 1 Page để cập nhật khoảng thời gian import.");
			return;
		}
		setBusyAction("range");
		try {
			const range = computeRangeDates(rangePreset, customFrom, customUntil);
			const client = makeClient();
			const res = await client.pancakeSettings.configurePageSync.mutate({
				shopId,
				pageIds: targetIds,
				syncEnabled: true,
				importFrom: range.importFrom,
				importUntil: range.importUntil,
				resetCursor,
			});
			toast.success(
				`Đã cập nhật cấu hình khoảng thời gian import cho ${res.updatedCount} Page.`,
			);
			await refreshPages();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể cập nhật cấu hình đồng bộ.",
			);
		} finally {
			setBusyAction(null);
		}
	}

	async function handleSyncNow(targetPageIds?: string[]) {
		setBusyAction("syncNow");
		try {
			const client = makeClient();
			const res = await client.pancakeSettings.syncPagesNow.mutate({
				shopId,
				pageIds:
					targetPageIds && targetPageIds.length > 0
						? targetPageIds.slice(0, 50)
						: selectedIds.length > 0
							? selectedIds.slice(0, 50)
							: undefined,
				conversationBudget: 2,
				messageBudget: 8,
			});
			const errors = res.outcomes.filter((o) => Boolean(o.errorCode));
			if (errors.length > 0) {
				toast.warning(
					`Đã chạy đợt đồng bộ ${res.pagesProcessed} Page (${res.conversationsProcessed} hội thoại, ${res.messagesWritten} tin nhắn). Có ${errors.length} Page báo lỗi.`,
				);
			} else {
				toast.success(
					`Đã đồng bộ ${res.pagesProcessed} Page: ${res.conversationsProcessed} hội thoại, ${res.messagesWritten} tin nhắn.`,
				);
			}
			await refreshPages();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể chạy đồng bộ hội thoại.",
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
			value: "assigned",
			label: "Đã gán vào shop",
			count: data?.summary.assigned,
		},
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
		{
			value: "error",
			label: "Lỗi cần xử lý",
			count: data?.summary.errorCount,
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
							Tự động lấy danh sách toàn bộ Page (~485+ Page) từ Pancake User
							Access Token, ưu tiên giữ nguyên Page Access Token hiện có và đồng
							bộ hội thoại theo đợt.
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
							Lỗi xác thực User Token: {data.connection.lastError}. Vui lòng
							cập nhật lại User Access Token (hệ thống đã dừng thử lại tự động).
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

					<div className="flex flex-wrap items-center justify-between gap-3 text-xs">
						<label className="flex cursor-pointer items-center gap-2">
							<Checkbox
								checked={autoAssignMatching}
								onCheckedChange={(v) => setAutoAssignMatching(Boolean(v))}
							/>
							<span>
								Tự động gán các Page có <code>shop_id = {shopId}</code> vào
								workspace này và giữ nguyên Page Access Token sẵn có
							</span>
						</label>
						<span className="text-muted-foreground">
							Webhook hội thoại (tùy chọn, không ghi đè webhook hiện có):{" "}
							<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
								/api/integrations/pancake/webhook/page/{shopId}
							</code>
						</span>
					</div>
				</form>
			</div>

			{data ? (
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
					<div className="rounded-lg border bg-card p-3 text-xs">
						<div className="text-muted-foreground">Tổng Page phát hiện</div>
						<div className="mt-1 font-bold text-base tabular-nums">
							{data.summary.total}
						</div>
					</div>
					<div className="rounded-lg border bg-card p-3 text-xs">
						<div className="text-muted-foreground">Đã gán vào shop</div>
						<div className="mt-1 font-bold text-[#1677ff] text-base tabular-nums">
							{data.summary.assigned}{" "}
							<span className="font-normal text-muted-foreground text-xs">
								({data.summary.syncEnabled} bật sync)
							</span>
						</div>
					</div>
					<div className="rounded-lg border bg-card p-3 text-xs">
						<div className="text-muted-foreground">Page đã có sẵn Token</div>
						<div className="mt-1 font-bold text-base text-emerald-600 tabular-nums">
							{data.summary.activeToken}
						</div>
					</div>
					<div className="rounded-lg border bg-card p-3 text-xs">
						<div className="text-muted-foreground">Thiếu quyền / Token</div>
						<div className="mt-1 font-bold text-amber-600 text-base tabular-nums">
							{data.summary.missingToken}
						</div>
					</div>
					<div className="rounded-lg border bg-card p-3 text-xs">
						<div className="text-muted-foreground">Hội thoại đã lưu</div>
						<div className="mt-1 font-bold text-base tabular-nums">
							{data.summary.totalConversations}
						</div>
					</div>
					<div className="rounded-lg border bg-card p-3 text-xs">
						<div className="text-muted-foreground">Tin nhắn đã lưu</div>
						<div className="mt-1 font-bold text-base tabular-nums">
							{data.summary.totalMessages}
						</div>
					</div>
				</div>
			) : null}

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

				<div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 p-3 text-xs">
					<div className="flex flex-wrap items-center gap-2">
						<span className="font-medium">
							Đã chọn: <strong className="tabular-nums">{selectedIds.length}</strong>{" "}
							Page
						</span>
						<Button
							type="button"
							variant="outline"
							size="xs"
							onClick={selectAllFiltered}
							disabled={allFilteredPages.length === 0}
						>
							Chọn tất cả trong bộ lọc ({allFilteredPages.length})
						</Button>
						<Button
							type="button"
							variant="outline"
							size="xs"
							onClick={selectMatchingShopPages}
							disabled={
								allFilteredPages.filter((p) => p.matchesShop).length === 0
							}
						>
							Chọn Page khớp mã shop (
							{allFilteredPages.filter((p) => p.matchesShop).length})
						</Button>
						{selectedIds.length > 0 ? (
							<Button
								type="button"
								variant="ghost"
								size="xs"
								onClick={clearSelection}
							>
								Bỏ chọn
							</Button>
						) : null}
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<span className="text-muted-foreground">Khoảng thời gian import:</span>
						{(
							[
								{ value: "7d", label: "7 ngày" },
								{ value: "30d", label: "30 ngày" },
								{ value: "90d", label: "90 ngày" },
								{ value: "custom", label: "Tùy chỉnh" },
							] as const
						).map((preset) => (
							<button
								key={preset.value}
								type="button"
								onClick={() => setRangePreset(preset.value)}
								className={cn(
									"rounded border px-2 py-1 text-xs",
									rangePreset === preset.value
										? "border-[#1677ff] bg-[#f0f7ff] font-medium text-[#1677ff]"
										: "bg-background text-muted-foreground",
								)}
							>
								{preset.label}
							</button>
						))}
						{rangePreset === "custom" ? (
							<div className="flex items-center gap-1.5">
								<Input
									type="date"
									value={customFrom}
									onChange={(e) => setCustomFrom(e.target.value)}
									className="h-7 w-34 text-xs"
								/>
								<span>→</span>
								<Input
									type="date"
									value={customUntil}
									onChange={(e) => setCustomUntil(e.target.value)}
									className="h-7 w-34 text-xs"
								/>
							</div>
						) : null}
					</div>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex flex-wrap items-center gap-2">
						<Button
							type="button"
							size="sm"
							disabled={
								selectedIds.length === 0 ||
								busyAction !== null ||
								!data?.canManage
							}
							onClick={() => handleBulkAssign(true)}
						>
							<Icon icon={CheckmarkFilled} data-icon="inline-start" />
							Gán vào shop & Bật đồng bộ ({selectedIds.length})
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={
								selectedIds.length === 0 ||
								busyAction !== null ||
								!data?.canManage
							}
							onClick={() => handleBulkAssign(false)}
						>
							Bỏ gán khỏi shop
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={busyAction !== null || !data?.canManage}
							onClick={() => handleApplySyncRange(true)}
						>
							Áp dụng khoảng thời gian import
						</Button>
					</div>

					<Button
						type="button"
						variant="secondary"
						size="sm"
						disabled={busyAction !== null || !data?.canManage}
						onClick={() => handleSyncNow()}
					>
						<Icon icon={Renew} data-icon="inline-start" />
						{busyAction === "syncNow"
							? "Đang đồng bộ theo đợt..."
							: selectedIds.length > 0
								? `Chạy đồng bộ đợt cho ${selectedIds.length} Page đã chọn`
								: "Chạy đồng bộ đợt cho các Page đã gán"}
					</Button>
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
						Page&rdquo; ở trên để tự động lấy ~485+ Page từ tài khoản Pancake.
					</div>
				) : (
					<div className="overflow-x-auto rounded-md border">
						<table className="w-full text-left text-xs">
							<thead>
								<tr className="border-b bg-muted/50 text-muted-foreground">
									<th className="w-9 p-2.5">
										<Checkbox
											checked={
												visiblePages.length > 0 &&
												visiblePages.every((p) => selectedSet.has(p.pageId))
											}
											onCheckedChange={(checked) => {
												for (const p of visiblePages) {
													togglePageSelection(p.pageId, Boolean(checked));
												}
											}}
										/>
									</th>
									<th className="p-2.5 font-semibold">Page</th>
									<th className="p-2.5 font-semibold">Quyền & Token</th>
									<th className="p-2.5 font-semibold">Trạng thái đồng bộ</th>
									<th className="p-2.5 text-right font-semibold">
										Hội thoại / Tin nhắn
									</th>
									<th className="p-2.5 font-semibold">Thành công gần nhất</th>
									<th className="p-2.5 text-right font-semibold">Thao tác</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{visiblePages.map((page) => {
									const tokBadge = tokenStatusBadge(page.tokenStatus);
									const phaseBadge = syncPhaseBadge(
										page.phase,
										page.syncEnabled,
										page.tokenStatus,
									);
									return (
										<tr
											key={page.pageId}
											className={cn(
												"hover:bg-accent/20",
												page.assigned ? "bg-[#f0f7ff]/30" : "",
											)}
										>
											<td className="p-2.5 align-top">
												<Checkbox
													checked={selectedSet.has(page.pageId)}
													onCheckedChange={(checked) =>
														togglePageSelection(page.pageId, Boolean(checked))
													}
												/>
											</td>
											<td className="p-2.5 align-top">
												<div className="flex items-start gap-2.5">
													<Avatar className="size-8 shrink-0">
														{page.avatarUrl ? (
															<AvatarImage src={page.avatarUrl} alt={page.name} />
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
															{page.assigned ? (
																<Badge variant="blue">Đã gán</Badge>
															) : null}
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
											<td className="max-w-xs p-2.5 align-top">
												<div className="flex flex-wrap items-center gap-1.5">
													<Badge variant={phaseBadge.variant}>
														{phaseBadge.label}
													</Badge>
													{page.connectStatus === "disconnected" ? (
														<Badge variant="red">Mất kết nối nền tảng</Badge>
													) : null}
												</div>
												{page.pendingConversationId ? (
													<div className="mt-1 font-mono text-[11px] text-muted-foreground">
														Checkpoint: {page.pendingConversationId} (offset{" "}
														{page.pendingMessageCount})
													</div>
												) : page.lastConversationId ? (
													<div className="mt-1 font-mono text-[11px] text-muted-foreground">
														Cursor: {page.lastConversationId}
													</div>
												) : null}
												{page.lastError ? (
													<p className="mt-1 text-[11px] text-destructive">
														Lỗi: {page.lastError}
													</p>
												) : null}
											</td>
											<td className="p-2.5 text-right align-top tabular-nums">
												<div className="font-semibold">
													{page.conversationCount} hội thoại
												</div>
												<div className="text-muted-foreground">
													{page.messageCount} tin nhắn
												</div>
											</td>
											<td className="p-2.5 align-top text-muted-foreground">
												<div>{formatDate(page.lastSuccessAt)}</div>
												{page.lastWebhookAt ? (
													<div className="text-[11px]">
														Webhook: {formatDate(page.lastWebhookAt)}
													</div>
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
													{page.assigned && page.tokenStatus === "active" ? (
														<Button
															type="button"
															variant="secondary"
															size="xs"
															disabled={!data?.canManage || busyAction !== null}
															onClick={() => handleSyncNow([page.pageId])}
														>
															Đồng bộ
														</Button>
													) : null}
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
								onClick={() =>
									setPageIndex((p) => Math.min(totalPages, p + 1))
								}
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

						<label className="flex cursor-pointer items-start gap-2 pt-1">
							<Checkbox
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
