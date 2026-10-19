export const REPORT_GROUPINGS = [
	{ value: "day", label: "Ngày" },
	{ value: "week", label: "Tuần" },
	{ value: "month", label: "Tháng" },
] as const;

export type ReportGrouping = (typeof REPORT_GROUPINGS)[number]["value"];

export const GENDER_ROWS = [
	{ key: "male", label: "Nam", color: "#1d4ed8" },
	{ key: "female", label: "Nữ", color: "#ef4444" },
	{ key: "other", label: "Khác", color: "#a855f7" },
	{ key: "unknown", label: "Chưa có thông tin", color: "#9ca3af" },
] as const;

export const AGE_ROWS = [
	{ key: "<18", label: "Dưới 18 tuổi", color: "#0ea5e9" },
	{ key: "18-24", label: "Từ 18 đến 24 tuổi", color: "#22c55e" },
	{ key: "25-34", label: "Từ 25 đến 34 tuổi", color: "#eab308" },
	{ key: "35-44", label: "Từ 35 đến 44 tuổi", color: "#f97316" },
	{ key: "45-54", label: "Từ 45 đến 54 tuổi", color: "#ef4444" },
	{ key: "55+", label: "Trên 55 tuổi", color: "#8b5cf6" },
	{ key: "unknown", label: "Chưa có thông tin", color: "#9ca3af" },
] as const;

export const PURCHASE_ROWS = [
	{ key: "1", label: "1" },
	{ key: "2", label: "2" },
	{ key: "3", label: "3" },
	{ key: "4", label: "4" },
	{ key: ">4", label: "> 4" },
] as const;

export const REPORTS = {
	percentScale: 100,
	trendHeight: 220,
	targetProgressMax: 100,
	exportMaxRows: 5000,
} as const;
