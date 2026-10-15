# Cập nhật vận hành CRM — 15/10/2026

Áp dụng tại `D:\CRM\comp-ai-crm`, cùng commit nền với `ThaiPhancde/pancake-crm/main`: `c0af4ed`.

## Phạm vi

Giữ nền Next.js, NestJS, PostgreSQL và các chức năng CRM, AI Agent hiện có.

Tham khảo cách tổ chức khách hàng, đơn hàng và nhiệm vụ của [Pancake CRM](https://docs.pancake.biz/crm/intro) và [module Nhiệm vụ](https://docs.pancake.biz/crm/st-f2/st-p8?lang=vi). Trang `crm.pancake.vn` cần đăng nhập để xem đầy đủ. Bản này dùng tài liệu công khai để thiết kế luồng vận hành, không sao chép giao diện nội bộ.

## Chức năng đã bổ sung

- Tổng quan vận hành: đơn chờ xử lý, đang giao, hoàn hàng, chưa phân công và công việc quá hạn.
- Mở nhóm từ tổng quan để đi thẳng vào danh sách đã lọc.
- Danh sách có sắp xếp ngày tạo/cập nhật và bộ chọn nhân viên theo tên.
- Bộ lọc nâng cao thu gọn. Đường dẫn chứa bộ lọc và giữ được trạng thái khi chia sẻ.
- Bộ lọc sai ngày hoặc số trang được đặt lại với thông báo, thay vì làm hỏng trang.
- Tạo công việc và ghi chú từ chi tiết đơn; giao cho tài khoản CRM có quyền trên đơn.
- Xem việc đang mở, quá hạn, của tôi hoặc hoàn tất; hoàn tất và mở lại.
- Chặn tạo trùng khi gửi lại yêu cầu. Chặn cập nhật từ phiên bản công việc cũ.
- Hiển thị tên shop và tên người xử lý. Giữ các chỉnh sửa tên nhân viên có sẵn trước đợt này.
- Hiển thị đủ ba chữ số thập phân cho KWD.
- Cảnh báo lịch sử chưa nhập đầy đủ. Trạng thái đồng bộ tính cả cờ bật worker.

Công việc và ghi chú nằm trong CRM. Chúng không sửa đơn hay nhân viên trên POS.

MANAGER quản lý công việc trong shop. TELESALE thao tác trên đơn được phân công và công việc của mình. VIEWER chỉ xem.

Thông báo quá hạn xuất hiện trong CRM. Bản này chưa gửi email hoặc tin nhắn nhắc việc.

## Tốc độ và tính ổn định

Các lượt đọc độc lập của trang chạy song song. Danh sách lấy tối đa 25 dòng mặc định; API giới hạn 100 dòng.

Truy vấn danh sách không trả payload POS thô. Tìm nhân viên được giới hạn trong shop được cấp quyền.

Thêm index cho đơn theo thời điểm cập nhật, nhân viên/ngày tạo và công việc theo người phụ trách/trạng thái/hạn.

Migration chỉ thêm bảng, enum, index và khóa ngoại. Không xóa hoặc reset dữ liệu.

Đo 10 lần sau khi làm nóng kết nối, trên 300 đơn tại máy hiện tại:

| Truy vấn backend | Trung vị | P95 |
| --- | ---: | ---: |
| Đơn hàng | 10 ms | 16 ms |
| Tổng quan | 7 ms | 21 ms |
| Báo cáo | 5 ms | 6 ms |
| Công việc | 10 ms | 12 ms |

Script Windows lưu thêm thời điểm khởi chạy để nhận diện PID được tái sử dụng. Script dừng bỏ qua tiến trình khác.

Đây là thời gian truy vấn backend trên bộ dữ liệu nhỏ. Số liệu không đại diện cho thời gian tải toàn trang hoặc tải đồng thời lớn.

## MCP

Đã rà soát [nguyennguyenit/pancake-pos-mcp](https://github.com/nguyennguyenit/pancake-pos-mcp), commit `c9a67faf0a58f48aaf24ef702455ddaac84054a5`, MIT.

Repo tham khảo gộp thao tác đọc, tạo, sửa và xóa trong các tool. Các thao tác ghi đó vượt phạm vi được phép của dự án này.

Dự án có adapter MCP riêng tại `apps/pancake-mcp`, dùng SDK MCP và dữ liệu đã đồng bộ trong PostgreSQL.

| Tool | Chức năng |
| --- | --- |
| `crm_list_shops` | Shop được cấp quyền và trạng thái đồng bộ |
| `crm_list_orders` | Danh sách đơn có lọc và phân trang |
| `crm_order_detail` | Chi tiết, lịch sử trạng thái và giao hàng |
| `crm_list_customers` | Tìm khách hàng trong phạm vi quyền |
| `crm_customer_purchases` | Lịch sử mua theo shop và khách |
| `crm_sales_report` | Báo cáo theo quy ước tiền hiện tại |
| `crm_operations_overview` | Các nhóm đơn cần xử lý |
| `crm_list_tasks` | Công việc CRM, hạn và người phụ trách |

MCP kiểm tra tài khoản CRM, danh sách email được phép và quyền shop hiện tại cho mỗi lần gọi. Kết quả không chứa API key, tên biến chứa key hoặc payload nguồn thô.

MCP chạy qua stdio trên máy cục bộ, không mở HTTP server. Một tiến trình dùng quyền của một tài khoản được cấu hình. Giữ quyền tối thiểu cho tài khoản này.

Đồng bộ không gọi model. MCP cũng không tự gọi model. Phần mềm AI kết nối MCP vẫn sử dụng token của phần mềm đó.

### Cấu hình tùy chọn

Sau khi đăng nhập Google và có tài khoản CRM, điền email của tài khoản đó trong root `.env`:

```dotenv
PANCAKE_MCP_USER_EMAIL="email-tai-khoan-crm"
```

Để trống biến này để tắt MCP. Không cần thêm key Pancake cho MCP.

Chạy từ root:

```powershell
D:\CRM\.tools\bun-windows-x64\bun.exe run pancake:mcp
```

Cấu hình cho phần mềm hỗ trợ MCP stdio:

```json
{
  "mcpServers": {
    "pancake-crm": {
      "command": "D:\\CRM\\.tools\\bun-windows-x64\\bun.exe",
      "args": ["run", "--cwd", "D:\\CRM\\comp-ai-crm", "apps/pancake-mcp/src/main.ts"]
    }
  }
}
```

Server MCP đọc database trên máy tin cậy. Chỉ trả kết quả cho phần mềm AI; không cấp database URL cho sandbox Agent.

## Kiểm chứng

- 44 test đạt: đồng bộ, transaction, dữ liệu cũ, quyền shop/telesale, công việc, bộ lọc và giao thức MCP.
- 13 kiểm tra trình duyệt đạt trên database mẫu: tạo việc, hoàn tất, mở lại, việc quá hạn, các module và màn hình di động.
- MCP stdio thực tế đọc được 3 shop, 300 đơn; mỗi trang trả 25 dòng. Không gọi AI hoặc API POS trong lượt kiểm tra MCP.
- Type-check của package Pancake, MCP, API, giao diện và AI Agent đạt.
- API và Next.js production build thành công; 4 kiểm tra HTTP production đạt.
- Schema sau migration không có drift. Số lượng 300 đơn, 594 khách, 271 sản phẩm và 823 nhân viên được giữ.
- Test URL trong `.env.example` và cấu hình test cục bộ trỏ tới database fixture riêng.
- Bằng chứng không chứa credentials nằm trong `.scratch/rebuild-*.json` và `.scratch/workflow-browser-verification.json`.

Ảnh dữ liệu giả lập: [tổng quan](./pancake-overview-demo.png), [công việc](./pancake-workflow-demo.png).

## Các giới hạn cần theo dõi

1. NOT DONE — Lịch sử Pancake hiện mới có 100 đơn mỗi shop, tổng 300 đơn. Báo cáo chưa bao phủ toàn bộ lịch sử.
   Fix: tiếp tục đồng bộ theo checkpoint khi vận hành nhập lịch sử.
2. NOT DONE — Doanh thu chưa đối soát. Người dùng xác nhận giữ quy ước `shipping_fee`, chia 100 cho ngoại tệ.
   Fix: đối chiếu với báo cáo shop trước khi thay đổi quy tắc. Bản này giữ nguyên số tiền đang lưu.
3. NOT DONE — Chưa có webhook HTTPS riêng. Đồng bộ sử dụng polling khi worker được bật.
   Fix: cấu hình endpoint và token riêng, giữ webhook đối soát đang có.
4. NOT DONE — AI Agent chưa có kiểm chứng suy luận và sandbox trên Windows.
   Fix: cấu hình gateway/bridge/sandbox riêng. MCP đã kiểm chứng ở tầng giao thức và đọc dữ liệu.
5. RISK — Audit dependency trước đợt này còn 10 advisory high trong dependency upstream.
   Fix: xử lý các bản nâng tương thích trước khi mở CRM ra Internet; xem [audit](./pancake-audit.md).
6. NOT DONE — Chưa kiểm thử tải lớn và gửi nhắc việc ra ngoài CRM.
   Fix: kiểm thử với dung lượng thực tế trước khi tăng số nhân viên; cấu hình kênh nhắc việc khi có yêu cầu.
