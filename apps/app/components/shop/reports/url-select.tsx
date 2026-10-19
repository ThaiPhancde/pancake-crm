"use client";

import Filter from "@carbon/icons-react/es/Filter";
import { Button } from "@crm/ui/components/button";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type UrlOption = { value: string; label: string };

const ALL = "all";

function useParamPush() {
	const router = useRouter();
	const pathname = usePathname();
	const search = useSearchParams();
	return {
		current: (param: string) => search.get(param) ?? "",
		push: (change: Record<string, string>) => {
			const params = new URLSearchParams(search.toString());
			params.delete("page");
			for (const [key, value] of Object.entries(change)) {
				if (value) params.set(key, value);
				else params.delete(key);
			}
			const query = params.toString();
			router.push(query ? `${pathname}?${query}` : pathname);
		},
	};
}

export function UrlSelect({
	param,
	value,
	options,
	defaultValue,
	label,
}: {
	param: string;
	value: string;
	options: readonly UrlOption[];
	defaultValue: string;
	label: string;
}) {
	const { push } = useParamPush();
	return (
		<Select
			value={value}
			onValueChange={(next) =>
				push({ [param]: next === defaultValue ? "" : next })
			}
		>
			<SelectTrigger size="sm" aria-label={label}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}

export function ReportFilter({ sellers }: { sellers: UrlOption[] }) {
	const { current, push } = useParamPush();
	const seller = current("sellerId");
	const single = seller.includes(",") ? ALL : seller || ALL;
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant="outline">
					<Icon icon={Filter} data-icon="inline-start" />
					Bộ lọc
					{seller ? " (1)" : ""}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="flex w-72 flex-col gap-3">
				<Field>
					<FieldLabel>Nhân viên</FieldLabel>
					<Select
						value={single}
						onValueChange={(next) =>
							push({ sellerId: next === ALL ? "" : next })
						}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectItem value={ALL}>Tất cả nhân viên</SelectItem>
								{sellers.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>
				<Button
					variant="ghost"
					size="sm"
					disabled={!seller}
					onClick={() => push({ sellerId: "" })}
				>
					Xoá bộ lọc
				</Button>
			</PopoverContent>
		</Popover>
	);
}
