# Hướng dẫn cấu hình EmailJS để gửi email thực tế

## 📧 Cách thiết lập EmailJS (MIỄN PHÍ)

EmailJS cho phép gửi email trực tiếp từ JavaScript mà không cần server backend.

### Bước 1: Đăng ký tài khoản EmailJS
1. Truy cập: https://www.emailjs.com/
2. Click "Sign Up" và tạo tài khoản miễn phí
3. Verify email của bạn

### Bước 2: Tạo Email Service
1. Đăng nhập vào EmailJS Dashboard
2. Click "Email Services" > "Add New Service"
3. Chọn Gmail, Outlook, hoặc SMTP tùy ý
4. Nhập thông tin email của bạn
5. Copy **Service ID** (ví dụ: `service_abc123`)

### Bước 3: Tạo Email Template
1. Click "Email Templates" > "Create New Template"
2. Thiết kế template với các biến:
   ```
   To: {{to_email}}
   From: {{from_name}}
   Subject: {{subject}}
   
   Xin chào,
   
   {{message}}
   
   License Key: {{license_key}}
   
   Trân trọng,
   {{from_name}}
   ```
3. Copy **Template ID** (ví dụ: `template_xyz789`)

### Bước 4: Lấy Public Key
1. Click "Account" > "General"
2. Copy **Public Key** (ví dụ: `user_abc123xyz`)

### Bước 5: Cập nhật code
Mở file `admin/admin.js` và thay đổi:

```javascript
// EmailJS configuration
this.emailjsConfig = {
    serviceId: 'service_abc123',        // Thay bằng Service ID thực
    templateId: 'template_xyz789',      // Thay bằng Template ID thực  
    publicKey: 'user_abc123xyz'         // Thay bằng Public Key thực
};
```

## 🔧 Cách test EmailJS

1. Mở `admin.html` trong trình duyệt
2. Mở Developer Console (F12)
3. Tạo một đăng ký test từ `index.html`
4. Duyệt đăng ký và kiểm tra:
   - Console có hiển thị "✅ Email sent successfully via EmailJS"
   - Email được gửi tới địa chỉ thực

## 🚨 Giải pháp dự phòng

Nếu EmailJS không hoạt động, hệ thống sẽ tự động:

1. **Mở ứng dụng email mặc định** với nội dung đã điền sẵn
2. **Copy nội dung vào clipboard** nếu không mở được email client
3. **Hiển thị thông báo** hướng dẫn người dùng

## 📊 Giới hạn EmailJS miễn phí

- **200 emails/tháng** (đủ cho test và dự án nhỏ)
- Không giới hạn templates
- Support cơ bản

## 🛠️ Alternatives khác

Nếu không muốn dùng EmailJS, có thể:

1. **SMTP.js**: https://smtpjs.com/
2. **Formspree**: https://formspree.io/
3. **Netlify Forms**: Nếu host trên Netlify
4. **Backend API**: Tự viết server với Nodemailer

## 🔍 Debug Common Issues

### Email không được gửi:
1. Kiểm tra Console có lỗi không
2. Verify Service ID, Template ID, Public Key
3. Kiểm tra template variables có đúng không
4. Test với email khác

### Gmail bị block:
1. Bật "Less secure app access"
2. Hoặc sử dụng App Password
3. Hoặc dùng SMTP khác (Outlook, Yahoo)

## ✅ Test checklist

- [ ] EmailJS account tạo thành công
- [ ] Service kết nối được với email
- [ ] Template tạo với đúng variables
- [ ] Public key copy chính xác
- [ ] Code cập nhật với IDs thực
- [ ] Test gửi email thành công
- [ ] Fallback mailto hoạt động
- [ ] Console không có lỗi

---

**Lưu ý**: Sau khi cấu hình xong, hệ thống sẽ tự động gửi email thật khi admin duyệt/từ chối đăng ký!