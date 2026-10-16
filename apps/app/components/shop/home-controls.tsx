"use client";

import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function HomeViewSelect({ value }: { value: "manager" | "personal" }) {
	const router = useRouter();
	const pathname = usePathname();
	const search = useSearchParams();
	return (
		<Select
			value={value}
			onValueChange={(next) => {
				const params = new URLSearchParams(search.toString());
				if (next === "manager") params.delete("view");
				else params.set("view", next);
				const query = params.toString();
				router.push(query ? `${pathname}?${query}` : pathname);
			}}
		>
			<SelectTrigger className="w-44 border-primary text-primary">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					<SelectItem value="manager">Màn hình quản lý</SelectItem>
					<SelectItem value="personal">Công việc cá nhân</SelectItem>
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}
