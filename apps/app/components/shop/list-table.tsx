import ChevronLeft from "@carbon/icons-react/es/ChevronLeft";
import ChevronRight from "@carbon/icons-react/es/ChevronRight";
import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import { Icon } from "@crm/ui/components/icon";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@crm/ui/components/table";
import { cn } from "@crm/ui/lib/utils";
import Link from "next/link";
import { ClickableRow } from "./clickable-row";
import { EmptyRows } from "./empty-state";
import { ShopPageFooter } from "./page";

export type ListColumn = { key: string; label: string; className?: string };

export function ListTable({
	columns,
	rows,
	empty = "Trống",
	selectable = true,
}: {
	columns: ListColumn[];
	rows: { key: string; cells: React.ReactNode[]; href?: string }[];
	empty?: string;
	selectable?: boolean;
}) {
	return (
		<div className="min-h-0 flex-1 overflow-auto rounded-md">
			<Table className="text-xs">
				<TableHeader className="sticky top-0 z-10 bg-muted [&_tr]:border-0">
					<TableRow className="hover:bg-muted">
						{selectable ? (
							<TableHead className="w-10 pl-4">
								<Checkbox aria-label="Chọn tất cả" />
							</TableHead>
						) : null}
						{columns.map((column) => (
							<TableHead
								key={column.key}
								className={cn(
									"font-semibold text-foreground",
									column.className,
								)}
							>
								{column.label}
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((row) => (
						<ClickableRow
							key={row.key}
							href={row.href}
							className="hover:bg-accent/40"
						>
							{selectable ? (
								<TableCell className="pl-4">
									<Checkbox aria-label="Chọn dòng" />
								</TableCell>
							) : null}
							{row.cells.map((cell, index) => (
								<TableCell
									key={columns[index]?.key ?? index}
									className={cn("max-w-64 truncate", columns[index]?.className)}
								>
									{index === 0 && row.href ? (
										<Link
											href={row.href}
											scroll={false}
											className="font-medium text-foreground hover:text-primary"
										>
											{cell}
										</Link>
									) : (
										cell
									)}
								</TableCell>
							))}
						</ClickableRow>
					))}
					{rows.length === 0 ? (
						<TableRow className="hover:bg-transparent">
							<TableCell colSpan={columns.length + (selectable ? 1 : 0)}>
								<EmptyRows label={empty} />
							</TableCell>
						</TableRow>
					) : null}
				</TableBody>
			</Table>
		</div>
	);
}

export function ListFooter({
	total,
	page,
	pageSize,
	unit,
	pageHref,
}: {
	total: number;
	page: number;
	pageSize: number;
	unit: string;
	pageHref: (page: number) => string;
}) {
	const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
	const end = Math.min(page * pageSize, total);
	const last = Math.max(1, Math.ceil(total / pageSize));
	return (
		<ShopPageFooter>
			<span>
				{total} {unit}
			</span>
			<span className="flex items-center gap-1">
				<span>
					{start}-{end} / {total} {unit}
				</span>
				<Button
					asChild
					variant="ghost"
					size="icon-sm"
					aria-label="Trang trước"
					disabled={page <= 1}
				>
					<Link
						href={pageHref(Math.max(1, page - 1))}
						aria-disabled={page <= 1}
					>
						<Icon icon={ChevronLeft} />
					</Link>
				</Button>
				<Button
					asChild
					variant="ghost"
					size="icon-sm"
					aria-label="Trang sau"
					disabled={page >= last}
				>
					<Link
						href={pageHref(Math.min(last, page + 1))}
						aria-disabled={page >= last}
					>
						<Icon icon={ChevronRight} />
					</Link>
				</Button>
			</span>
		</ShopPageFooter>
	);
}

export function Dash() {
	return <span className="text-muted-foreground">—</span>;
}
