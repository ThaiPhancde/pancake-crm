"use client";

import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";

export default function PancakeError({ retry }: { retry: () => void }) {
	return (
		<main className="flex flex-col gap-4 p-(--spacing-page-inline)">
			<Alert variant="destructive">
				<AlertTitle>Chưa tải được dữ liệu CRM</AlertTitle>
				<AlertDescription>
					Kiểm tra kết nối API và quyền shop, sau đó thử tải lại. Dữ liệu đã lưu
					vẫn được giữ.
				</AlertDescription>
			</Alert>
			<div>
				<Button onClick={retry}>Thử lại</Button>
			</div>
		</main>
	);
}
