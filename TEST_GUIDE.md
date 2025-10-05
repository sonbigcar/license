# Hướng dẫn test hệ thống License

## Tính năng mới đã thêm:

### 1. Tạm dừng License
- Nút tạm dừng (⏸️) xuất hiện với license đã được duyệt (Approved)
- Modal tạm dừng với các lý do có sẵn
- Nút kích hoạt lại (▶️) cho license đã tạm dừng

### 2. Theo dõi số máy
- Hiển thị số máy sử dụng license (mặc định 1/3)
- Cảnh báo màu đỏ khi vượt quá 3 máy
- Animation pulse cho trạng thái cảnh báo

### 3. Hiển thị License Key
- Cột License Key trong bảng quản lý
- Hiển thị "Chưa cấp" cho đăng ký chưa duyệt

## Cách test:

1. **Mở admin.html trong trình duyệt**
2. **Thêm dữ liệu test vào localStorage** (mở Developer Console và chạy):

```javascript
// Thêm dữ liệu test
const testRegistrations = [
    {
        registrationId: "REG001",
        userName: "Nguyen Van A",
        email: "test1@email.com",
        phone: "0901234567",
        company: "Công ty ABC",
        machineId: "MACHINE001",
        registeredAt: new Date().toISOString(),
        paymentAmount: "500000",
        status: "Pending"
    },
    {
        registrationId: "REG002",
        userName: "Tran Thi B",
        email: "test2@email.com",
        phone: "0987654321",
        company: "Công ty XYZ",
        machineId: "MACHINE002",
        registeredAt: new Date().toISOString(),
        paymentAmount: "500000",
        status: "Approved",
        licenseKey: "ABCD-1234-EFGH-5678",
        machineCount: 4  // Vượt quá giới hạn để test warning
    },
    {
        registrationId: "REG003",
        userName: "Le Van C",
        email: "test3@email.com",
        phone: "0912345678",
        company: "Công ty DEF",
        machineId: "MACHINE003",
        registeredAt: new Date().toISOString(),
        paymentAmount: "500000",
        status: "Suspended",
        licenseKey: "WXYZ-9876-QWER-5432",
        machineCount: 2,
        suspendReason: "Sử dụng trên nhiều máy",
        suspendedAt: new Date().toISOString()
    }
];

localStorage.setItem('registrations', JSON.stringify(testRegistrations));
location.reload();
```

3. **Test các tính năng:**
   - Duyệt đăng ký pending → License key sẽ được tạo
   - Tạm dừng license approved → Chuyển sang trạng thái suspended
   - Kích hoạt lại license suspended → Chuyển về approved
   - Kiểm tra cảnh báo màu đỏ cho số máy > 3

## Các nút chức năng:

- ✅ **Duyệt**: Duyệt đăng ký pending
- ❌ **Từ chối**: Từ chối đăng ký pending  
- ⏸️ **Tạm dừng**: Tạm dừng license đã duyệt
- ▶️ **Kích hoạt lại**: Kích hoạt lại license đã tạm dừng
- 👁️ **Xem chi tiết**: Xem thông tin chi tiết

## Thống kê mới:
- Tổng đăng ký
- Chờ duyệt
- Đã duyệt  
- Đã từ chối
- **Tạm dừng** (mới)

Hệ thống đã sẵn sàng sử dụng với đầy đủ tính năng quản lý license!