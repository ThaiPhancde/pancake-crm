"use client";

import ImageIcon from "@carbon/icons-react/es/Image";
import { Avatar, AvatarFallback, AvatarImage } from "@crm/ui/components/avatar";
import { Badge } from "@crm/ui/components/badge";
import { Icon } from "@crm/ui/components/icon";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";

export function ProductTypeHoverBadge({
	name,
	sku,
	imageUrl,
	priceLabel,
}: {
	name: string;
	sku: string;
	imageUrl: string | null;
	priceLabel: string | null;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="inline-flex cursor-pointer items-center">
					<Badge variant="soft-blue" className="gap-1.5">
						<Icon icon={ImageIcon} className="size-3.5" />
						Sản phẩm
					</Badge>
				</span>
			</TooltipTrigger>
			<TooltipContent
				side="right"
				className="w-64 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg"
			>
				<div className="flex flex-col gap-2">
					{imageUrl ? (
						<Avatar className="h-44 w-full rounded-lg border bg-muted">
							<AvatarImage
								src={imageUrl}
								alt={name}
								className="h-44 w-full rounded-lg object-cover"
							/>
							<AvatarFallback className="h-44 w-full rounded-lg text-xs">
								{sku}
							</AvatarFallback>
						</Avatar>
					) : (
						<div className="flex h-36 w-full flex-col items-center justify-center gap-1 rounded-lg border bg-muted text-muted-foreground text-xs">
							<Icon icon={ImageIcon} className="size-6 opacity-50" />
							<span>Chưa có ảnh sản phẩm</span>
						</div>
					)}
					<div className="space-y-0.5">
						<div className="line-clamp-2 font-semibold text-xs">{name}</div>
						<div className="flex items-center justify-between text-[11px] text-muted-foreground">
							<span>SKU: {sku}</span>
							{priceLabel ? (
								<strong className="text-foreground">{priceLabel}</strong>
							) : null}
						</div>
					</div>
				</div>
			</TooltipContent>
		</Tooltip>
	);
}

export function ProductImageThumb({
	name,
	sku,
	imageUrl,
	priceLabel,
}: {
	name: string;
	sku: string;
	imageUrl: string | null;
	priceLabel: string | null;
}) {
	if (!imageUrl) {
		return <span className="text-muted-foreground">—</span>;
	}
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="inline-flex cursor-pointer">
					<Avatar className="size-8 rounded-md border bg-muted">
						<AvatarImage
							src={imageUrl}
							alt={name}
							className="size-full rounded-md object-cover"
						/>
						<AvatarFallback className="rounded-md text-[10px]">
							{sku.slice(0, 2)}
						</AvatarFallback>
					</Avatar>
				</span>
			</TooltipTrigger>
			<TooltipContent
				side="right"
				className="w-64 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg"
			>
				<div className="flex flex-col gap-2">
					<Avatar className="h-48 w-full rounded-lg border bg-muted">
						<AvatarImage
							src={imageUrl}
							alt={name}
							className="h-48 w-full rounded-lg object-cover"
						/>
						<AvatarFallback className="h-48 w-full rounded-lg text-xs">
							{sku}
						</AvatarFallback>
					</Avatar>
					<div className="space-y-0.5">
						<div className="line-clamp-2 font-semibold text-xs">{name}</div>
						<div className="flex items-center justify-between text-[11px] text-muted-foreground">
							<span>SKU: {sku}</span>
							{priceLabel ? (
								<strong className="text-foreground">{priceLabel}</strong>
							) : null}
						</div>
					</div>
				</div>
			</TooltipContent>
		</Tooltip>
	);
}
