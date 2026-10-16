# Comp AI CRM và Pancake POS trên Windows

CRM chính: http://localhost:3100/sign-in

Bản mẫu riêng: http://localhost:3120/pancake-demo

API: http://localhost:3101/health

Mã nguồn: `D:\CRM\comp-ai-crm`. PostgreSQL chính dùng database `CRM` trên cổng 5432.

Database mẫu dùng PostgreSQL 18 trên cổng 55432. Database mẫu và database chính tách biệt.

## Đăng nhập

Google OAuth đã được cấu hình trong `.env`. `ALLOWED_SIGN_IN` chứa email quản trị được cung cấp.

Callback `http://localhost:3101/api/auth/callback/google` đã được thêm trong Google Cloud. Kiểm tra qua trình duyệt không còn lỗi `redirect_uri_mismatch`.

Giữ các callback hiện có của ứng dụng khác. CRM dùng Gmail và Calendar theo cơ chế upstream.

Lần đăng nhập đầu tiên tạo tài khoản owner. Hoàn tất tên workspace và website trong bước onboarding upstream.

Mở `/pancake` sau đăng nhập để vào module POS. Proxy chuyển sang URL có slug workspace.

Module POS không yêu cầu Context research key. Các chức năng nghiên cứu AI giữ thiết lập upstream.

## Credentials Pancake cần bổ sung

Chỉ cấu hình secrets trong `.env` tại root. Không gửi secrets trong chat hoặc commit vào Git.

```dotenv
PANCAKE_LIVE_SYNC_ENABLED="0"
PANCAKE_SHOPS_JSON='[{"id":"12345","name":"Shop A","apiKeyEnv":"PANCAKE_API_KEY_SHOP_A","webhookTokenEnv":"PANCAKE_WEBHOOK_TOKEN_SHOP_A"}]'
PANCAKE_API_KEY_SHOP_A=""
PANCAKE_WEBHOOK_TOKEN_SHOP_A=""
```

Mỗi shop cần ID chính xác và API key có quyền đọc dữ liệu shop.

[Pancake hướng dẫn tạo API key](https://docs.pancake.biz/pos/st-f13/st-p2?lang=en).

Account API key có quyền theo tài khoản. Shop API key có quyền quản trị trên shop.

[Pancake phân biệt account key và shop key](https://docs.pancake.biz/pos/st-f14/st-p2?lang=en).

Client của CRM chỉ gửi GET. Client không có hàm POST, PUT, PATCH hoặc DELETE tới POS.

## Webhook

Pancake hỗ trợ webhook `orders`, `customers` và `products` trong hợp đồng chính thức.

URL nhận: `https://<api-host>/api/integrations/pancake/webhook/12345`.

Header tùy chỉnh: `X-Pancake-Webhook-Token: <PANCAKE_WEBHOOK_TOKEN_SHOP_A>`.

Dùng token riêng có ít nhất 32 ký tự. API key POS và token webhook có mục đích khác nhau.

Cấu hình webhook bằng giao diện Pancake. CRM không đăng ký hoặc sửa webhook qua API POS.

Máy localhost chưa có URL HTTPS công khai. Worker dùng polling trong trạng thái này.

Webhook lưu yêu cầu đọc lại dữ liệu. Payload webhook không ghi đè trực tiếp đơn hàng.

Phiếu hoàn và nhân viên dùng polling. Polling tiếp tục hoạt động khi webhook không tới.

## Kiểm thử và cấu hình shop

Từ thư mục root, dùng Bun riêng của workspace:

```powershell
$env:PATH = 'D:\CRM\.tools\bun-windows-x64;' + $env:PATH
$env:TEST_DATABASE_URL = 'postgresql://crm_fixture@127.0.0.1:55432/comp_ai_crm_test?schema=public'
bun run pancake:test
bun run pancake:configure
```

Kiểm thử lưu bằng chứng và fingerprint mã nguồn trong `.scratch/pancake-verification.json`.

`pancake:configure` kiểm tra bằng chứng này. Mã nguồn thay đổi yêu cầu chạy kiểm thử lại.

Lệnh cấu hình tạo shop ở trạng thái dừng. Secrets không được ghi vào bảng shop.

Bật đọc dữ liệu thật cho một shop bằng thao tác quản trị rõ ràng:

```powershell
bun run pancake:configure --shop 12345 --approve-read-only
```

Sau đó đặt `PANCAKE_LIVE_SYNC_ENABLED="1"` trong `.env` và khởi động lại CRM.

Không chạy bước này trước khi hoàn tất API credentials và xác nhận shop cần nhập.

## Phân quyền

Owner và admin workspace quản lý tất cả shop. Các tài khoản khác cần quyền shop riêng.

| Vai trò shop | Quyền |
| --- | --- |
| MANAGER | Xem toàn shop và quản lý quyền nhân viên |
| TELESALE | Xem đơn được phân công và khách liên quan; cần ánh xạ nhân viên Pancake |
| VIEWER | Đọc dữ liệu toàn shop |

Mở Pancake POS → Shop và đồng bộ → Phân quyền nhân viên.

Phân quyền được kiểm tra ở server cho danh sách, chi tiết, lịch sử mua và báo cáo.

## Đồng bộ và báo cáo

Worker chạy riêng trong `apps/pancake-sync`. Worker không gọi AI, tạo AgentTask hoặc dùng model key.

Mỗi trang có transaction chứa dữ liệu và checkpoint. Trang lỗi không tiến checkpoint.

Polling chạy mỗi 60 giây. Khoảng cập nhật chồng 5 phút. Mỗi ngày có lượt đối chiếu toàn bộ.

Mỗi lượt xử lý tối đa 25 trang cho từng resource. Lượt tiếp theo tiếp tục trang còn lại.

Worker dùng khóa PostgreSQL theo shop. Bản ghi dùng khóa transaction và timestamp nguồn.

Đơn hàng duy nhất theo `(shopId, orderId)`. Nguồn cũ hoặc cùng phiên bản không ghi đè trạng thái mới.

Khách hàng không có timestamp nguồn dùng thời điểm bắt đầu đọc snapshot.

Một resource lỗi không dừng các resource khác. HTTP 429 dừng lượt shop và giữ thời gian retry.

Báo cáo giữ quy ước hiện tại của dự án: giá trị đơn lấy từ `shipping_fee`, chia 100 cho ngoại tệ. Người dùng xác nhận giữ quy ước ngày 15/10/2026. Mỗi loại tiền tệ được tổng hợp riêng cho trạng thái đã nhận và đã thu tiền.

Báo cáo không phải sổ kế toán. Báo cáo chưa đối soát phí, thuế hoặc tiền hoàn một phần.

Hiệu suất telesale dùng đơn được phân công, giao thành công, hủy, hoàn và doanh thu sản phẩm.

Tỷ lệ giao thành công không phải tỷ lệ chuyển đổi từ cuộc gọi.

## Vận hành

```powershell
.\scripts\windows\Stop-Crm.ps1
.\scripts\windows\Start-Crm.ps1 -Production
.\scripts\windows\Start-DemoPreview.ps1
```

Script chỉ dừng PID thuộc checkout CRM này. Script không dừng ToolSpy hoặc PostgreSQL chính.

Logs nằm trong `.logs`. Dữ liệu mẫu không được nạp vào database chính.

```powershell
bun run windows:deploy
```

Deploy chỉ chấp nhận `CRM` hoặc `comp_ai_crm`. Database có bảng hoặc migration ứng dụng khác bị từ chối.

Script không reset hoặc drop database. Schema được kiểm tra sau migration.

PostgreSQL mẫu giữ dữ liệu để kiểm tra lại. Cụm mẫu chưa được đăng ký thành Windows service.

CRM hiện chạy bằng tiến trình nền. Scheduled task `CompAI-CRM-Pancake` tự khởi động production khi người dùng Windows hiện tại đăng nhập. Task không khởi động bản mẫu hoặc cụm PostgreSQL mẫu.

Script `Register-CrmStartup.ps1` đã đăng ký task này. Có thể chạy lại script để cập nhật task của checkout CRM này.

## AI Agent

Mã nguồn và giao diện AI Agent upstream được giữ. Type-check Agent đạt.

Agent chưa chạy suy luận trong triển khai này. Agent cần `AI_GATEWAY_API_KEY` và cấu hình bridge riêng.

`AGENT_BRIDGE_SECRET` phải giống nhau giữa CRM và Agent. `AGENT_URL` trỏ tới Agent độc lập.

Sandbox upstream dùng Vercel, Docker hoặc microsandbox. Triển khai sandbox không Docker chưa được kiểm thử.

Không cần các credentials AI để đồng bộ Pancake.

## Automatic startup and recovery

The `CompAI-CRM-Pancake` Scheduled Task starts at Windows sign-in and checks CRM processes every minute.
It runs `Start-Crm.ps1 -Production -EnsureRunning` for the registered Windows account.
The account must have an active Windows session.

The starter preserves existing CRM processes and starts missing processes.
It refuses ports owned by another application.
A workspace lock prevents concurrent starters from creating duplicate processes.
The task retries failed starts three times at one-minute intervals.

```powershell
.\scripts\windows\Register-CrmStartup.ps1
.\scripts\windows\Start-Crm.ps1 -Production
```

`Stop-Crm.ps1` creates `.logs/runtime-paused` before stopping recorded CRM processes.
The task respects this file and does not undo an intentional stop.
Run `Start-Crm.ps1 -Production` without `-EnsureRunning` to resume recovery.

The starter only launches the Pancake worker with `PANCAKE_LIVE_SYNC_ENABLED="1"`.
Shop approval and fixture verification remain required by the worker.
A disabled worker does not count as a failed startup.

Startup errors are stored in `.logs/startup-error.log`.
Process IDs and creation times are stored in `.logs/processes.json`.
Monitor timing and ports are defined in `scripts/windows/Runtime-Config.psd1`.
