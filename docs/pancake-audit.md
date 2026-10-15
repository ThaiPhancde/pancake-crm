# Báo cáo triển khai ngày 14/10/2026

Checkout: `D:\CRM\comp-ai-crm`.

Nguồn: [trycompai/crm](https://github.com/trycompai/crm), nhánh `release`, phiên bản 1.15.3.

Commit nguồn: `6d4793dd6d7aeea91aa6a034e00b17d7408a2d08`. License MIT được giữ.

## Chức năng và kết quả

| Yêu cầu | Kết quả |
| --- | --- |
| Clone và audit | Hoàn tất. Giữ các module CRM, mailbox, Agent, chat và AI tools upstream |
| API Pancake chính thức | Client GET theo OpenAPI chính thức. Không scraping, không ghi ngược POS |
| Khách, đơn, sản phẩm, giao hàng, hoàn/hủy, nhân viên | Có schema, parser, persistence, worker và dữ liệu mẫu |
| Lịch sử và gia tăng | Có phân trang, checkpoint, overlap, đối chiếu toàn bộ và polling |
| Webhook | Có receiver, token riêng, queue bền vững, dedupe và retry; chưa kết nối webhook thật |
| Chống trùng và chống dữ liệu cũ | Khóa shop, khóa bản ghi, unique shop/order, kiểm tra phiên bản nguồn và lịch sử trạng thái |
| Giao diện | Có đơn hàng, khách, lịch sử mua, sản phẩm, vận chuyển, lọc, doanh thu và telesale |
| Nhiều shop và quyền | Có MANAGER, TELESALE, VIEWER; kiểm tra quyền ở server |
| Windows và PostgreSQL | Production dùng database CRM trên PostgreSQL 18 hiện có; không Docker |
| Độc lập AI | Worker không gọi model và không tạo AgentTask |
| Dữ liệu mẫu | 30 test đạt; 7 màn hình trình duyệt đạt; 5 kiểm tra HTTP mẫu đạt |

Production artifacts của API và Next.js build thành công. Agent type-check thành công.

Google OAuth trả HTTP 200 khi khởi tạo đăng nhập. Sau khi thêm callback `http://localhost:3101/api/auth/callback/google`, kiểm tra qua trình duyệt không còn lỗi `redirect_uri_mismatch` hoặc Google Error 400. Lần đăng nhập và cấp quyền tương tác đầu tiên vẫn cần chủ tài khoản thực hiện.

Scheduled task `CompAI-CRM-Pancake` đã được đăng ký để khởi động production khi người dùng Windows hiện tại đăng nhập. Bản mẫu không tự khởi động cùng task này.

Database CRM trống trước migration. Đã áp dụng 57 migration. Prisma xác nhận không có schema drift.

Database mẫu: `comp_ai_crm_test` và `comp_ai_crm_demo` trên PostgreSQL riêng, cổng 55432.

Database production không có dữ liệu mẫu hoặc dữ liệu Pancake thật.

API và giao diện chỉ bind loopback. PostgreSQL chính 5432, cổng 3000 và cổng 8000 giữ tiến trình ban đầu.

Không có thao tác xóa database. Không sửa file hoặc dịch vụ ToolSpy. Không gửi thao tác ghi tới POS.

## Hợp đồng API được đối chiếu

Nguồn chính thức: [Pancake POS OpenAPI](https://docs.pancake.biz/pos/api/openapi.json?lang=en).

| Resource | GET endpoint | Phân trang | Gia tăng |
| --- | --- | --- | --- |
| Đơn hàng | `/shops/{SHOP_ID}/orders` | page_number, page_size | updateStatus=updated_at, startDateTime, endDateTime |
| Khách hàng | `/shops/{SHOP_ID}/customers` | page_number, page_size | start_time_updated_at, end_time_updated_at |
| Sản phẩm và mẫu | `/shops/{SHOP_ID}/products/variations` | page_number, page_size | start_time_update, end_time_update |
| Phiếu hoàn | `/shops/{SHOP_ID}/orders_returned` | page, page_size | update_status=updated_at, start_time, end_time |
| Nhân viên | `/shops/{SHOP_ID}/users` | Danh sách | Đối chiếu định kỳ |

Webhook được xác nhận từ cấu hình shop và các schema `WebhookOrderResponse`, `WebhookCustomerResponse`, `WebhookProductResponse`.

Pancake cho phép cấu hình request headers. Receiver dùng token riêng qua header tùy chỉnh.

Không giả định có chữ ký HMAC từ Pancake. CRM không tự đăng ký webhook trên POS.

## Audit mã nguồn và dependency

CRM upstream có một workspace dùng chung. Contacts, companies và deals upstream giữ mô hình đó.

Dữ liệu khách POS nằm trong module Pancake. Module này có quyền shop riêng và không tự tạo Contact upstream.

API key POS chỉ được đọc từ environment. Bảng shop chỉ lưu tên biến chứa key.

Log HTTP đã bỏ query string. Log worker không chứa URL, API key hoặc payload khách hàng.

Telemetry được tắt trong các script khởi động. Worker có endpoint origin cố định và từ chối redirect.

Dependency audit ban đầu có 114 advisory, gồm 6 critical. Các bản vá giảm số lượng còn 31 advisory.

Kết quả còn lại: 0 critical, 10 high, 13 moderate, 8 low.

Đã vá Next.js 16.3.8, proxy-addr, shell-quote, SDK MCP, sharp, xmldom và nhiều dependency liên quan.

Các package còn cảnh báo: braces, deepmerge-ts, drizzle-orm, js-yaml, katex, sprintf-js và undici.

braces và sprintf-js chưa có bản vá công bố trong registry đã kiểm tra.

Các package khác cần nâng version có kiểm tra tương thích. Worker Pancake không dùng các vendor client AI này.

Các dependency còn cảnh báo được ghi đầy đủ trong [dependency-audit.json](./pancake-dependency-audit.json).

## Cần cấu hình hoặc kiểm chứng tiếp

1. NOT DONE — Chưa có shop ID và API key Pancake. Đồng bộ dữ liệu thật đang khóa.
   Fix: cấu hình `.env`, chạy kiểm thử và cấu hình shop theo [hướng dẫn Windows](./pancake-windows.md).
2. NOT DONE — Chưa có URL HTTPS công khai và webhook token cho từng shop.
   Fix: cấu hình webhook bằng giao diện Pancake; dùng polling trước khi có URL webhook.
3. NOT DONE — Chưa hoàn tất lần đăng nhập Google và cấp quyền tương tác đầu tiên.
   Fix: mở CRM, đăng nhập bằng email được cấp quyền và hoàn tất onboarding upstream. Callback đã cấu hình và kiểm tra không còn lỗi URI.
4. NOT DONE — AI Agent chưa chạy suy luận hoặc sandbox trên Windows.
   Fix: cấu hình gateway, bridge và sandbox riêng; giữ worker đồng bộ độc lập.
5. RISK — Dependency audit còn 10 advisory high. Bản vá chưa bao phủ toàn bộ dependency upstream.
   Fix: tiếp tục xử lý các version tương thích trước khi phục vụ CRM trên Internet.
6. NOT DONE — Báo cáo chưa đối soát kế toán, phí, thuế hoặc tiền hoàn một phần.
   Fix: bổ sung quy tắc tài chính và dữ liệu đối soát khi cần báo cáo doanh thu ròng.

## Bằng chứng

Test PostgreSQL, lỗi trang, checkpoint, phiên bản cũ, ghi đồng thời, quyền shop và quyền telesale đều đạt.

Kiểm thử resource lỗi xác nhận các resource còn lại tiếp tục đồng bộ.

Webhook lặp chỉ tạo một job. Webhook không tự cập nhật đơn trước khi worker đọc API.

Test so sánh AgentTask trước và sau đồng bộ xác nhận không tạo tác vụ AI.

Bằng chứng máy đọc được nằm trong `.scratch`. Secrets và session cookie mẫu không được đưa vào Git.

Ảnh báo cáo mẫu: [pancake-demo-report.png](./pancake-demo-report.png).
