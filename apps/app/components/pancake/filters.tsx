"use client";

import { Button } from "@crm/ui/components/button";
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
import { useRouter } from "next/navigation";

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
};

export function PancakeFilters(props: FilterProps) {
	const router = useRouter();
	return (
		<form action={props.action} method="get">
			<input type="hidden" name="tab" value={props.tab} />
			<FieldGroup>
				<div className="grid gap-3 md:grid-cols-3">
					<Field>
						<FieldLabel htmlFor="pancake-q">Tìm kiếm</FieldLabel>
						<Input
							id="pancake-q"
							name="q"
							defaultValue={props.q}
							placeholder="Tên khách, điện thoại, mã đơn, vận đơn"
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
					<Field>
						<FieldLabel htmlFor="pancake-status">Trạng thái đơn</FieldLabel>
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
					<Field>
						<FieldLabel htmlFor="pancake-seller">
							Mã nhân viên bán hàng
						</FieldLabel>
						<Input
							id="pancake-seller"
							name="sellerId"
							defaultValue={props.sellerId}
						/>
					</Field>
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
				</div>
				<div className="flex gap-2">
					<Button type="submit">Áp dụng bộ lọc</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() => router.refresh()}
					>
						Làm mới dữ liệu
					</Button>
				</div>
			</FieldGroup>
		</form>
	);
}
