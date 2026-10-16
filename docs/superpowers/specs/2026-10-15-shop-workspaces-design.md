# Tách shop thành workspace, giao diện theo Pancake CRM — 15/10/2026

## Mục tiêu

Mỗi shop Pancake (UAE, Saudi, Kuwait) là một workspace riêng. Người dùng chọn
workspace ở góc trên trái, mọi màn hình bên dưới chỉ hiển thị dữ liệu của shop
đó. Giao diện, sidebar, bộ lọc, cột bảng và biểu mẫu bám theo ảnh chụp
`D:\CRM\PancakeCRMscreenshot`.

Đợt này làm frontend. Backend giữ nguyên router `pancake.*`; các màn hình chưa
có dữ liệu nguồn hiển thị trạng thái trống và biểu mẫu nối vào một điểm duy nhất
để nối API sau.

## Đường dẫn

| URL | Màn hình |
| --- | --- |
| `/[slug]/shop` | Chuyển tới shop đầu tiên được cấp quyền |
| `/[slug]/shop/[shopId]` | Trang chủ (Tổng quan) |
| `.../leads` | Tiềm năng (pipeline, bảng) |
| `.../contacts` | Liên hệ (từ khách hàng POS) |
| `.../calendar` | Lịch hẹn (tuần, ngày, tháng, bảng) |
| `.../products` | Bán hàng › Sản phẩm (từ POS) |
| `.../orders` | Bán hàng › Đơn hàng (từ POS, chi tiết dạng sheet) |
| `.../reports/business|customers|tasks|tickets|appointments` | Thống kê |
| `.../tickets` | Vấn đề |
| `.../settings/general|connections|automation|conversion-events|ai|audiences|tools|permissions|branches|history` | Cấu hình |
| `.../settings/tools/fields/[entity]` | Cấu hình › Bảng (trường của một collection) |

Route group `apps/app/app/(shop)` có layout riêng (sidebar xanh đậm + thanh trên),
không dùng icon rail của CRM upstream. Nút "Bảng điều khiển" trong bộ chọn
workspace quay về `/[slug]`.

## Giao diện

- Token màu `.theme-shop` trong `packages/ui/src/styles/globals.css`: nền
  `#f0f2f5`, thẻ trắng, primary `#1677ff`, sidebar `#1f3b5c`. Không ghi đè màu
  tại nơi gọi.
- Selector `:root:has(.theme-shop)` áp dụng token cho portal ngay từ SSR.
  Selector `:root.dark:has(.theme-shop)` áp dụng token tối. Không cần effect thêm class vào HTML.
- Badge có thêm biến thể màu đặc (blue, navy, orange, brown, teal, green, red,
  purple, gray) cho trạng thái đơn, ticket, tiềm năng.
- Thành phần dùng chung tại `apps/app/components/shop/`: shell, page header,
  filter chip, list table, empty state, record sheet (form sinh từ collection),
  report shell, calendar week.

## Collection (trường dữ liệu)

`apps/app/components/shop/collections.ts` là nguồn duy nhất cho tên trường,
kiểu, tuỳ chọn và nhóm của: tiềm năng, liên hệ, đơn hàng, sản phẩm, lịch hẹn,
vấn đề, nhiệm vụ. Bảng, biểu mẫu "Thêm mới" và màn "Cấu hình › Bảng" đều đọc
từ đây. Trường có `source: "pancake"` lấy từ dữ liệu POS đã đồng bộ; trường
`source: "crm"` chờ backend.

Tuỳ chọn được chọn theo mô hình chat-sale COD tại UAE/KSA/KW: nguồn khách
(Messenger, WhatsApp, Instagram, TikTok, Lead form, Website), quốc gia, thành
phố, ngôn ngữ, phương thức thanh toán (COD mặc định), hãng vận chuyển.

## Nối dữ liệu

| Màn hình | Nguồn |
| --- | --- |
| Trang chủ | `pancake.overview`, `pancake.report`, `pancake.tasks`, `pancake.customers` |
| Liên hệ | `pancake.customers`, `pancake.purchases` |
| Sản phẩm | `pancake.products` |
| Đơn hàng | `pancake.orders`, `pancake.detail`, `pancake.taskAssignees`, `pancake.createTask` |
| Thống kê › Kinh doanh | `pancake.report` |
| Thống kê › Nhiệm vụ | `pancake.tasks` |
| Cấu hình › Kết nối (POS) | `pancake.status` |
| Cấu hình › Phân quyền | `pancake.options`, `pancake.setMembership` |
| Cấu hình › Chi nhánh | `pancake.sellers` |
| Tiềm năng, Lịch hẹn, Vấn đề, Tự động hoá, Sự kiện chuyển đổi, Tệp khách hàng | Chưa có backend. Form gửi qua `submitRecord()` trong `actions.ts`, hiện báo "chưa nối API". |

Bộ lọc nằm trên URL (`range`, `from`, `to`, `q`, `status`, `sellerId`, `view`,
`page`, `orderId`, `customerId`). `range` là preset (today, yesterday, week,
last-week, month, last-month, 30d) và được quy ra `from`/`to` trước khi gọi API.

## Ngoài phạm vi đợt này

- Bảng mới trong PostgreSQL cho tiềm năng, lịch hẹn, vấn đề, tự động hoá.
- Chuỗi doanh thu theo ngày cho biểu đồ.
- Xuất Excel, thông báo đẩy, Zalo/Botcake.
- Xoá màn hình cũ `/[slug]/pancake` (giữ tới khi màn hình mới được duyệt).
