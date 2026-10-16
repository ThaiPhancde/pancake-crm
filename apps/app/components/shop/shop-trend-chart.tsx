"use client";

import type { ChartConfig } from "@crm/ui/components/chart";
import { AreaTrend } from "@crm/ui/components/dashboard-chart";
import { formatAmount } from "@/components/pancake/format";

export function ShopTrendChart({
	data,
	config,
	xKey = "date",
	height = 220,
	currency,
	className,
}: {
	data: Record<string, number | string | null>[];
	config: ChartConfig;
	xKey?: string;
	height?: number;
	currency?: string;
	className?: string;
}) {
	return (
		<AreaTrend
			height={height}
			data={data}
			xKey={xKey}
			config={config}
			className={className}
			formatX={(d) =>
				d && d.length >= 10 ? d.slice(5).split("-").reverse().join("/") : d
			}
			formatValue={
				currency ? (v) => formatAmount(String(v), currency) : undefined
			}
		/>
	);
}
