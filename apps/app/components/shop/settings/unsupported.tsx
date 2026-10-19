export function Unsupported({
	reason,
	children,
}: {
	reason: string;
	children: React.ReactNode;
}) {
	return (
		<span title={reason} className="inline-flex">
			{children}
		</span>
	);
}
