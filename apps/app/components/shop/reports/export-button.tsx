"use client";

import Download from "@carbon/icons-react/es/Download";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { HistoryTab } from "../admin/config";
import { LIST_CONFIG } from "../lists/config";
import { REPORTS } from "./config";

type CsvFile = {
	filename: string;
	mimeType: string;
	content: string;
	truncated: boolean;
};

export type BusinessExportFilters = {
	shopId: string;
	from?: string;
	to?: string;
	sellerId?: string;
};

function saveCsv(file: CsvFile) {
	const url = URL.createObjectURL(
		new Blob([file.content], { type: file.mimeType }),
	);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = file.filename.endsWith(".csv")
		? file.filename
		: `${file.filename}.csv`;
	anchor.click();
	setTimeout(() => URL.revokeObjectURL(url), LIST_CONFIG.downloadRevokeMs);
	if (file.truncated)
		toast.info(
			`Tệp chỉ gồm ${REPORTS.exportMaxRows.toLocaleString("vi-VN")} dòng đầu tiên.`,
		);
}

export function ExportCsvButton({
	source,
	label,
}: {
	source:
		| { kind: "business"; filters: BusinessExportFilters }
		| { kind: "history"; shopId: string; tab: HistoryTab };
	label?: string;
}) {
	const api = useTRPC();
	const queryClient = useQueryClient();
	const [pending, setPending] = useState(false);

	async function run() {
		setPending(true);
		try {
			const file =
				source.kind === "business"
					? await queryClient.fetchQuery({
							...api.pancake.exportCsv.queryOptions({
								kind: "business",
								shopId: source.filters.shopId,
								filters: source.filters,
							}),
							staleTime: 0,
						})
					: await queryClient.fetchQuery({
							...api.pancakeSettings.exportHistory.queryOptions({
								shopId: source.shopId,
								tab: source.tab,
							}),
							staleTime: 0,
						});
			saveCsv(file);
		} catch {
			toast.error("Không thể xuất dữ liệu. Vui lòng thử lại.");
		} finally {
			setPending(false);
		}
	}

	return label ? (
		<Button variant="outline" size="sm" onClick={run} disabled={pending}>
			<Icon icon={Download} data-icon="inline-start" />
			{label}
		</Button>
	) : (
		<Button
			variant="outline"
			size="icon"
			aria-label="Tải xuống"
			title="Tải xuống CSV"
			onClick={run}
			disabled={pending}
		>
			<Icon icon={Download} />
		</Button>
	);
}
