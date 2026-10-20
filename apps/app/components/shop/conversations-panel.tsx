"use client";

import Chat from "@carbon/icons-react/es/Chat";
import CheckmarkFilled from "@carbon/icons-react/es/CheckmarkFilled";
import Document from "@carbon/icons-react/es/Document";
import Launch from "@carbon/icons-react/es/Launch";
import Renew from "@carbon/icons-react/es/Renew";
import Search from "@carbon/icons-react/es/Search";
import SendAlt from "@carbon/icons-react/es/SendAlt";
import WarningAlt from "@carbon/icons-react/es/WarningAlt";
import { Avatar, AvatarFallback, AvatarImage } from "@crm/ui/components/avatar";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { Textarea } from "@crm/ui/components/textarea";
import { cn } from "@crm/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "api/app-router";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/components/pancake/format";
import { initials } from "@/lib/initials";
import { useTRPC } from "@/lib/trpc/client";

type AttachmentItem = {
	id: string | null;
	type: string | null;
	url: string | null;
	previewUrl: string | null;
	fileUrl: string | null;
	name: string | null;
	mimeType: string | null;
};

type MessageItem = {
	messageId: string;
	type: string;
	senderType: string;
	senderId: string | null;
	senderName: string | null;
	staffId: string | null;
	staffName: string | null;
	message: string;
	originalMessage: string | null;
	attachments: AttachmentItem[];
	hasPhone: boolean;
	seen: boolean;
	isRemoved: boolean;
	isHidden: boolean;
	sourceInsertedAt: string;
};

type LocalAttempt = {
	clientMessageId: string;
	message: string;
	status: "sending" | "sent" | "failed";
	errorMessage: string | null;
	createdAt: string;
};

function makeClient() {
	return createTRPCClient<AppRouter>({
		links: [httpBatchLink({ url: "/api/trpc" })],
	});
}

function linkStatusBadge(status: string) {
	if (status === "linked_id") {
		return { label: "Đã ghép ID nguồn", variant: "green" as const };
	}
	if (status === "linked_phone") {
		return { label: "Đã ghép SĐT", variant: "soft-green" as const };
	}
	if (status === "ambiguous") {
		return { label: "Trùng SĐT (chưa ghép)", variant: "orange" as const };
	}
	return { label: "Chưa liên kết", variant: "gray" as const };
}

function MessageAttachments({ items }: { items: AttachmentItem[] }) {
	if (items.length === 0) return null;

	return (
		<div className="mt-1.5 flex flex-wrap gap-2">
			{items.map((att, idx) => {
				const href = att.url ?? att.fileUrl ?? att.previewUrl;
				const preview = att.previewUrl ?? att.url ?? att.fileUrl;
				const kind = (att.type ?? "").toLowerCase();
				const isImage =
					kind === "photo" ||
					kind === "image" ||
					kind === "sticker" ||
					(att.mimeType ?? "").startsWith("image/");
				const isVideo =
					kind === "video" || (att.mimeType ?? "").startsWith("video/");

				if (isImage && preview) {
					return (
						<a
							key={`${att.id ?? idx}`}
							href={href ?? preview}
							target="_blank"
							rel="noreferrer"
							className="block overflow-hidden rounded-md border bg-background/50"
						>
							<img
								src={preview}
								alt={att.name ?? "Hình đính kèm"}
								loading="lazy"
								className="max-h-44 max-w-56 object-cover"
							/>
						</a>
					);
				}

				if (isVideo && href) {
					return (
						<a
							key={`${att.id ?? idx}`}
							href={href}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-1.5 rounded-md border bg-background/80 px-2.5 py-1.5 text-[11px] text-foreground underline"
						>
							<Icon icon={Launch} className="size-3.5" />
							<span>{att.name ?? "Xem video đính kèm"}</span>
						</a>
					);
				}

				if (href) {
					return (
						<a
							key={`${att.id ?? idx}`}
							href={href}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-1.5 rounded-md border bg-background/80 px-2.5 py-1.5 text-[11px] text-foreground hover:underline"
						>
							<Icon icon={Document} className="size-3.5" />
							<span className="max-w-48 truncate">
								{att.name ?? att.type ?? "Tệp đính kèm"}
							</span>
						</a>
					);
				}

				return (
					<span
						key={`${att.id ?? idx}`}
						className="inline-flex items-center gap-1 rounded border bg-background/60 px-2 py-1 text-[11px]"
					>
						<Icon icon={Document} className="size-3" />
						<span>{att.name ?? att.type ?? "Đính kèm"}</span>
					</span>
				);
			})}
		</div>
	);
}

export function ConversationsPanel({
	shopId,
	base,
	customerId,
	fallbackLink,
	compact = false,
}: {
	shopId: string;
	base: string;
	customerId?: string;
	fallbackLink?: string | null;
	compact?: boolean;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [search, setSearch] = useState("");
	const [pageFilter, setPageFilter] = useState<string>("");
	const [linkFilter, setLinkFilter] = useState<
		"all" | "linked" | "unlinked" | "ambiguous"
	>("all");
	const [unreadOnly, setUnreadOnly] = useState(false);
	const [listPage, setListPage] = useState(1);
	const [selectedKey, setSelectedKey] = useState<{
		pageId: string;
		conversationId: string;
	} | null>(null);

	const [olderMessagesByConv, setOlderMessagesByConv] = useState<
		Record<string, MessageItem[]>
	>({});
	const [oldestCursorByConv, setOldestCursorByConv] = useState<
		Record<
			string,
			{
				beforeInsertedAt: string;
				beforeMessageId: string;
				hasMoreOlder: boolean;
				hasOlderInDb: boolean;
			} | null
		>
	>({});
	const [loadingOlder, setLoadingOlder] = useState(false);
	const [draft, setDraft] = useState("");
	const [attemptsByConv, setAttemptsByConv] = useState<
		Record<string, LocalAttempt[]>
	>({});

	const listQuery = useQuery(
		trpc.pancake.conversations.queryOptions(
			{
				shopId,
				pageId: pageFilter || undefined,
				customerId,
				linkStatus: customerId ? "all" : linkFilter,
				unreadOnly,
				q: search,
				page: listPage,
				pageSize: compact ? 15 : 25,
			},
			{
				refetchInterval: 5_000,
			},
		),
	);

	const conversations = listQuery.data?.rows ?? [];
	const activeConv =
		(selectedKey
			? conversations.find(
					(c) =>
						c.pageId === selectedKey.pageId &&
						c.conversationId === selectedKey.conversationId,
				)
			: null) ??
		conversations[0] ??
		null;

	const activeKeyStr = activeConv
		? `${activeConv.pageId}:${activeConv.conversationId}`
		: "";

	const messagesQuery = useQuery(
		trpc.pancake.conversationMessages.queryOptions(
			{
				shopId,
				pageId: activeConv?.pageId ?? "__none__",
				conversationId: activeConv?.conversationId ?? "__none__",
				limit: 30,
				fetchRemoteOlder: false,
			},
			{
				enabled: Boolean(activeConv),
				refetchInterval: 4_000,
			},
		),
	);

	const latestMessages: MessageItem[] = messagesQuery.data?.messages ?? [];
	const prependedOlder = activeKeyStr
		? (olderMessagesByConv[activeKeyStr] ?? [])
		: [];

	const combinedMessages: MessageItem[] = [];
	const seenMessageIds = new Set<string>();
	for (const msg of [...prependedOlder, ...latestMessages]) {
		if (!seenMessageIds.has(msg.messageId)) {
			seenMessageIds.add(msg.messageId);
			combinedMessages.push(msg);
		}
	}
	combinedMessages.sort((a, b) => {
		const cmp = a.sourceInsertedAt.localeCompare(b.sourceInsertedAt);
		return cmp !== 0 ? cmp : a.messageId.localeCompare(b.messageId);
	});

	const customCursor = activeKeyStr ? oldestCursorByConv[activeKeyStr] : undefined;
	const hasMoreOlder =
		customCursor !== undefined
			? Boolean(customCursor?.hasMoreOlder)
			: Boolean(messagesQuery.data?.hasMoreOlder);
	const hasOlderInDb =
		customCursor !== undefined
			? Boolean(customCursor?.hasOlderInDb)
			: Boolean(messagesQuery.data?.hasOlderInDb);
	const effectiveCursor =
		customCursor !== undefined
			? customCursor
			: messagesQuery.data?.nextCursor
				? {
						...messagesQuery.data.nextCursor,
						hasMoreOlder: messagesQuery.data.hasMoreOlder,
						hasOlderInDb: messagesQuery.data.hasOlderInDb,
					}
				: null;

	async function loadOlderMessages() {
		if (!activeConv || !hasMoreOlder || loadingOlder) return;
		setLoadingOlder(true);
		try {
			const client = makeClient();
			const res = await client.pancake.conversationMessages.query({
				shopId,
				pageId: activeConv.pageId,
				conversationId: activeConv.conversationId,
				beforeInsertedAt: effectiveCursor?.beforeInsertedAt,
				beforeMessageId: effectiveCursor?.beforeMessageId,
				limit: 30,
				fetchRemoteOlder: !hasOlderInDb,
			});
			const incoming = res.messages as MessageItem[];
			setOlderMessagesByConv((prev) => {
				const existing = prev[activeKeyStr] ?? [];
				const map = new Map<string, MessageItem>();
				for (const item of [...incoming, ...existing]) {
					map.set(item.messageId, item);
				}
				return {
					...prev,
					[activeKeyStr]: [...map.values()],
				};
			});
			setOldestCursorByConv((prev) => ({
				...prev,
				[activeKeyStr]: res.nextCursor
					? {
							...res.nextCursor,
							hasMoreOlder: res.hasMoreOlder,
							hasOlderInDb: res.hasOlderInDb,
						}
					: null,
			}));
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Không thể tải thêm lịch sử tin nhắn.",
			);
		} finally {
			setLoadingOlder(false);
		}
	}

	function handleThreadScroll(e: React.UIEvent<HTMLDivElement>) {
		const el = e.currentTarget;
		if (el.scrollTop <= 16 && hasMoreOlder && !loadingOlder) {
			void loadOlderMessages();
		}
	}

	async function handleSelectConversation(pageId: string, conversationId: string, seen: boolean) {
		setSelectedKey({ pageId, conversationId });
		if (!seen) {
			try {
				const client = makeClient();
				await client.pancake.markConversationSeen.mutate({
					shopId,
					pageId,
					conversationId,
					seen: true,
				});
				await queryClient.invalidateQueries({
					queryKey: trpc.pancake.conversations.queryKey(),
				});
			} catch (error) {
				void error;
			}
		}
	}

	async function executeSend(clientMessageId: string, textToSend: string) {
		if (!activeConv) return;
		const key = `${activeConv.pageId}:${activeConv.conversationId}`;
		setAttemptsByConv((prev) => {
			const current = prev[key] ?? [];
			const exists = current.some((a) => a.clientMessageId === clientMessageId);
			const updated = exists
				? current.map((a) =>
						a.clientMessageId === clientMessageId
							? { ...a, status: "sending" as const, errorMessage: null }
							: a,
					)
				: [
						...current,
						{
							clientMessageId,
							message: textToSend,
							status: "sending" as const,
							errorMessage: null,
							createdAt: new Date().toISOString(),
						},
					];
			return { ...prev, [key]: updated };
		});

		try {
			const client = makeClient();
			const res = await client.pancake.sendConversationMessage.mutate({
				shopId,
				pageId: activeConv.pageId,
				conversationId: activeConv.conversationId,
				clientMessageId,
				message: textToSend,
			});
			if (res.status !== "sent") {
				throw new Error(res.errorMessage ?? "Gửi tin nhắn không thành công.");
			}
			setAttemptsByConv((prev) => ({
				...prev,
				[key]: (prev[key] ?? []).filter(
					(a) => a.clientMessageId !== clientMessageId,
				),
			}));
			await Promise.all([messagesQuery.refetch(), listQuery.refetch()]);
		} catch (error) {
			const errMsg =
				error instanceof Error
					? error.message
					: "Không thể gửi tin nhắn tới nền tảng.";
			setAttemptsByConv((prev) => ({
				...prev,
				[key]: (prev[key] ?? []).map((a) =>
					a.clientMessageId === clientMessageId
						? { ...a, status: "failed" as const, errorMessage: errMsg }
						: a,
				),
			}));
			toast.error(errMsg);
		}
	}

	async function handleSubmitReply(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = draft.trim();
		if (!trimmed || !activeConv) return;
		const clientMessageId = `crm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
		setDraft("");
		await executeSend(clientMessageId, trimmed);
	}

	const localAttempts = activeKeyStr ? (attemptsByConv[activeKeyStr] ?? []) : [];
	const serverOutbound = (messagesQuery.data?.pendingOutbound ?? []).filter(
		(o) => !localAttempts.some((l) => l.clientMessageId === o.clientMessageId),
	);

	const convDetail = messagesQuery.data?.conversation;
	const canWrite = messagesQuery.data?.canWrite ?? listQuery.data?.canWrite ?? false;
	const sendBlockedReason = !canWrite
		? "Tài khoản của bạn chỉ có quyền xem trong cửa hàng này."
		: convDetail && convDetail.pageTokenStatus !== "active"
			? (convDetail.pageTokenReason ??
				"Page chưa có Page Access Token hợp lệ hoặc token đã hết hạn. Vui lòng kiểm tra Cài đặt → Kết nối → Pancake.")
			: convDetail && !convDetail.canInbox
				? "Cuộc hội thoại đã quá khung thời gian cho phép gửi tin nhắn chuẩn từ nền tảng (can_inbox = false)."
				: null;

	if (listQuery.isLoading) {
		return (
			<div className="flex flex-1 items-center justify-center py-12 text-muted-foreground text-xs">
				Đang tải danh sách hội thoại...
			</div>
		);
	}

	if (listQuery.isError) {
		return (
			<div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive text-xs">
				Không tải được danh sách hội thoại: {listQuery.error.message}
			</div>
		);
	}

	if (
		conversations.length === 0 &&
		!search &&
		!pageFilter &&
		linkFilter === "all" &&
		!unreadOnly
	) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center text-xs">
				<Icon icon={Chat} className="size-8 text-muted-foreground" />
				<div className="space-y-1">
					<p className="font-medium text-foreground">
						{customerId
							? "Chưa có hội thoại nào được liên kết với khách hàng này."
							: "Chưa có dữ liệu hội thoại trong cửa hàng này."}
					</p>
					<p className="text-muted-foreground">
						{customerId
							? "Hội thoại chỉ được ghép tự động khi khớp định danh nguồn hoặc khớp số điện thoại duy nhất trong cùng cửa hàng."
							: "Hãy kết nối Pancake User Access Token và gán Page trong mục Cấu hình → Kết nối → Pancake."}
					</p>
				</div>
				<div className="flex flex-wrap items-center justify-center gap-2">
					{fallbackLink ? (
						<Button asChild size="sm" variant="outline">
							<a href={fallbackLink} target="_blank" rel="noreferrer">
								Mở hội thoại trên Pancake
							</a>
						</Button>
					) : null}
					<Button asChild size="sm" variant="secondary">
						<Link href={`${base}/settings/connections`}>
							Cấu hình Page Pancake
						</Link>
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"grid min-h-0 flex-1 overflow-hidden rounded-lg border bg-card",
				compact
					? "grid-cols-1"
					: "min-h-[600px] lg:grid-cols-[340px_minmax(0,1fr)]",
			)}
		>
			<div
				className={cn(
					"flex min-h-0 flex-col border-b lg:border-r lg:border-b-0",
					compact ? "max-h-52 border-b" : "",
				)}
			>
				{!customerId ? (
					<div className="flex flex-col gap-2 border-b p-3">
						<div className="relative">
							<Icon
								icon={Search}
								className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setListPage(1);
								}}
								placeholder="Tìm tên khách, SĐT, nội dung..."
								className="h-8 pl-8 text-xs"
							/>
						</div>

						<div className="flex flex-wrap items-center gap-1.5 text-[11px]">
							<select
								value={pageFilter}
								onChange={(e) => {
									setPageFilter(e.target.value);
									setListPage(1);
								}}
								className="h-7 max-w-40 rounded border bg-background px-2 text-xs"
							>
								<option value="">Tất cả Page ({listQuery.data?.pages.length ?? 0})</option>
								{(listQuery.data?.pages ?? []).map((p) => (
									<option key={p.pageId} value={p.pageId}>
										{p.name}
									</option>
								))}
							</select>

							<select
								value={linkFilter}
								onChange={(e) => {
									setLinkFilter(
										e.target.value as "all" | "linked" | "unlinked" | "ambiguous",
									);
									setListPage(1);
								}}
								className="h-7 rounded border bg-background px-2 text-xs"
							>
								<option value="all">Tất cả liên kết</option>
								<option value="linked">Đã ghép khách</option>
								<option value="unlinked">Chưa liên kết</option>
								<option value="ambiguous">Trùng SĐT</option>
							</select>

							<button
								type="button"
								onClick={() => {
									setUnreadOnly((v) => !v);
									setListPage(1);
								}}
								className={cn(
									"h-7 rounded border px-2 font-medium",
									unreadOnly
										? "border-[#1677ff] bg-[#f0f7ff] text-[#1677ff]"
										: "bg-background text-muted-foreground",
								)}
							>
								Chưa đọc
							</button>
						</div>
					</div>
				) : null}

				<div className="min-h-0 flex-1 divide-y overflow-y-auto">
					{conversations.length === 0 ? (
						<div className="p-6 text-center text-muted-foreground text-xs">
							Không có hội thoại khớp bộ lọc.
						</div>
					) : (
						conversations.map((conv) => {
							const isSelected =
								activeConv?.pageId === conv.pageId &&
								activeConv?.conversationId === conv.conversationId;
							const badge = linkStatusBadge(conv.linkStatus);
							return (
								<button
									key={`${conv.pageId}:${conv.conversationId}`}
									type="button"
									onClick={() =>
										handleSelectConversation(
											conv.pageId,
											conv.conversationId,
											conv.seen,
										)
									}
									className={cn(
										"flex w-full items-start gap-2.5 p-3 text-left text-xs transition-colors hover:bg-accent/30",
										isSelected ? "bg-[#f0f7ff]" : "",
									)}
								>
									<Avatar className="size-8 shrink-0">
										{conv.pageAvatarUrl ? (
											<AvatarImage src={conv.pageAvatarUrl} alt={conv.pageName} />
										) : null}
										<AvatarFallback>
											{initials(conv.customerName ?? conv.pageName)}
										</AvatarFallback>
									</Avatar>
									<div className="min-w-0 flex-1">
										<div className="flex items-center justify-between gap-1">
											<span
												className={cn(
													"truncate",
													!conv.seen ? "font-bold text-foreground" : "font-medium",
												)}
											>
												{conv.customerName ?? "Khách hội thoại"}
											</span>
											<span className="shrink-0 text-[10px] text-muted-foreground">
												{formatDate(conv.sourceUpdatedAt)}
											</span>
										</div>
										<div className="mt-0.5 truncate text-muted-foreground">
											{conv.snippet || "Không có nội dung xem trước"}
										</div>
										<div className="mt-1 flex flex-wrap items-center gap-1">
											<span className="max-w-36 truncate rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
												{conv.pageName}
											</span>
											{!customerId ? (
												<Badge variant={badge.variant} className="text-[10px]">
													{badge.label}
												</Badge>
											) : null}
											{!conv.seen ? (
												<span className="size-2 rounded-full bg-[#1677ff]" />
											) : null}
										</div>
									</div>
								</button>
							);
						})
					)}
				</div>

				{!customerId && (listQuery.data?.total ?? 0) > 25 ? (
					<div className="flex items-center justify-between border-t px-3 py-2 text-[11px]">
						<span className="text-muted-foreground">
							Tổng: {listQuery.data?.total ?? 0}
						</span>
						<div className="flex items-center gap-1.5">
							<Button
								type="button"
								variant="outline"
								size="xs"
								disabled={listPage <= 1}
								onClick={() => setListPage((p) => Math.max(1, p - 1))}
							>
								Trước
							</Button>
							<span>Trang {listPage}</span>
							<Button
								type="button"
								variant="outline"
								size="xs"
								disabled={conversations.length < 25}
								onClick={() => setListPage((p) => p + 1)}
							>
								Sau
							</Button>
						</div>
					</div>
				) : null}
			</div>

			<div className="flex min-h-0 flex-1 flex-col">
				{!activeConv ? (
					<div className="flex flex-1 items-center justify-center p-8 text-muted-foreground text-xs">
						Chọn một hội thoại để xem lịch sử tin nhắn.
					</div>
				) : (
					<>
						<div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 text-xs">
							<div className="min-w-0">
								<div className="flex flex-wrap items-center gap-2">
									<span className="font-semibold text-sm">
										{activeConv.customerName ?? "Khách hội thoại"}
									</span>
									{activeConv.customerPhone ? (
										<span className="font-mono text-muted-foreground">
											{activeConv.customerPhone}
										</span>
									) : null}
									<Badge
										variant={linkStatusBadge(activeConv.linkStatus).variant}
									>
										{linkStatusBadge(activeConv.linkStatus).label}
									</Badge>
								</div>
								<div className="mt-0.5 text-[11px] text-muted-foreground">
									Page: <strong>{activeConv.pageName}</strong> ({activeConv.platform}) · ID:{" "}
									<code className="font-mono">{activeConv.conversationId}</code>
								</div>
							</div>

							<div className="flex items-center gap-2">
								{activeConv.customerId && !customerId ? (
									<Button asChild variant="outline" size="xs">
										<Link href={`${base}/contacts/${activeConv.customerId}`}>
											Hồ sơ khách hàng
										</Link>
									</Button>
								) : null}
								<Button
									type="button"
									variant="ghost"
									size="icon-xs"
									title="Làm mới tin nhắn"
									onClick={() => void messagesQuery.refetch()}
								>
									<Icon icon={Renew} />
								</Button>
							</div>
						</div>

						<div
							onScroll={handleThreadScroll}
							className={cn(
								"flex flex-1 flex-col gap-2.5 overflow-y-auto bg-muted/15 p-4 text-xs",
								compact ? "max-h-80 min-h-60" : "min-h-80",
							)}
						>
							{hasMoreOlder ? (
								<div className="flex justify-center pb-2">
									<Button
										type="button"
										variant="outline"
										size="xs"
										disabled={loadingOlder}
										onClick={() => void loadOlderMessages()}
									>
										{loadingOlder
											? "Đang tải tin nhắn cũ hơn..."
											: "Tải tin nhắn cũ hơn"}
									</Button>
								</div>
							) : null}

							{messagesQuery.isLoading ? (
								<div className="py-10 text-center text-muted-foreground">
									Đang tải lịch sử tin nhắn...
								</div>
							) : messagesQuery.isError ? (
								<div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive">
									Không tải được lịch sử chat: {messagesQuery.error.message}
								</div>
							) : combinedMessages.length === 0 ? (
								<div className="py-10 text-center text-muted-foreground">
									Chưa có tin nhắn nào trong hội thoại này.
								</div>
							) : (
								combinedMessages.map((msg) => {
									const isStaff = msg.senderType === "staff";
									return (
										<div
											key={msg.messageId}
											className={cn(
												"flex flex-col",
												isStaff ? "items-end" : "items-start",
											)}
										>
											<div
												className={cn(
													"max-w-[82%] rounded-lg border px-3 py-2 shadow-2xs",
													isStaff
														? "border-[#b8d9ff] bg-[#e8f3ff] text-foreground dark:border-blue-800 dark:bg-blue-950/60"
														: "bg-card text-foreground",
												)}
											>
												<div className="mb-1 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
													<span className="font-medium">
														{isStaff
															? (msg.staffName ?? msg.senderName ?? "Nhân viên")
															: (msg.senderName ?? "Khách hàng")}
													</span>
													<span>{formatDate(msg.sourceInsertedAt)}</span>
												</div>
												{msg.message ? (
													<p className="whitespace-pre-wrap break-words">
														{msg.message}
													</p>
												) : null}
												<MessageAttachments items={msg.attachments} />
											</div>
										</div>
									);
								})
							)}

							{serverOutbound.map((out) => (
								<div
									key={out.clientMessageId}
									className="flex flex-col items-end"
								>
									<div className="max-w-[82%] rounded-lg border border-amber-400/50 bg-amber-50/70 px-3 py-2 text-xs dark:bg-amber-950/30">
										<p className="whitespace-pre-wrap break-words">
											{out.message}
										</p>
										<div className="mt-1.5 flex items-center justify-end gap-2 text-[10px]">
											{out.status === "sending" ? (
												<span className="text-muted-foreground">Đang gửi...</span>
											) : (
												<>
													<span className="text-destructive">
														Gửi thất bại: {out.errorMessage ?? out.errorCode}
													</span>
													<Button
														type="button"
														variant="outline"
														size="xs"
														onClick={() =>
															void executeSend(out.clientMessageId, out.message)
														}
													>
														Thử lại
													</Button>
												</>
											)}
										</div>
									</div>
								</div>
							))}

							{localAttempts.map((att) => (
								<div
									key={att.clientMessageId}
									className="flex flex-col items-end"
								>
									<div
										className={cn(
											"max-w-[82%] rounded-lg border px-3 py-2 text-xs",
											att.status === "failed"
												? "border-destructive/50 bg-destructive/10"
												: "border-[#b8d9ff] bg-[#e8f3ff]/70",
										)}
									>
										<p className="whitespace-pre-wrap break-words">
											{att.message}
										</p>
										<div className="mt-1.5 flex items-center justify-end gap-2 text-[10px]">
											{att.status === "sending" ? (
												<span className="text-muted-foreground">
													Đang gửi tới Pancake...
												</span>
											) : att.status === "sent" ? (
												<span className="inline-flex items-center gap-1 text-emerald-600">
													<Icon icon={CheckmarkFilled} className="size-3" />
													Đã gửi
												</span>
											) : (
												<>
													<span className="text-destructive">
														Thất bại: {att.errorMessage}
													</span>
													<Button
														type="button"
														variant="outline"
														size="xs"
														onClick={() =>
															void executeSend(att.clientMessageId, att.message)
														}
													>
														Gửi lại (chống trùng)
													</Button>
												</>
											)}
										</div>
									</div>
								</div>
							))}
						</div>

						<div className="border-t bg-card p-3">
							{sendBlockedReason ? (
								<div className="mb-2 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
									<Icon icon={WarningAlt} className="size-3.5 shrink-0" />
									<span>{sendBlockedReason}</span>
								</div>
							) : null}
							<form onSubmit={handleSubmitReply} className="flex gap-2">
								<Textarea
									value={draft}
									onChange={(e) => setDraft(e.target.value)}
									placeholder={
										sendBlockedReason
											? "Không thể gửi tin nhắn trong trạng thái hiện tại..."
											: "Nhập nội dung tin nhắn trả lời khách hàng..."
									}
									disabled={Boolean(sendBlockedReason)}
									rows={2}
									className="min-h-14 flex-1 text-xs"
								/>
								<Button
									type="submit"
									size="sm"
									disabled={Boolean(sendBlockedReason) || !draft.trim()}
									className="self-end"
								>
									<Icon icon={SendAlt} data-icon="inline-start" />
									Gửi
								</Button>
							</form>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
