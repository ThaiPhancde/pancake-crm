import { db } from "@crm/db";
import { NextResponse } from "next/server";

export const maxDuration = 30; // 30s timeout on Vercel

const STATUS_MAP: Record<number, string> = {
	0: "Mới",
	17: "Chờ xác nhận",
	11: "Chờ hàng",
	12: "Chờ in",
	13: "Đã in",
	20: "Đã đặt hàng",
	1: "Đã xác nhận",
	8: "Đang đóng hàng",
	9: "Chờ chuyển hàng",
	2: "Đã gửi hàng",
	3: "Đã nhận",
	16: "Đã thu tiền",
	4: "Đang hoàn",
	15: "Hoàn một phần",
	5: "Đã hoàn",
	6: "Đã hủy",
	7: "Đã xóa",
};

const TOOLS = [
	{
		type: "function",
		function: {
			name: "search_orders",
			description: "Tra cứu đơn hàng Pancake theo mã đơn, số điện thoại, tên khách hàng hoặc mã vận đơn.",
			parameters: {
				type: "object",
				properties: {
					query: { type: "string", description: "Mã đơn, SĐT, tên khách, hoặc mã tracking" },
					shopId: { type: "string", description: "Mã Shop nếu cần lọc" },
					limit: { type: "number", description: "Số lượng đơn cần lấy (mặc định 10)" },
				},
			},
		},
	},
	{
		type: "function",
		function: {
			name: "get_customer_history",
			description: "Tra cứu lịch sử mua hàng, tổng chi tiêu và đánh giá rủi ro bom hàng (COD risk) theo SĐT hoặc tên khách hàng.",
			parameters: {
				type: "object",
				properties: {
					query: { type: "string", description: "Số điện thoại hoặc tên khách hàng" },
					shopId: { type: "string", description: "Mã shop nếu có" },
				},
				required: ["query"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "get_shop_summary",
			description: "Thống kê doanh thu, số đơn, tỉ lệ hoàn/hủy theo từng shop (UAE, Saudi, Kuwait...) trong số ngày qua.",
			parameters: {
				type: "object",
				properties: {
					shopId: { type: "string", description: "Mã shop cần thống kê (bỏ trống nếu muốn xem tất cả)" },
					days: { type: "number", description: "Số ngày phân tích (mặc định 30)" },
				},
			},
		},
	},
];

async function executeTool(name: string, args: any) {
	try {
		if (name === "search_orders") {
			const text = args.query?.trim();
			const where: any = {};
			if (args.shopId) where.shopId = args.shopId;
			if (text) {
				const digitsOnly = text.replace(/\D/g, "");
				where.OR = [
					{ orderId: { contains: text, mode: "insensitive" } },
					{ customerPhone: { contains: text } },
					...(digitsOnly.length >= 6 ? [{ customerPhone: { contains: digitsOnly } }, { customerPhone: { contains: digitsOnly.slice(-9) } }] : []),
					{ customerName: { contains: text, mode: "insensitive" } },
					{ trackingCode: { contains: text, mode: "insensitive" } },
				];
			}
			const orders = await db.pancakeOrder.findMany({
				where,
				take: args.limit || 10,
				orderBy: { sourceCreatedAt: "desc" },
				include: { shop: { select: { name: true } } },
			});

			if (orders.length === 0) {
				return {
					found: false,
					message: `Không tìm thấy đơn hàng nào khớp với từ khóa "${text}" trong cơ sở dữ liệu.`,
				};
			}

			return {
				found: true,
				count: orders.length,
				orders: orders.map((o) => ({
					orderId: o.orderId,
					shop: o.shop.name,
					customer: o.customerName,
					phone: o.customerPhone,
					status: STATUS_MAP[o.status] ?? `Mã ${o.status}`,
					totalPrice: Number(o.totalPrice),
					currency: o.currency,
					trackingCode: o.trackingCode,
					date: o.sourceCreatedAt.toISOString().split("T")[0],
				})),
			};
		}

		if (name === "get_customer_history") {
			const text = args.query?.trim();
			const digitsOnly = text ? text.replace(/\D/g, "") : "";
			const where: any = {};
			if (args.shopId) where.shopId = args.shopId;
			where.OR = [
				{ phone: { contains: text } },
				...(digitsOnly.length >= 6 ? [{ phone: { contains: digitsOnly } }, { phone: { contains: digitsOnly.slice(-9) } }] : []),
				{ name: { contains: text, mode: "insensitive" } },
			];
			const customers = await db.pancakeCustomer.findMany({
				where,
				take: 5,
				include: {
					shop: { select: { name: true } },
					orders: {
						orderBy: { sourceCreatedAt: "desc" },
						take: 15,
						select: { orderId: true, status: true, totalPrice: true, currency: true, sourceCreatedAt: true },
					},
				},
			});

			if (customers.length === 0) {
				return {
					found: false,
					message: `Không tìm thấy khách hàng nào có thông tin "${text}" trong cơ sở dữ liệu.`,
				};
			}

			return {
				found: true,
				customers: customers.map((c) => {
					const total = c.orders.length;
					const success = c.orders.filter((o) => [3, 16].includes(o.status)).length;
					const returned = c.orders.filter((o) => [4, 5, 15].includes(o.status)).length;
					const spent = c.orders
						.filter((o) => [3, 16].includes(o.status))
						.reduce((acc, o) => acc + Number(o.totalPrice), 0);

					return {
						name: c.name,
						phone: c.phone,
						shop: c.shop.name,
						totalOrders: total,
						successOrders: success,
						returnedOrders: returned,
						totalSpent: spent,
						codRiskWarning: returned > 0 ? `Cảnh báo: Khách từng có ${returned} đơn hoàn/hủy!` : "Uy tín tốt, không có đơn hoàn.",
						recentOrders: c.orders.slice(0, 5).map((o) => ({
							orderId: o.orderId,
							status: STATUS_MAP[o.status] ?? `Mã ${o.status}`,
							price: Number(o.totalPrice),
							currency: o.currency,
							date: o.sourceCreatedAt.toISOString().split("T")[0],
						})),
					};
				}),
			};
		}

		if (name === "get_shop_summary") {
			const days = args.days || 30;
			const since = new Date(Date.now() - days * 86_400_000);
			const shops = await db.pancakeShop.findMany({
				where: args.shopId ? { id: args.shopId } : undefined,
				select: { id: true, name: true },
			});

			return await Promise.all(
				shops.map(async (shop) => {
					const orders = await db.pancakeOrder.findMany({
						where: { shopId: shop.id, sourceCreatedAt: { gte: since } },
						select: { status: true, totalPrice: true, currency: true },
					});
					let rev = 0;
					let delivered = 0;
					let returned = 0;
					for (const o of orders) {
						if ([3, 16].includes(o.status)) { rev += Number(o.totalPrice); delivered++; }
						else if ([4, 5, 15].includes(o.status)) { returned++; }
					}
					return {
						shop: shop.name,
						totalOrders: orders.length,
						delivered,
						returned,
						returnRate: orders.length > 0 ? `${((returned / orders.length) * 100).toFixed(1)}%` : "0%",
						deliveredRevenue: rev,
						currency: orders[0]?.currency ?? "USD",
					};
				}),
			);
		}
	} catch (err: any) {
		return { error: err.message };
	}

	return { error: `Tool ${name} not found.` };
}

export async function POST(req: Request) {
	try {
		const apiKey = process.env.AI_GATEWAY_API_KEY;
		if (!apiKey) {
			return NextResponse.json(
				{ error: "AI Gateway API Key chưa được cấu hình. Vui lòng thêm biến AI_GATEWAY_API_KEY trên Vercel." },
				{ status: 500 }
			);
		}

		const body = await req.json();
		const { messages, shopId } = body;

		if (!Array.isArray(messages) || messages.length === 0) {
			return NextResponse.json({ error: "Messages array is required." }, { status: 400 });
		}

		const systemPrompt = {
			role: "system",
			content: `Bạn là trợ lý AI thông minh chuyên quản lý bán hàng Pancake POS cho các thị trường (UAE, Saudi, Kuwait).
Mã Shop hiện tại đang xem: ${shopId || "Tất cả các shop"}.
Khi người dùng hỏi về đơn hàng, vận đơn, kiểm tra khách hàng, số điện thoại, bom hàng hay doanh số, hãy TỰ ĐỘNG GỌI CÔNG CỤ (Tool) để tra cứu dữ liệu thực tế từ Database.
SAU KHI GỌI TOOL: Hãy đọc kỹ kết quả tool trả về và trả lời người dùng một cách chi tiết, cụ thể và hữu ích bằng tiếng Việt:
- Nếu tìm thấy dữ liệu: Tóm tắt rõ ràng tên khách, số điện thoại, số đơn, trạng thái, doanh thu.
- Nếu KHÔNG tìm thấy dữ liệu: Báo rõ cho người dùng biết là chưa có dữ liệu của số điện thoại/mã đơn này trong hệ thống của shop, và gợi ý người dùng kiểm tra lại định dạng số điện thoại. TUYỆT ĐỐI không trả lời cụt lủn hay trả lời rỗng.`,
		};

		const formattedMessages = [systemPrompt, ...messages];

		// Use openai/gpt-4o-mini as primary for reliable tool execution & clean Vietnamese synthesis
		const model = "openai/gpt-4o-mini";
		const gatewayRes = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model,
				messages: formattedMessages,
				tools: TOOLS,
				max_tokens: 1200,
			}),
		});

		const data = await gatewayRes.json();
		if (!gatewayRes.ok) {
			return NextResponse.json(
				{ error: data.error?.message || "Lỗi gọi Vercel AI Gateway." },
				{ status: gatewayRes.status }
			);
		}

		const choice = data.choices?.[0];
		if (!choice) {
			return NextResponse.json({ reply: "Không nhận được phản hồi từ AI." });
		}

		const toolCalls = choice.message?.tool_calls;
		if (toolCalls && toolCalls.length > 0) {
			// Execute tools
			const toolResults = await Promise.all(
				toolCalls.map(async (call: any) => {
					let parsedArgs = {};
					try {
						parsedArgs = JSON.parse(call.function.arguments);
					} catch {}
					const result = await executeTool(call.function.name, parsedArgs);
					return {
						role: "tool",
						tool_call_id: call.id,
						name: call.function.name,
						content: JSON.stringify(result),
					};
				})
			);

			// Clean assistant message for follow-up
			const cleanAssistantMsg = {
				role: "assistant",
				content: choice.message.content || null,
				tool_calls: choice.message.tool_calls,
			};

			// Call model again with tool results
			const followUpRes = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model,
					messages: [...formattedMessages, cleanAssistantMsg, ...toolResults],
					max_tokens: 1200,
				}),
			});

			const followUpData = await followUpRes.json();
			const finalReply = followUpData.choices?.[0]?.message?.content;
			return NextResponse.json({
				reply: finalReply || "Đã kiểm tra xong nhưng không nhận được nội dung trả về từ AI.",
				modelUsed: model,
				toolsCalled: toolCalls.map((c: any) => c.function.name),
			});
		}

		return NextResponse.json({
			reply: choice.message?.content || "",
			modelUsed: model,
		});
	} catch (error: any) {
		console.error("[pancake-ai-chat] Error:", error);
		return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
	}
}
