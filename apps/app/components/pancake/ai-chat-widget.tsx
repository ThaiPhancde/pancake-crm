"use client";

import Chat from "@carbon/icons-react/es/Chat";
import Close from "@carbon/icons-react/es/Close";
import Send from "@carbon/icons-react/es/Send";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { cn } from "@crm/ui/lib/utils";
import { useEffect, useRef, useState } from "react";

type Message = {
	id: string;
	role: "user" | "assistant";
	content: string;
	local?: boolean;
	timestamp: string;
};

export function PancakeAiChatWidget({
	shopId,
	shopName,
}: {
	shopId?: string;
	shopName?: string;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [input, setInput] = useState("");
	const [loading, setLoading] = useState(false);
	const [messages, setMessages] = useState<Message[]>([
		{
			id: "welcome",
			role: "assistant",
			content: `Xin chào! Tôi là Trợ lý AI Pancake${shopName ? ` của ${shopName}` : ""}. Bạn có thể hỏi mã đơn, số điện thoại khách, rủi ro hoàn đơn hoặc doanh số.`,
			local: true,
			timestamp: new Date().toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			}),
		},
	]);

	const messagesEndRef = useRef<HTMLDivElement>(null);

	const messageCount = messages.length;

	useEffect(() => {
		if (isOpen && messageCount > 0) {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [messageCount, isOpen]);

	const handleSend = async (textToSend?: string) => {
		const text = (textToSend || input).trim();
		if (!text || loading) return;

		const userMsg: Message = {
			id: crypto.randomUUID(),
			role: "user",
			content: text,
			timestamp: new Date().toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			}),
		};

		setMessages((prev) => [...prev, userMsg]);
		setInput("");
		setLoading(true);

		try {
			const chatHistory = [...messages, userMsg]
				.filter((m) => !m.local)
				.map((m) => ({ role: m.role, content: m.content }));

			const res = await fetch("/api/pancake/ai-chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					messages: chatHistory,
					shopId,
				}),
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || "Không thể kết nối với AI");
			}

			const botMsg: Message = {
				id: crypto.randomUUID(),
				role: "assistant",
				content: data.reply || "Đã xử lý xong yêu cầu của bạn.",
				timestamp: new Date().toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
				}),
			};

			setMessages((prev) => [...prev, botMsg]);
		} catch (err) {
			setMessages((prev) => [
				...prev,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					content: `Lỗi: ${err instanceof Error ? err.message : "Có lỗi xảy ra khi xử lý yêu cầu."}`,
					local: true,
					timestamp: new Date().toLocaleTimeString([], {
						hour: "2-digit",
						minute: "2-digit",
					}),
				},
			]);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
			{/* Chat window */}
			{isOpen && (
				<div className="mb-3 flex h-[520px] w-[380px] sm:w-[420px] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl transition-all duration-200 ease-in-out">
					{/* Header */}
					<div className="flex items-center justify-between border-b bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-white">
						<div className="flex items-center gap-2">
							<div className="flex size-8 items-center justify-center rounded-full bg-white/20 font-bold text-sm">
								✦
							</div>
							<div>
								<div className="flex items-center gap-1.5 font-semibold text-sm leading-tight">
									Trợ lý AI Pancake
								</div>
								<div className="text-white/80 text-[11px]">
									{shopName
										? `Đang kết nối: ${shopName}`
										: "Tra cứu tự động đơn & khách"}
								</div>
							</div>
						</div>
						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="icon"
								className="size-7 text-white hover:bg-white/20 hover:text-white"
								onClick={() =>
									setMessages([
										{
											id: "reset",
											role: "assistant",
											content:
												"Hội thoại đã được làm mới. Tôi có thể hỗ trợ gì cho bạn?",
											local: true,
											timestamp: new Date().toLocaleTimeString([], {
												hour: "2-digit",
												minute: "2-digit",
											}),
										},
									])
								}
								title="Xóa đoạn chat"
							>
								<TrashCan className="size-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="size-7 text-white hover:bg-white/20 hover:text-white"
								onClick={() => setIsOpen(false)}
							>
								<Close className="size-4" />
							</Button>
						</div>
					</div>

					{/* Message list */}
					<div className="flex-1 space-y-3 overflow-y-auto p-4 text-xs">
						{messages.map((m) => (
							<div
								key={m.id}
								className={cn(
									"flex flex-col",
									m.role === "user" ? "items-end" : "items-start",
								)}
							>
								<div
									className={cn(
										"max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 leading-relaxed shadow-sm",
										m.role === "user"
											? "bg-primary text-primary-foreground rounded-br-none"
											: "bg-muted text-foreground rounded-bl-none",
									)}
								>
									{m.content}
								</div>
								<span className="mt-0.5 px-1 text-[10px] text-muted-foreground">
									{m.timestamp}
								</span>
							</div>
						))}

						{loading && (
							<div className="flex items-center gap-2 rounded-xl bg-muted/50 p-2 text-muted-foreground">
								<div className="size-2 animate-bounce rounded-full bg-violet-600 [animation-delay:-0.3s]"></div>
								<div className="size-2 animate-bounce rounded-full bg-violet-600 [animation-delay:-0.15s]"></div>
								<div className="size-2 animate-bounce rounded-full bg-violet-600"></div>
								<span className="text-[11px]">
									AI đang kiểm tra cơ sở dữ liệu...
								</span>
							</div>
						)}
						<div ref={messagesEndRef} />
					</div>

					{/* Suggestions */}
					{messages.length <= 2 && (
						<div className="flex flex-wrap gap-1.5 border-t bg-muted/30 px-3 py-2 text-[11px]">
							<button
								type="button"
								className="rounded-full border bg-background px-2.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
								onClick={() =>
									handleSend("Thống kê doanh số và đơn hoàn 30 ngày qua")
								}
							>
								📊 Báo cáo shop 30 ngày
							</button>
							<button
								type="button"
								className="rounded-full border bg-background px-2.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
								onClick={() => handleSend("Tra cứu 5 đơn hàng mới nhất")}
							>
								📦 5 đơn hàng mới nhất
							</button>
						</div>
					)}

					{/* Input form */}
					<form
						onSubmit={(e) => {
							e.preventDefault();
							handleSend();
						}}
						className="flex items-center gap-2 border-t bg-background p-2.5"
					>
						<Input
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder="Hỏi mã đơn, SĐT khách, doanh số..."
							className="h-9 text-xs focus-visible:ring-1"
							disabled={loading}
							autoFocus
						/>
						<Button
							type="submit"
							size="icon"
							disabled={loading || !input.trim()}
							className="size-9 shrink-0 bg-violet-600 hover:bg-violet-700 text-white"
						>
							<Send className="size-4" />
						</Button>
					</form>
				</div>
			)}

			{/* Floating Toggle Button */}
			<button
				type="button"
				onClick={() => setIsOpen((prev) => !prev)}
				className={cn(
					"flex items-center gap-2 rounded-full px-4 py-3 font-medium text-white shadow-xl transition-all duration-300 hover:scale-105 active:scale-95",
					isOpen
						? "bg-neutral-800 hover:bg-neutral-900"
						: "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:opacity-95",
				)}
			>
				{isOpen ? (
					<>
						<Close className="size-5" />
						<span className="text-xs font-semibold">Đóng AI</span>
					</>
				) : (
					<>
						<span className="flex size-2 rounded-full bg-emerald-400 animate-pulse"></span>
						<Chat className="size-5" />
						<span className="text-xs font-semibold tracking-wide">
							Trợ lý AI Pancake
						</span>
					</>
				)}
			</button>
		</div>
	);
}
