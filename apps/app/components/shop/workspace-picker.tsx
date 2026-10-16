"use client";

import Add from "@carbon/icons-react/es/Add";
import CheckmarkFilled from "@carbon/icons-react/es/CheckmarkFilled";
import ChevronRight from "@carbon/icons-react/es/ChevronRight";
import Search from "@carbon/icons-react/es/Search";
import { Avatar, AvatarFallback, AvatarImage } from "@crm/ui/components/avatar";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@crm/ui/components/dialog";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { cn } from "@crm/ui/lib/utils";
import Link from "next/link";
import { useState } from "react";
import { initials } from "@/lib/initials";
import { shopInitial, shopProfile } from "./shop-profile";

export type WorkspaceShopItem = {
	id: string;
	name: string;
	currency: string;
	ordersCount: number;
	customersCount: number;
	employeesCount: number;
	syncEnabled: boolean;
	lastSyncAt: string | null;
};

export function WorkspacePicker({
	slug,
	user,
	shops,
}: {
	slug: string;
	user: { name: string; email: string; image?: string | null };
	shops: WorkspaceShopItem[];
}) {
	const [query, setQuery] = useState("");
	const [versionTab, setVersionTab] = useState<"v2" | "v1">("v2");
	const [createOpen, setCreateOpen] = useState(false);

	const filtered = shops.filter(
		(shop) =>
			shop.name.toLowerCase().includes(query.toLowerCase()) ||
			shop.id.includes(query.trim()),
	);

	return (
		<div className="flex min-h-svh flex-col bg-[#f5f6fa] text-[#1f2329] lg:flex-row">
			<aside className="flex w-full shrink-0 flex-col justify-between bg-[#fff5eb] p-8 lg:w-[440px] lg:p-12">
				<div className="flex items-center gap-3">
					<div className="flex size-10 items-center justify-center rounded-xl bg-[#ff6a00] font-bold text-lg text-white shadow-sm">
						P
					</div>
					<span className="font-bold text-2xl text-[#1f2329] tracking-tight">
						Pancake CRM
					</span>
				</div>

				<div className="my-8 flex flex-col gap-5">
					<div className="relative mx-auto flex w-full max-w-[340px] flex-col gap-3 rounded-2xl border border-[#ffd8b8] bg-white/90 p-5 shadow-sm">
						<div className="flex items-center justify-between">
							<span className="font-semibold text-muted-foreground text-xs">
								Báo cáo doanh thu
							</span>
							<Badge variant="orange" className="text-[10px]">
								+14.8%
							</Badge>
						</div>
						<div className="font-bold text-2xl text-[#1f2329] tabular-nums">
							{shops
								.reduce((sum, s) => sum + s.ordersCount, 0)
								.toLocaleString("en-US")}{" "}
							đơn hàng
						</div>
						<div className="grid grid-cols-3 gap-2 pt-1">
							{shops.map((shop) => (
								<div
									key={shop.id}
									className="rounded-lg bg-[#fff8f2] p-2.5 text-center"
								>
									<div className="font-semibold text-[#ff6a00] text-xs">
										{shop.name}
									</div>
									<div className="mt-0.5 font-bold text-[#1f2329] text-xs tabular-nums">
										{shop.ordersCount.toLocaleString("en-US")}
									</div>
								</div>
							))}
						</div>
					</div>

					<div className="space-y-3 pt-2">
						<h2 className="font-bold text-2xl text-[#1f2329] leading-snug">
							Tối ưu khách hàng - Nâng tầm hiệu quả
						</h2>
						<ul className="space-y-2.5 text-[#4e5969] text-sm">
							<li className="flex items-start gap-2.5">
								<Icon
									icon={CheckmarkFilled}
									className="mt-0.5 size-4 shrink-0 text-[#ff6a00]"
								/>
								<span>
									Theo dõi hành trình khách hàng rõ ràng theo từng giai đoạn mua
									hàng
								</span>
							</li>
							<li className="flex items-start gap-2.5">
								<Icon
									icon={CheckmarkFilled}
									className="mt-0.5 size-4 shrink-0 text-[#ff6a00]"
								/>
								<span>
									Tự động nhắc việc, tránh bỏ sót khách hàng tiềm năng tại từng
									chi nhánh
								</span>
							</li>
							<li className="flex items-start gap-2.5">
								<Icon
									icon={CheckmarkFilled}
									className="mt-0.5 size-4 shrink-0 text-[#ff6a00]"
								/>
								<span>
									Báo cáo trực quan theo thời gian thực đồng bộ từ Pancake POS
								</span>
							</li>
						</ul>
					</div>
				</div>

				<div className="flex items-center justify-between text-[#86909c] text-xs">
					<span>Pancake CRM Workspace</span>
					<Link
						href={`/${slug}`}
						className="font-medium text-[#ff6a00] hover:underline"
					>
						← Bảng điều khiển tổng
					</Link>
				</div>
			</aside>

			<div className="flex min-w-0 flex-1 flex-col">
				<header className="flex h-16 items-center justify-end gap-3 px-6 lg:px-10">
					<Link
						href={`/${slug}`}
						className="mr-auto text-muted-foreground text-xs hover:text-foreground"
					>
						Tổng quan đa shop (/crm)
					</Link>
					<div className="flex items-center gap-2.5 rounded-full bg-white px-3 py-1.5 shadow-xs">
						<Avatar size="sm">
							{user.image ? (
								<AvatarImage src={user.image} alt={user.name} />
							) : null}
							<AvatarFallback>{initials(user.name)}</AvatarFallback>
						</Avatar>
						<span className="font-medium text-sm">{user.name}</span>
					</div>
				</header>

				<main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-6 pb-16 lg:px-10">
					<div className="text-center">
						<h1 className="font-bold text-3xl text-[#1f2329] tracking-tight">
							Danh sách Workspaces của tôi
						</h1>
						<p className="mt-2 text-[#646a73] text-sm">
							Chọn CRM mà bạn muốn tích hợp Page/Shop này để bắt đầu quản lý.
						</p>
					</div>

					<div className="mt-8 flex flex-wrap items-center justify-between gap-3">
						<div className="inline-flex rounded-lg border bg-white p-1">
							<button
								type="button"
								onClick={() => setVersionTab("v2")}
								className={cn(
									"rounded-md px-3.5 py-1.5 font-medium text-xs transition-colors",
									versionTab === "v2"
										? "bg-[#e8f3ff] text-[#1677ff]"
										: "text-[#646a73] hover:text-[#1f2329]",
								)}
							>
								CRM V2 ({shops.length})
							</button>
							<button
								type="button"
								onClick={() => setVersionTab("v1")}
								className={cn(
									"rounded-md px-3.5 py-1.5 font-medium text-xs transition-colors",
									versionTab === "v1"
										? "bg-[#e8f3ff] text-[#1677ff]"
										: "text-[#646a73] hover:text-[#1f2329]",
								)}
							>
								CRM V1 (0)
							</button>
						</div>

						<div className="relative w-full sm:w-64">
							<Icon
								icon={Search}
								className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-[#86909c]"
							/>
							<Input
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Tìm kiếm workspace"
								className="h-9 bg-white pl-9"
							/>
						</div>
					</div>

					<div className="mt-5 grid gap-4 sm:grid-cols-2">
						<Dialog open={createOpen} onOpenChange={setCreateOpen}>
							<DialogTrigger asChild>
								<button
									type="button"
									className="flex min-h-[112px] items-center justify-center gap-2 rounded-xl border-2 border-[#d0d5dd] border-dashed bg-white/60 p-5 font-medium text-[#4e5969] text-sm transition-colors hover:border-[#1677ff] hover:bg-white hover:text-[#1677ff]"
								>
									<Icon icon={Add} className="size-5" />
									Thêm Workspace mới
								</button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Thêm Workspace Pancake POS</DialogTitle>
									<DialogDescription>
										Các shop Pancake POS được cấu hình trong biến môi trường{" "}
										<code>PANCAKE_SHOPS_JSON</code> và đồng bộ tự động qua API
										Key.
									</DialogDescription>
								</DialogHeader>
								<div className="space-y-2 text-muted-foreground text-xs">
									<p>
										Hiện tại hệ thống đã kết nối {shops.length} shop:{" "}
										{shops.map((s) => `${s.name} (#${s.id})`).join(", ")}.
									</p>
									<p>
										Để quản lý kết nối hoặc tạm dừng đồng bộ của từng shop, chọn
										một shop bên dưới và vào mục{" "}
										<strong>Cấu hình → Tích hợp</strong>.
									</p>
								</div>
								<DialogFooter>
									<Button
										variant="outline"
										onClick={() => setCreateOpen(false)}
									>
										Đóng
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>

						{versionTab === "v1" ? (
							<div className="flex min-h-[112px] items-center justify-center rounded-xl border bg-white p-5 text-[#86909c] text-xs">
								Không có workspace trên phiên bản CRM V1.
							</div>
						) : (
							filtered.map((shop) => {
								const profile = shopProfile(shop.id);
								return (
									<Link
										key={shop.id}
										href={`/${slug}/shop/${shop.id}`}
										className="group flex min-h-[112px] flex-col justify-between rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-2xs transition-all hover:border-[#1677ff] hover:shadow-md"
									>
										<div className="flex items-start justify-between gap-3">
											<div className="flex items-center gap-3">
												<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#e5533d] font-bold text-base text-white">
													{shopInitial(shop.name)}
												</div>
												<div>
													<div className="flex items-center gap-2">
														<span className="font-semibold text-[#1f2329] text-base group-hover:text-[#1677ff]">
															{shop.name}
														</span>
														<Badge variant="secondary" className="text-[10px]">
															{shop.currency}
														</Badge>
													</div>
													<div className="text-[#86909c] text-xs">
														Shop ID: #{shop.id} · {profile.country}
													</div>
												</div>
											</div>
											<Icon
												icon={ChevronRight}
												className="size-4 text-[#86909c] transition-transform group-hover:translate-x-0.5 group-hover:text-[#1677ff]"
											/>
										</div>

										<div className="mt-4 flex items-center justify-between border-[#f2f3f5] border-t pt-3 text-xs">
											<div className="flex items-center gap-3 text-[#4e5969]">
												<span>
													<strong className="text-[#1f2329] tabular-nums">
														{shop.ordersCount.toLocaleString("en-US")}
													</strong>{" "}
													đơn
												</span>
												<span>·</span>
												<span>
													<strong className="text-[#1f2329] tabular-nums">
														{shop.customersCount.toLocaleString("en-US")}
													</strong>{" "}
													liên hệ
												</span>
												<span>·</span>
												<span>
													<strong className="text-[#1f2329] tabular-nums">
														{shop.employeesCount}
													</strong>{" "}
													NV
												</span>
											</div>
											<span
												className={cn(
													"inline-flex items-center gap-1 font-medium text-[11px]",
													shop.syncEnabled
														? "text-emerald-600"
														: "text-amber-600",
												)}
											>
												<span
													className={cn(
														"size-1.5 rounded-full",
														shop.syncEnabled
															? "bg-emerald-500"
															: "bg-amber-500",
													)}
												/>
												{shop.syncEnabled ? "Đang đồng bộ" : "Tạm dừng"}
											</span>
										</div>
									</Link>
								);
							})
						)}
					</div>
				</main>
			</div>
		</div>
	);
}
