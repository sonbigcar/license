# REVITHUB - NỀN TẢNG THƯƠNG MẠI ĐIỆN TỬ BÁN REVIT FAMILY & REVIT TOOLS

Hệ thống website thương mại điện tử chuyên nghiệp phục vụ cộng đồng BIM/AEC:
- **Bán Revit Family (.RFA):** Mua trọn đời, xác thực thanh toán tự động VietQR, cấp link tải bảo mật Signed URL 15 phút (không lộ link direct storage).
- **Bán Revit Tools (Add-in/Plugin):** Thuê bao tháng/năm, cấp License Key quản lý số lượng máy (HWID/Machine ID), tích hợp API xác thực bản quyền trực tuyến cho Add-in C# .NET.
- **Tối ưu chi phí:** Vận hành trên Cloudflare Pages + Supabase Free Tier + Cloudflare R2 + PayOS với chi phí **dưới 100.000 VNĐ/tháng**.

---

## 1. CẤU TRÚC THƯ MỤC DỰ ÁN

```text
revit-store-hub/
├── index.html                 # Trang SPA Storefront chính
├── css/
│   ├── theme.css              # Design System, Biến CSS màu sắc BIM/MEP, Glassmorphism
│   ├── store.css              # Layout Header, Hero Banner, Grid Sản phẩm, Bộ lọc
│   ├── checkout.css           # Cart Drawer, VietQR Modal, Polling trạng thái thanh toán
│   └── portal.css             # Khu vực tải Family an toàn, Quản lý License, Admin Portal
├── js/
│   ├── data.js                # Data Store Adapter & Supabase Database Repository
│   ├── auth.js                # Quản lý Đăng nhập, Session & Quyền Kỹ sư / Admin
│   ├── payment.js             # Tích hợp VietQR PayOS, Polling & Webhook xác thực thực tế
│   ├── download.js            # Dịch vụ cấp Signed URL có TTL 15 phút & Ghi log tải
│   ├── license.js             # Engine sinh License Key, kiểm tra HWID & giới hạn máy
│   ├── admin.js               # Bảng điều khiển quản trị: Doanh thu, Đơn hàng, Sản phẩm
│   └── store.js               # Logic điều khiển UI chính của Storefront
├── supabase/
│   └── schema.sql             # SQL Script khởi tạo Database PostgreSQL, RLS Policies, Triggers
├── worker/
│   └── index.js               # Cloudflare Worker API (PayOS Webhook, R2 Presigned URL, License verify)
└── examples/
    └── RevitAddinLicenseClient.cs # File C# mẫu cho lập trình viên Revit Add-in kết nối Server
```

---

## 2. HƯỚNG DẪN CHẠY THỬ NGHIỆM TRÊN MÁY (LOCAL PREVIEW)

Dự án được xây dựng dưới dạng module hiện đại, không đòi hỏi cài đặt phức tạp:
1. Mở terminal tại thư mục `d:\son\new\license-web-app\revit-store-hub`.
2. Khởi chạy HTTP server:
   ```bash
   npx serve .
   # hoặc dùng python:
   python -m http.server 8080
   ```
3. Mở trình duyệt truy cập: `http://localhost:8080` (hoặc cổng hiển thị trên terminal).

---

## 3. HƯỚNG DẪN CẤU HÌNH SUPABASE (DATABASE & AUTH)

1. Đăng ký tài khoản miễn phí tại [https://supabase.com](https://supabase.com).
2. Tạo Project mới (ví dụ: `revit-store-db`).
3. Vào mục **SQL Editor** trong Dashboard của Supabase:
   - Mở file `supabase/schema.sql` trong thư mục dự án này.
   - Sao chép toàn bộ nội dung và dán vào SQL Editor, sau đó bấm **Run**.
   - Toàn bộ các bảng (`profiles`, `products`, `orders`, `user_purchases`, `licenses`, `download_logs`), chính sách bảo mật Row-Level Security (RLS) và dữ liệu mẫu sẽ được tạo tự động.
4. Lấy thông tin kết nối tại mục **Project Settings -> API**:
   - `Project URL` (SUPABASE_URL)
   - `anon public key` (SUPABASE_ANON_KEY)
   - `service_role key` (Dùng cho Cloudflare Worker xác thực Webhook và cấp quyền).

---

## 4. HƯỚNG DẪN CẤU HÌNH CLOUDFLARE R2 (LƯU TRỮ FILE RIÊNG TƯ)

1. Đăng nhập [Cloudflare Dashboard](https://dash.cloudflare.com) -> Chọn mục **R2**.
2. Tạo Bucket mới: Đặt tên `revit-vault-private` (Chọn chế độ **Private - Không bật Public Access**).
3. Tải các file Revit Family (`.rfa`) hoặc bộ cài Add-in (`.exe`, `.zip`) lên bucket theo cấu trúc:
   - `families/AHC_Vertical_FirePump_v2024.rfa`
   - `tools/MEP_Routing_Pro_v2.4.0_Setup.exe`
4. Vào mục **Manage R2 API Tokens** -> Tạo API Token có quyền **Object Read & Write**.
5. Gán biến môi trường vào Cloudflare Worker:
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME` = `revit-vault-private`

---

## 5. HƯỚNG DẪN TÍCH HỢP THANH TOÁN VIETQR PAYOS TỰ ĐỘNG

1. Đăng ký tài khoản cổng thanh toán tại [https://payos.vn](https://payos.vn).
2. Kết nối tài khoản ngân hàng của bạn (Vietcombank, MB, ACB, BIDV...).
3. Tạo Kênh thanh toán và lấy:
   - `Client ID`
   - `API Key`
   - `Checksum Key`
4. Cài đặt Webhook URL trên PayOS Dashboard:
   - Điền URL: `https://api.yourdomain.com/api/payment/webhook`
5. Khi người dùng quét mã VietQR thanh toán:
   - Ngân hàng thông báo cho PayOS trong 1-2 giây.
   - PayOS gửi Webhook kèm chữ ký số HMAC SHA256 tới Cloudflare Worker.
   - Worker xác thực chữ ký, đối chiếu số tiền, tự động cập nhật đơn hàng thành `paid`, mở khóa tải Family và cấp License Key tức thì!

---

## 6. HƯỚNG DẪN REVIT ADD-IN .NET C# KIỂM TRA BẢN QUYỀN

Xem file mẫu chi tiết tại `examples/RevitAddinLicenseClient.cs`:
1. Trong Visual Studio (Dự án Revit Add-in .NET Framework 4.8 hoặc .NET 8):
   - Thêm `RevitAddinLicenseClient.cs` vào dự án.
   - Khi lệnh Add-in chạy (`IExternalCommand.Execute`), gọi hàm:
     ```csharp
     var result = await LicenseVerificationService.ValidateLicenseAsync(userLicenseKey, "2024");
     if (!result.valid)
     {
         TaskDialog.Show("Bản Quyền Hết Hạn", result.message);
         return Result.Cancelled;
     }
     ```
2. Add-in tự động gửi `Hardware ID` (kết hợp CPU ID và Motherboard Serial) lên máy chủ, ngăn chặn chia sẻ key trái phép giữa các máy tính khác nhau.

---

## 7. SAO LƯU DỮ LIỆU & KHÔI PHỤC KHI GẶP SỰ CỐ (BACKUP & DISASTER RECOVERY)

1. **Cơ sở dữ liệu Supabase:**
   - Supabase tự động sao lưu định kỳ hàng ngày (Daily Backup).
   - Có thể chủ động xuất bản sao lưu bất kỳ lúc nào bằng lệnh:
     ```bash
     supabase db dump -f backup_$(date +%F).sql
     ```
2. **Kho lưu trữ file Cloudflare R2:**
   - Dữ liệu trên R2 được lưu trữ phân tán dự phòng nhiều vùng (Multi-AZ).
   - Có thể đồng bộ định kỳ bản sao về máy tính nội bộ thông qua AWS CLI hoặc Rclone:
     ```bash
     rclone sync r2:revit-vault-private D:/BACKUP-R2-FILES/
     ```
