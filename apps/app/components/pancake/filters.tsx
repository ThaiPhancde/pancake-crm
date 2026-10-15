"use client";

import { Button } from "@crm/ui/components/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@crm/ui/components/collapsible";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { z } from "zod";

type FilterProps = {
	action: string;
	tab: string;
	q: string;
	shopId: string;
	status: string;
	sellerId: string;
	from: string;
	to: string;
	shops: { id: string; name: string }[];
	statuses: { id: string; name: string }[];
	sellers: { shopId: string; employeeId: string; name: string }[];
	view: string;
	sort: string;
	taskView: string;
};

export function PancakeFilters(props: FilterProps) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const orderFilters = ["orders", "overview", "report"].includes(props.tab);
	const staff = [
		...new Map(
			props.sellers.map((seller) => [seller.employeeId, seller]),
		).values(),
	];
	return (
		<form
			action={props.action}
			method="get"
			onSubmit={(event) => {
				event.preventDefault();
				const params = new URLSearchParams();
				for (const [key, value] of new FormData(event.currentTarget)) {
					const parsed = z.string().min(1).safeParse(value);
					if (parsed.success && parsed.data !== "all")
						params.set(key, parsed.data);
				}
				startTransition(() => router.push(`${props.action}?${params}`));
			}}
		>
			<input type="hidden" name="tab" value={props.tab} />
			{props.tab === "tasks" && (
				<input type="hidden" name="taskView" value={props.taskView} />
			)}
			<FieldGroup>
				<div className="grid gap-3 md:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="pancake-q">Tìm kiếm</FieldLabel>
						<Input
							id="pancake-q"
							name="q"
							defaultValue={props.q}
							maxLength={120}
							placeholder={
								props.tab === "tasks"
									? "Tên việc, khách hàng, mã đơn"
									: props.tab === "products"
										? "Tên sản phẩm, SKU"
										: "Tên khách, điện thoại, mã đơn, vận đơn"
							}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="pancake-shop">Shop</FieldLabel>
						<Select name="shopId" defaultValue={props.shopId || "all"}>
							<SelectTrigger id="pancake-shop">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectItem value="all">
										Tất cả shop được cấp quyền
									</SelectItem>
									{props.shops.map((shop) => (
										<SelectItem key={shop.id} value={shop.id}>
											{shop.name}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
				</div>
				{orderFilters && (
					<Collapsible
						defaultOpen={Boolean(
							props.status ||
								props.sellerId ||
								props.from ||
								props.to ||
								props.view !== "all" ||
								props.sort !== "newest",
						)}
					>
						<CollapsibleTrigger asChild>
							<Button type="button" variant="outline" size="sm">
								Bộ lọc nâng cao
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent
							forceMount
							className="data-[state=closed]:hidden"
						>
							<div className="grid gap-3 pt-3 md:grid-cols-3">
								{orderFilters && (
									<Field>
										<FieldLabel htmlFor="pancake-status">
											Trạng thái đơn
										</FieldLabel>
										<Select name="status" defaultValue={props.status || "all"}>
											<SelectTrigger id="pancake-status">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectGroup>
													<SelectItem value="all">Tất cả trạng thái</SelectItem>
													{props.statuses.map((status) => (
														<SelectItem key={status.id} value={status.id}>
															{status.name}
														</SelectItem>
													))}
												</SelectGroup>
											</SelectContent>
										</Select>
									</Field>
								)}
								{orderFilters && (
									<Field>
										<FieldLabel htmlFor="pancake-seller">
											Nhân viên bán hàng
										</FieldLabel>
										<Select
											name="sellerId"
											defaultValue={props.sellerId || "all"}
										>
											<SelectTrigger id="pancake-seller">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectGroup>
													<SelectItem value="all">Tất cả nhân viên</SelectItem>
													{staff.map((seller) => (
														<SelectItem
															key={seller.employeeId}
															value={seller.employeeId}
														>
															{seller.name} ·{" "}
															{
																props.shops.find(
																	(shop) => shop.id === seller.shopId,
																)?.name
															}
														</SelectItem>
													))}
													{props.sellerId &&
														!staff.some(
															(seller) => seller.employeeId === props.sellerId,
														) && (
															<SelectItem value={props.sellerId}>
																Nhân viên đang lọc
															</SelectItem>
														)}
												</SelectGroup>
											</SelectContent>
										</Select>
									</Field>
								)}
								{orderFilters && (
									<Field>
										<FieldLabel htmlFor="pancake-from">
											Từ ngày (giờ Việt Nam)
										</FieldLabel>
										<Input
											id="pancake-from"
											name="from"
											type="date"
											defaultValue={props.from}
										/>
									</Field>
								)}
								{orderFilters && (
									<Field>
										<FieldLabel htmlFor="pancake-to">
											Đến ngày (giờ Việt Nam)
										</FieldLabel>
										<Input
											id="pancake-to"
											name="to"
											type="date"
											defaultValue={props.to}
										/>
									</Field>
								)}
								{orderFilters && (
									<Field>
										<FieldLabel htmlFor="pancake-view">Nhóm xử lý</FieldLabel>
										<Select name="view" defaultValue={props.view}>
											<SelectTrigger id="pancake-view">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectGroup>
													<SelectItem value="all">Tất cả đơn</SelectItem>
													<SelectItem value="pending">Chờ xử lý</SelectItem>
													<SelectItem value="shipping">Đang giao</SelectItem>
													<SelectItem value="returns">Hoàn hàng</SelectItem>
													<SelectItem value="unassigned">
														Chưa phân công
													</SelectItem>
												</SelectGroup>
											</SelectContent>
										</Select>
									</Field>
								)}
								{props.tab === "orders" && (
									<Field>
										<FieldLabel htmlFor="pancake-sort">Sắp xếp</FieldLabel>
										<Select name="sort" defaultValue={props.sort}>
											<SelectTrigger id="pancake-sort">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectGroup>
													<SelectItem value="newest">
														Ngày tạo mới nhất
													</SelectItem>
													<SelectItem value="updated">
														Cập nhật gần nhất
													</SelectItem>
													<SelectItem value="oldest">
														Ngày tạo cũ nhất
													</SelectItem>
												</SelectGroup>
											</SelectContent>
										</Select>
									</Field>
								)}
							</div>
						</CollapsibleContent>
					</Collapsible>
				)}

				<div className="flex flex-wrap gap-2">
					<Button type="submit" disabled={pending}>
						{pending ? "Đang tải…" : "Áp dụng bộ lọc"}
					</Button>
					<Button
						type="button"
						variant="outline"
						disabled={pending}
						onClick={() => startTransition(() => router.refresh())}
					>
						Làm mới dữ liệu
					</Button>
					<Button asChild variant="ghost">
						<Link href={`${props.action}?tab=${props.tab}`}>Xóa bộ lọc</Link>
					</Button>
				</div>
			</FieldGroup>
		</form>
	);
}
