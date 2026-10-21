"use client";

import Chat from "@carbon/icons-react/es/Chat";
import Launch from "@carbon/icons-react/es/Launch";
import Renew from "@carbon/icons-react/es/Renew";
import Send from "@carbon/icons-react/es/Send";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { Textarea } from "@crm/ui/components/textarea";
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/components/pancake/format";
import { useTRPC } from "@/lib/trpc/client";

type ConversationMessage = {
	id: string;
	fromPage: boolean;
	senderName: string;
	text: string;
	attachments: { url: string; image: boolean; name: string | null }[];
	sentAt: string | null;
};

type OlderPage = {
	fetched: number;
	hasOlder: boolean;
	messages: ConversationMessage[];
};

export function CustomerConversation({
	shopId,
	customerId,
	canWrite,
	base,
}: {
	shopId: string;
	customerId: string;
	canWrite: boolean;
	base: string;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [older, setOlder] = useState<OlderPage | null>(null);
	const [loadingOlder, setLoadingOlder] = useState(false);
	const [draft, setDraft] = useState("");
	const latest = useQuery(
		trpc.pancake.customerConversation.queryOptions(
			{ shopId, customerId, loaded: 0 },
			{ staleTime: 60_000 },
		),
	);
	const send = useMutation(
		trpc.pancake.sendCustomerMessage.mutationOptions({
			onSuccess: async () => {
				setDraft("");
				setOlder(null);
				await latest.refetch();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (latest.isLoading) {
		return (
			<div className="py-12 text-center text-muted-foreground text-xs">
				Đang tải hội thoại từ Pancake...
			</div>
		);
	}
	if (latest.isError || !latest.data) {
		return (
			<ConversationNotice
				text={latest.error?.message ?? "Không tải được hội thoại."}
			/>
		);
	}
	const data = latest.data;
	if (data.state === "none") {
		return (
			<ConversationNotice
				text="Khách hàng này chưa có hội thoại Pancake."
				link={data.link}
			/>
		);
	}
	if (data.state === "unavailable") {
		return (
			<ConversationNotice
				text={data.reason}
				link={data.link}
				settingsHref={`${base}/settings/connections`}
			/>
		);
	}

	const fetched = older?.fetched ?? data.fetched;
	const hasOlder = older?.hasOlder ?? data.hasOlder;
	const latestIds = new Set(data.messages.map((msg) => msg.id));
	const messages = [
		...(older?.messages ?? []).filter((msg) => !latestIds.has(msg.id)),
		...data.messages,
	];

	async function loadOlder() {
		setLoadingOlder(true);
		try {
			const page = await queryClient.fetchQuery(
				trpc.pancake.customerConversation.queryOptions({
					shopId,
					customerId,
					loaded: fetched,
				}),
			);
			if (page.state !== "ready") return;
			setOlder((prev) => {
				const known = new Set((prev?.messages ?? []).map((msg) => msg.id));
				return {
					fetched: fetched + page.fetched,
					hasOlder: page.hasOlder,
					messages: [
						...page.messages.filter((msg) => !known.has(msg.id)),
						...(prev?.messages ?? []),
					],
				};
			});
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Không tải được tin cũ hơn.",
			);
		} finally {
			setLoadingOlder(false);
		}
	}

	return (
		<div className="flex flex-col gap-3 text-xs">
			<div className="flex items-center justify-between gap-2 text-muted-foreground">
				<span>
					Page <strong className="text-foreground">{data.pageName}</strong>
				</span>
				<div className="flex items-center gap-1">
					<Button
						type="button"
						variant="ghost"
						size="xs"
						disabled={latest.isFetching}
						onClick={() => {
							setOlder(null);
							void latest.refetch();
						}}
					>
						<Icon icon={Renew} data-icon="inline-start" />
						Tải lại
					</Button>
					{data.link ? (
						<Button asChild variant="ghost" size="xs">
							<a href={data.link} target="_blank" rel="noreferrer">
								<Icon icon={Launch} data-icon="inline-start" />
								Mở Pancake
							</a>
						</Button>
					) : null}
				</div>
			</div>

			<div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
				{hasOlder ? (
					<Button
						type="button"
						variant="outline"
						size="xs"
						className="self-center"
						disabled={loadingOlder}
						onClick={loadOlder}
					>
						{loadingOlder ? "Đang tải..." : "Tải tin cũ hơn"}
					</Button>
				) : null}
				{messages.length === 0 ? (
					<p className="py-6 text-center text-muted-foreground">
						Hội thoại chưa có tin nhắn.
					</p>
				) : (
					messages.map((msg) => (
						<div
							key={msg.id}
							className={cn(
								"flex max-w-[85%] flex-col gap-1 rounded-lg border px-3 py-2",
								msg.fromPage
									? "self-end border-[#1677ff]/20 bg-[#f0f7ff] dark:bg-[#1677ff]/10"
									: "self-start bg-card",
							)}
						>
							<div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
								<span className="truncate font-medium">{msg.senderName}</span>
								<span className="shrink-0">{formatDate(msg.sentAt)}</span>
							</div>
							{msg.text ? (
								<p className="whitespace-pre-wrap break-words">{msg.text}</p>
							) : null}
							{msg.attachments.map((item) =>
								item.image ? (
									<a
										key={item.url}
										href={item.url}
										target="_blank"
										rel="noreferrer"
									>
										<img
											src={item.url}
											alt={item.name ?? "Ảnh đính kèm"}
											loading="lazy"
											className="max-h-44 max-w-56 rounded-md border object-cover"
										/>
									</a>
								) : (
									<a
										key={item.url}
										href={item.url}
										target="_blank"
										rel="noreferrer"
										className="truncate text-[#1677ff] hover:underline"
									>
										{item.name ?? "Tệp đính kèm"}
									</a>
								),
							)}
						</div>
					))
				)}
			</div>

			{canWrite ? (
				<form
					className="flex items-end gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						if (!draft.trim() || send.isPending) return;
						send.mutate({ shopId, customerId, message: draft.trim() });
					}}
				>
					<Textarea
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						placeholder={
							data.canInbox
								? "Nhập tin nhắn gửi khách..."
								: "Đã quá 24 giờ kể từ tin cuối của khách. Facebook có thể từ chối tin nhắn."
						}
						className="min-h-16 text-xs"
						disabled={send.isPending}
					/>
					<Button
						type="submit"
						size="sm"
						disabled={!draft.trim() || send.isPending}
					>
						<Icon icon={Send} data-icon="inline-start" />
						{send.isPending ? "Đang gửi..." : "Gửi"}
					</Button>
				</form>
			) : null}
		</div>
	);
}

function ConversationNotice({
	text,
	link,
	settingsHref,
}: {
	text: string;
	link?: string | null;
	settingsHref?: string;
}) {
	return (
		<div className="flex flex-col items-center gap-3 py-12 text-center text-xs">
			<Icon icon={Chat} className="size-8 text-muted-foreground" />
			<p className="max-w-sm text-muted-foreground">{text}</p>
			<div className="flex gap-2">
				{link ? (
					<Button asChild size="sm" variant="outline">
						<a href={link} target="_blank" rel="noreferrer">
							<Icon icon={Launch} data-icon="inline-start" />
							Mở trên Pancake
						</a>
					</Button>
				) : null}
				{settingsHref ? (
					<Button asChild size="sm" variant="outline">
						<Link href={settingsHref}>Cấu hình Page Pancake</Link>
					</Button>
				) : null}
			</div>
		</div>
	);
}
