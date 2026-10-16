# Bàn giao: tách shop thành workspace (giao diện Pancake CRM) — 15/10/2026

Spec thiết kế: `docs/superpowers/specs/2026-10-15-shop-workspaces-design.md`.
Ảnh tham chiếu: `D:\CRM\PancakeCRMscreenshot\`.

## Đã làm (chưa commit, đang nằm trong working tree)

| Khu vực | File |
| --- | --- |
| Token màu Pancake (`.theme-shop`, light + dark) | `packages/ui/src/styles/globals.css` |
| Badge màu trạng thái (blue, navy, orange, brown, teal, green, red, purple, gray, soft-*) | `packages/ui/src/components/badge.tsx` |
| Rail CRM cũ: mục "Pancake CRM" trỏ `/shop`; export `UserMenu` | `apps/app/components/app-icon-rail.tsx`, `app-header.tsx` |
| Shell workspace (sidebar navy, bộ chọn shop, topbar, thông báo, tự động hoá) | `apps/app/components/shop/shell.tsx`, `automation-center.tsx`, `notification-panel.tsx`, `nav.ts` |
| Collection trường dữ liệu (lead, contact, order, product, appointment, ticket, task) | `apps/app/components/shop/collections.ts` |
| Thành phần dùng chung: page frame, filter chip/toolbar, list table, empty state, record form (Sheet), report frame, calendar, range picker | `apps/app/components/shop/*.tsx` |
| Route group mới `/[slug]/shop/[shopId]/...` (26 trang) | `apps/app/app/(shop)/` |
| Test preset ngày | `apps/app/components/shop/range.spec.ts` (5 pass) |

Trạng thái kiểm chứng:

- `tsc` app + packages/ui: sạch.
- biome, oxlint anti-slop, knip: sạch trên file mới.
- `bun test` app: 178 pass.
- `next build`: lần cuối lỗi vì Map key thiếu dấu nháy ở `leads/page.tsx` (đã sửa ngay sau đó, tsc sạch) nhưng **chưa chạy lại build tới cùng**.

## Việc dang dở, cần làm ngay

1. Chạy lại `bun run build` trong `apps/app` và xác nhận không có xung đột route giữa `(app)/[slug]` và `(shop)/[slug]`.
2. Chạy dev (`bun run dev`), đăng nhập, mở `/[slug]/shop` → kiểm tra redirect sang shop đầu tiên, bộ chọn shop ở góc trái, từng mục sidebar.
3. Kiểm tra portal (dropdown, sheet, dialog) có nhận token `.theme-shop` sau hydrate (shell thêm class vào `<html>` trong `useEffect`). Nếu nháy màu xanh lá lúc SSR, cân nhắc đặt class ở layout gốc theo cookie.
4. Kiểm tra dark mode của `.dark .theme-shop`.
5. Review mobile: sidebar dạng Sheet, bảng cuộn ngang.
6. Commit theo quy ước repo (không `Co-Authored-By`).

## Việc tiếp theo (backend + nối luồng)

1. **Tiềm năng, Lịch hẹn, Vấn đề**: chưa có bảng DB. Hiện form gửi qua `components/shop/actions.ts#submitRecord` và báo "chưa nối API". Cần: Prisma model + migration (theo shop), router `pancake.leads/appointments/tickets` (list, create, update, status), rồi thay `submitRecord`.
2. **Bộ lọc chưa có backend**: `assignee`, `creator`, `source`, `quick`, `orderBy`, `where`, `type`, `category`, `priority`, `contactStatus` chỉ nằm trên URL. Backend `listInput` mới hỗ trợ `q, status, sellerId, from, to, view, sort, page`.
3. **Chuỗi theo ngày cho biểu đồ** (doanh thu, nhiệm vụ): thêm query groupBy ngày, nối vào `AreaTrend` (`@crm/ui/components/dashboard-chart`) ở Trang chủ và Thống kê › Kinh doanh.
4. **Cột đơn hàng còn trống**: Giảm giá, Còn lại, Nguồn, Sản phẩm (cần đọc thêm từ `raw` của PancakeOrder trong `packages/pancake/src/queries.ts`).
5. **Liên hệ**: Thẻ Pancake, Ngày sinh, Nguồn, Trạng thái vòng đời, Số lần mua, Tổng chi tiêu → cần aggregate đơn theo số điện thoại (`phoneTail`).
6. **Sản phẩm**: Hình ảnh, Danh mục, Mô tả → lấy từ `raw` của PancakeProduct.
7. **Thống kê › Khách hàng**: phân tích số lần mua (1,2,3,4,>4), giới tính, độ tuổi.
8. **Cấu hình**: Cài đặt chung (lưu tiền tệ/múi giờ/toggle), Tự động hoá, Sự kiện chuyển đổi, Tệp khách hàng, Chi nhánh, Lịch sử — hiện là giao diện tĩnh, nút chính bị `disabled`.
9. **Cấu hình › Bảng (fields editor)**: hiện render từ `collections.ts`, chưa lưu thêm/sắp xếp trường. Cần bảng `ShopFieldDefinition` nếu muốn tuỳ biến theo shop.
10. **Múi giờ**: preset ngày (`range.ts`) và `parseFilters` đang dùng +07:00. Shop UAE/KSA/KW là +4/+3; đổi theo `shopProfile(shopId).timezone` khi backend nhận timezone.
11. **Xoá màn hình cũ** `apps/app/app/(app)/[slug]/pancake/*`, `components/pancake/screen.tsx`, `filters.tsx`, `operations-panel.tsx`, `task-panel.tsx` và trang `pancake-demo` sau khi màn hình mới được duyệt (giữ `filter-state.ts`, `format.ts`, `task-actions.tsx` vì màn mới dùng).
12. Cập nhật `docs/pancake-rebuild.md` và `README.md` với URL mới.

## Issues

1. NOT DONE — `next build` chưa chạy lại sau khi sửa lỗi Map key ở `leads/page.tsx`.
   Fix: `cd apps/app && bun run build`.
2. NOT DONE — Tiềm năng, Lịch hẹn, Vấn đề, Tự động hoá chưa có backend. Form báo "chưa nối API".
   Fix: mục "Việc tiếp theo" 1.
3. RISK — Token `.theme-shop` cho portal chỉ áp dụng sau hydrate.
   Fix: kiểm tra thực tế; nếu nháy màu, đặt class ở layout gốc.
4. RISK — Preset ngày dùng múi giờ +07:00 trong khi shop ở +3/+4.
   Fix: mục "Việc tiếp theo" 10.
5. NOT DONE — Màn hình cũ `/[slug]/pancake` vẫn tồn tại song song.
   Fix: xoá sau khi duyệt màn mới.
6. NOT DONE — Chưa chạy kiểm tra trình duyệt (dev server) cho màn mới.
   Fix: mục "Việc dang dở" 2–5.
