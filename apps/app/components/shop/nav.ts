import Calendar from "@carbon/icons-react/es/Calendar";
import ChartBar from "@carbon/icons-react/es/ChartBar";
import Chat from "@carbon/icons-react/es/Chat";
import Home from "@carbon/icons-react/es/Home";
import Network_3 from "@carbon/icons-react/es/Network_3";
import Settings from "@carbon/icons-react/es/Settings";
import Store from "@carbon/icons-react/es/Store";
import Ticket from "@carbon/icons-react/es/Ticket";
import UserMultiple from "@carbon/icons-react/es/UserMultiple";
import type { CarbonIcon } from "@crm/ui/components/icon";

export type NavItem = {
	title: string;
	href: string;
	icon?: CarbonIcon;
	exact?: boolean;
	children?: NavItem[];
};

export const SHOP_NAV: NavItem[] = [
	{ title: "Trang chủ", href: "", icon: Home, exact: true },
	{ title: "Tiềm năng", href: "/leads", icon: Network_3 },
	{ title: "Liên hệ", href: "/contacts", icon: UserMultiple },
	{ title: "Hội thoại", href: "/conversations", icon: Chat },
	{ title: "Lịch hẹn", href: "/calendar", icon: Calendar },
	{
		title: "Bán hàng",
		href: "/sales",
		icon: Store,
		children: [
			{ title: "Sản phẩm", href: "/products" },
			{ title: "Đơn hàng", href: "/orders" },
		],
	},
	{
		title: "Thống kê",
		href: "/reports",
		icon: ChartBar,
		children: [
			{ title: "Kinh doanh", href: "/reports/business" },
			{ title: "Khách hàng", href: "/reports/customers" },
			{ title: "Nhiệm vụ", href: "/reports/tasks" },
			{ title: "Vấn đề", href: "/reports/tickets" },
			{ title: "Lịch hẹn", href: "/reports/appointments" },
		],
	},
	{ title: "Vấn đề", href: "/tickets", icon: Ticket },
	{
		title: "Cấu hình",
		href: "/settings",
		icon: Settings,
		children: [
			{ title: "Cài đặt chung", href: "/settings/general" },
			{ title: "Kết nối", href: "/settings/connections" },
			{ title: "Tự động hoá", href: "/settings/automation" },
			{ title: "Sự kiện chuyển đổi", href: "/settings/conversion-events" },
			{ title: "Trợ lý AI", href: "/settings/ai" },
			{ title: "Tệp khách hàng", href: "/settings/audiences" },
			{ title: "Công cụ", href: "/settings/tools" },
			{ title: "Phân quyền", href: "/settings/permissions" },
			{ title: "Chi nhánh", href: "/settings/branches" },
			{ title: "Lịch sử", href: "/settings/history" },
		],
	},
];
