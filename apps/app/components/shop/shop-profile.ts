import { PANCAKE, shopTimezone } from "@crm/pancake/config";

export type ShopProfile = {
	country: string;
	countryCode: string;
	flag: string;
	currency: string;
	timezone: string;
	timezoneLabel: string;
	dialCode: string;
	cities: string[];
};

type StaticProfile = Omit<ShopProfile, "currency" | "timezone">;

const PROFILES = new Map<string, StaticProfile>(
	Object.entries({
		"1635200759": {
			country: "United Arab Emirates",
			countryCode: "AE",
			flag: "🇦🇪",
			timezoneLabel: "(GMT +4:00) Abu Dhabi, Dubai",
			dialCode: "971",
			cities: [
				"Dubai",
				"Abu Dhabi",
				"Sharjah",
				"Ajman",
				"Al Ain",
				"Ras Al Khaimah",
			],
		},
		"1328205216": {
			country: "Saudi Arabia",
			countryCode: "SA",
			flag: "🇸🇦",
			timezoneLabel: "(GMT +3:00) Riyadh",
			dialCode: "966",
			cities: ["Riyadh", "Jeddah", "Dammam", "Mecca", "Medina", "Khobar"],
		},
		"1328205226": {
			country: "Kuwait",
			countryCode: "KW",
			flag: "🇰🇼",
			timezoneLabel: "(GMT +3:00) Kuwait",
			dialCode: "965",
			cities: [
				"Kuwait City",
				"Hawalli",
				"Salmiya",
				"Farwaniya",
				"Ahmadi",
				"Jahra",
			],
		},
	} satisfies Record<string, StaticProfile>),
);

const FALLBACK: StaticProfile = {
	country: "Việt Nam",
	countryCode: "VN",
	flag: "🇻🇳",
	timezoneLabel: "(GMT +7:00) Bangkok, Hanoi, Jakarta",
	dialCode: "84",
	cities: [],
};

export function shopProfile(shopId: string): ShopProfile {
	const profile = PROFILES.get(shopId) ?? FALLBACK;
	return {
		...profile,
		currency: PANCAKE.shopCurrency.get(shopId) ?? "VND",
		timezone: shopTimezone(shopId),
	};
}

export function shopInitial(name: string): string {
	return name.trim().charAt(0).toUpperCase() || "S";
}
