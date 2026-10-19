export function DetailFields({
	items,
}: {
	items: { label: string; value: React.ReactNode }[];
}) {
	return (
		<dl className="grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-x-4 gap-y-3 text-sm">
			{items.map((item) => (
				<div key={item.label} className="contents">
					<dt className="text-muted-foreground">{item.label}</dt>
					<dd className="min-w-0 break-words">
						{item.value ?? <span className="text-muted-foreground">—</span>}
					</dd>
				</div>
			))}
		</dl>
	);
}
