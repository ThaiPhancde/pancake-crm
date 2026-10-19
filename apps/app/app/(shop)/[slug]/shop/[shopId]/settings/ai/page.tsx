import { Button } from "@crm/ui/components/button";
import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { UNSUPPORTED } from "@/components/shop/settings/config";
import { Unsupported } from "@/components/shop/settings/unsupported";
import { SettingsFrame } from "@/components/shop/settings-frame";

const FEATURES = [
	{
		title: "AI chấm điểm cuộc gọi",
		description: "Tự động chấm điểm ngay khi cuộc gọi kết thúc",
		art: "75/100",
	},
	{
		title: "Phát hiện cuộc gọi có vấn đề",
		description: "Tự động phân tích và đưa ra kết luận về chất lượng cuộc gọi",
		art: "Kết luận",
	},
	{
		title: "Tiêu chí chấm điểm",
		description:
			"Xây dựng tiêu chí làm cơ sở cho báo cáo và phân tích hiệu quả cuộc gọi",
		art: "Trọng số: 10",
	},
];

export default function AiPage({ params }: { params: Promise<ShopRoute> }) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<Ai params={params} />
		</Suspense>
	);
}

async function Ai({ params }: { params: Promise<ShopRoute> }) {
	await loadShop(params);
	return (
		<SettingsFrame
			current="Trợ lý AI"
			className="items-center justify-center gap-8 px-5 py-16 text-center"
		>
			<div className="flex flex-col items-center gap-2">
				<span className="text-4xl text-[#9254de]">✦</span>
				<h2 className="font-semibold text-xl">
					Kiểm soát chất lượng cuộc gọi bằng AI
				</h2>
				<p className="text-muted-foreground text-xs">
					Mọi cuộc gọi đều được AI đánh giá, không bỏ sót cuộc nào cần xử lý
				</p>
			</div>
			<div className="grid max-w-4xl gap-8 md:grid-cols-3">
				{FEATURES.map((feature) => (
					<div key={feature.title} className="flex flex-col items-center gap-3">
						<div className="flex h-36 w-full items-center justify-center rounded-lg bg-muted">
							<span className="rounded-full bg-gradient-to-r from-[#9254de] to-[#1677ff] px-4 py-1.5 font-semibold text-white text-xs">
								{feature.art}
							</span>
						</div>
						<h3 className="font-semibold text-sm">{feature.title}</h3>
						<p className="text-muted-foreground text-xs">
							{feature.description}
						</p>
					</div>
				))}
			</div>
			<Unsupported reason={UNSUPPORTED.feature}>
				<Button disabled>Bắt đầu thiết lập</Button>
			</Unsupported>
			<p className="text-muted-foreground text-xs">{UNSUPPORTED.feature}</p>
		</SettingsFrame>
	);
}
