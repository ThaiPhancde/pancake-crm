import { Suspense } from "react";
import { PageShellLoading } from "@/components/page-shell";
import { loadShop, type ShopRoute } from "@/components/shop/load";
import { GENERAL_SETTINGS } from "@/components/shop/settings/config";
import {
	GeneralSettings,
	type SettingsOption,
} from "@/components/shop/settings/general-settings";
import { SettingsFrame } from "@/components/shop/settings-frame";
import { getServerTrpcClient } from "@/lib/trpc/server";

export default function GeneralSettingsPage({
	params,
}: {
	params: Promise<ShopRoute>;
}) {
	return (
		<Suspense fallback={<PageShellLoading />}>
			<General params={params} />
		</Suspense>
	);
}

function withCurrent(options: SettingsOption[], value: string) {
	return options.some((option) => option.value === value)
		? options
		: [{ value, label: value }, ...options];
}

function offsetLabel(timeZone: string) {
	const part = new Intl.DateTimeFormat("en-US", {
		timeZone,
		timeZoneName: "shortOffset",
	})
		.formatToParts(new Date())
		.find((item) => item.type === "timeZoneName")?.value;
	const offset = part?.replace("GMT", "") || "+0";
	return `(GMT ${offset}) ${timeZone.replace(/_/g, " ")}`;
}

async function General({ params }: { params: Promise<ShopRoute> }) {
	const ctx = await loadShop(params);
	const api = getServerTrpcClient().pancakeSettings;
	const [settings, preferences] = await Promise.all([
		api.get.query({ shopId: ctx.shopId }),
		api.preferences.query({ shopId: ctx.shopId }),
	]);
	const currencies = withCurrent(
		GENERAL_SETTINGS.currencies.map((code) => ({ value: code, label: code })),
		settings.currency,
	);
	const timezones = withCurrent(
		GENERAL_SETTINGS.timezones.map((zone) => ({
			value: zone,
			label: offsetLabel(zone),
		})),
		settings.timezone,
	);
	const known = GENERAL_SETTINGS.countries.map((country) => ({
		value: country.code,
		label: `${country.flag} ${country.name}`,
	}));
	const countries = [
		...known,
		...settings.countries
			.filter((code) => !known.some((option) => option.value === code))
			.map((code) => ({ value: code, label: code })),
	];
	const sounds = preferences.sounds.map((sound) => ({
		value: sound,
		label:
			Object.entries(GENERAL_SETTINGS.sounds).find(
				([key]) => key === sound,
			)?.[1] ?? sound,
	}));
	const shops = ctx.shops
		.filter((shop) => shop.id !== ctx.shopId)
		.map((shop) => ({ value: shop.id, label: shop.name }));
	return (
		<SettingsFrame current="Cài đặt chung" className="px-5">
			<GeneralSettings
				shopId={ctx.shopId}
				shopName={ctx.shop.name}
				initialSettings={settings}
				initialPreferences={preferences}
				shops={shops}
				currencies={currencies}
				timezones={timezones}
				countries={countries}
				sounds={sounds}
			/>
		</SettingsFrame>
	);
}
