# MyRevitAddin License Web System

Hệ thống web quản lý license cho MyRevitAddin - một ứng dụng đầy đủ để nhận key và kiểm tra license.

## 🚀 Tính năng chính

### Trang chính (index.html)
- ✅ Form nhập license key với validation thời gian thực
- ✅ Tự động tạo Machine ID duy nhất
- ✅ Hiển thị thông tin hệ thống (OS, Browser)
- ✅ Danh sách test keys có sẵn
- ✅ Kiểm tra và kích hoạt license
- ✅ Giao diện responsive và đẹp mắt
- ✅ Lưu trữ dữ liệu local storage

### Trang Admin (admin/admin.html)
- 📊 Thống kê tổng quan (tổng licenses, active, sắp hết hạn, kích hoạt hôm nay)
- 🔍 Tìm kiếm và lọc licenses
- 📋 Bảng danh sách với phân trang
- ✏️ Chỉnh sửa thông tin license
- 🗑️ Xóa single hoặc bulk licenses
- 📤 Xuất dữ liệu ra CSV
- 👁️ Xem chi tiết license

## 🛠️ Cài đặt và sử dụng

### 1. Cấu trúc thư mục
```
license-web-app/
├── index.html          # Trang chính kích hoạt license
├── css/
│   └── style.css       # Styling chung
├── js/
│   └── app.js          # JavaScript chính
└── admin/
    ├── admin.html      # Trang quản trị
    ├── admin.css       # CSS cho admin panel
    └── admin.js        # JavaScript cho admin
```

### 2. Mở ứng dụng
1. Mở file `index.html` trong trình duyệt
2. Hoặc host trên web server (khuyến nghị)

### 3. Test các tính năng

#### Kích hoạt license:
1. Nhập thông tin người dùng
2. Chọn một test key hoặc nhập manually:
   - `1234-5678-9012-3456`
   - `TEST-DEMO-2024-ABCD`
   - `REVIT-TOOL-DSON-2024`
   - `HVAC-ADDIN-BETA-TEST`
3. Click "Kiểm tra License" để validate
4. Click "Kích hoạt License" để hoàn tất

#### Quản lý Admin:
1. Truy cập `admin/admin.html`
2. Xem thống kê tổng quan
3. Tìm kiếm, lọc, chỉnh sửa licenses
4. Xuất dữ liệu CSV

## 🎨 Giao diện

### Trang chính
- **Header**: Gradient background với tiêu đề
- **Form**: Card-based design với validation
- **Machine Info**: Hiển thị thông tin hệ thống
- **Test Keys**: Danh sách key có sẵn
- **Results**: Kết quả kiểm tra/kích hoạt

### Trang Admin
- **Statistics Cards**: 4 thẻ thống kê chính
- **Filters**: Tìm kiếm và lọc
- **Data Table**: Bảng dữ liệu với actions
- **Modals**: Popup cho chi tiết và chỉnh sửa

## 💻 Công nghệ sử dụng

- **HTML5**: Cấu trúc trang web
- **CSS3**: Styling với Flexbox, Grid, Animations
- **Vanilla JavaScript**: Logic xử lý
- **Local Storage**: Lưu trữ dữ liệu
- **Responsive Design**: Tương thích mobile

## 🔧 Tùy chỉnh

### Thêm test keys mới:
Trong `js/app.js`, cập nhật array `validTestKeys`:
```javascript
this.validTestKeys = [
    '1234-5678-9012-3456',
    'YOUR-NEW-TEST-KEY'
];
```

### Thay đổi thời hạn license:
Trong hàm `generateLicenseInfo()`:
```javascript
const expiry = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 năm
```

### Tùy chỉnh giao diện:
- Sửa `css/style.css` cho trang chính
- Sửa `admin/admin.css` cho trang admin

## 📱 Responsive Design

- **Desktop**: Full layout với sidebar và grid
- **Tablet**: Responsive grid và navigation
- **Mobile**: Stack layout, touch-friendly buttons

## 🔒 Bảo mật

- Validation phía client
- Escape HTML để tránh XSS
- Không lưu trữ thông tin nhạy cảm
- Test mode chỉ dành cho development

## 🚀 Tính năng nâng cao

### Machine ID Generation
- Sử dụng browser fingerprinting
- Canvas fingerprint
- User agent và screen resolution
- Timezone offset

### License Status Logic
- **Active**: Chưa hết hạn và không bị suspend
- **Expired**: Đã quá ngày hết hạn
- **Suspended**: Bị tạm dừng bởi admin

### Export CSV
- Headers tiếng Việt
- Encoding UTF-8
- Tự động đặt tên file với ngày

## 📞 Hỗ trợ

Nếu có vấn đề hoặc cần hỗ trợ:
1. Kiểm tra Console (F12) để xem lỗi
2. Đảm bảo Local Storage được bật
3. Thử refresh trang và xóa cache
4. Test trên browser khác

## 📄 License

© 2024 MyRevitAddin. All rights reserved.

---

**Lưu ý**: Đây là phiên bản test với dữ liệu lưu trên Local Storage. Để production, cần tích hợp với database và server backend.