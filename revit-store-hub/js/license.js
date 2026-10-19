/**
 * ==============================================================================
 * REVIT BIM STORE - ENTERPRISE LICENSE MANAGEMENT & VERIFICATION ENGINE
 * Hệ thống quản lý bản quyền chuyên sâu cho Revit Add-in / Tools
 * Hỗ trợ: Heartbeat Online, Giới hạn HWID, Reset thiết bị, Cấp key Offline, Gia hạn
 * ==============================================================================
 */

class LicenseManager {
  constructor() {
    this.initDefaultLicenses();
  }

  initDefaultLicenses() {
    const existing = window.dataStore.get('licenses');
    if (!existing || existing.length === 0) {
      const now = new Date();

      // 1. License đang hoạt động còn hạn dài (Gói Team 3 máy)
      const exp1 = new Date();
      exp1.setFullYear(now.getFullYear() + 1);

      // 2. License sắp hết hạn trong 10 ngày (Để kiểm thử cảnh báo gia hạn)
      const exp2 = new Date();
      exp2.setDate(now.getDate() + 10);

      // 3. License đã hết hạn (Expired)
      const exp3 = new Date();
      exp3.setDate(now.getDate() - 15);

      const defaultLicenses = [
        {
          id: 'lic-pro-001',
          license_key: 'REVIT-9A4B-88F1-2C3D',
          user_id: 'acc-user-01',
          user_email: 'engineer.bim@gmail.com',
          user_name: 'Đoàn Sơn - BIM Coordinator',
          company: 'MEP BIM Solutions Vietnam',
          product_id: 'tool-001',
          product_name: 'MEP Auto Routing & Smart Elevation Pro',
          subscription_type: 'yearly',
          plan_name: 'Gói Chuyên Nghiệp (Team 3 Máy)',
          max_machines: 3,
          status: 'active', // 'active', 'suspended', 'expired'
          start_date: new Date(now.getTime() - 60 * 24 * 3600 * 1000).toISOString(),
          expiry_date: exp1.toISOString(),
          download_url: 'https://vault.revitstore.vn/tools/MEP_Routing_Pro_v2.4.0_Setup.exe',
          version: 'v2.4.0',
          activations: [
            {
              machine_id: 'HWID-BIM-STATION-01',
              machine_name: 'DELL Precision 5820 (Bàn Trưởng Phòng)',
              os_info: 'Windows 11 Pro 64-bit',
              revit_version: '2025',
              ip_address: '118.70.182.45',
              activated_at: new Date(now.getTime() - 60 * 24 * 3600 * 1000).toISOString(),
              last_checked_at: new Date().toISOString()
            },
            {
              machine_id: 'HWID-LAPTOP-MOBILE-02',
              machine_name: 'ThinkPad P16s (Laptop Đi Công Trường)',
              os_info: 'Windows 10 Pro 64-bit',
              revit_version: '2024',
              ip_address: '118.70.182.45',
              activated_at: new Date(now.getTime() - 20 * 24 * 3600 * 1000).toISOString(),
              last_checked_at: new Date(now.getTime() - 2 * 3600 * 1000).toISOString()
            }
          ]
        },
        {
          id: 'lic-pro-002',
          license_key: 'REVIT-77C1-44E2-99FA',
          user_id: 'acc-user-01',
          user_email: 'engineer.bim@gmail.com',
          user_name: 'Đoàn Sơn - BIM Coordinator',
          company: 'MEP BIM Solutions Vietnam',
          product_id: 'tool-002',
          product_name: 'Batch Sheet Exporter & Auto Renaming Pro',
          subscription_type: 'yearly',
          plan_name: 'Gói Cá Nhân (1 Máy)',
          max_machines: 1,
          status: 'active',
          start_date: new Date(now.getTime() - 355 * 24 * 3600 * 1000).toISOString(),
          expiry_date: exp2.toISOString(), // Sắp hết hạn trong 10 ngày
          download_url: 'https://vault.revitstore.vn/tools/Batch_Sheet_Exporter_Setup.zip',
          version: 'v1.8.2',
          activations: [
            {
              machine_id: 'HWID-BIM-STATION-01',
              machine_name: 'DELL Precision 5820 (Máy Chính)',
              os_info: 'Windows 11 Pro 64-bit',
              revit_version: '2024',
              ip_address: '118.70.182.45',
              activated_at: new Date(now.getTime() - 355 * 24 * 3600 * 1000).toISOString(),
              last_checked_at: new Date().toISOString()
            }
          ]
        },
        {
          id: 'lic-pro-003',
          license_key: 'REVIT-11D9-AA33-FF88',
          user_id: 'acc-user-02',
          user_email: 'nguyen.hvac@vinabim.com',
          user_name: 'Nguyễn Văn Hùng - Kỹ Sư HVAC',
          company: 'VinaBIM Engineering',
          product_id: 'tool-003',
          product_name: 'Rebar Detailer & Auto Scheduling Pro',
          subscription_type: 'monthly',
          plan_name: 'Gói Dùng Thử (Trial)',
          max_machines: 1,
          status: 'expired', // Đã hết hạn
          start_date: new Date(now.getTime() - 45 * 24 * 3600 * 1000).toISOString(),
          expiry_date: exp3.toISOString(),
          download_url: 'https://vault.revitstore.vn/tools/Rebar_Detailer_Setup.exe',
          version: 'v3.1.0',
          activations: []
        }
      ];

      window.dataStore.save('licenses', defaultLicenses);
    }
  }

  /**
   * Sinh key bản quyền định dạng: REVIT-XXXX-XXXX-XXXX
   */
  generateLicenseKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const segments = ['REVIT'];
    for (let s = 0; s < 3; s++) {
      let segment = '';
      for (let i = 0; i < 4; i++) {
        segment += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      segments.push(segment);
    }
    return segments.join('-');
  }

  /**
   * Tạo License thủ công (Admin cấp trực tiếp cho đối tác/khách hàng)
   */
  createManualLicense(params) {
    const key = params.license_key || this.generateLicenseKey();
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + (Number(params.duration_days) || 365));

    const newLicense = {
      id: 'lic-' + Date.now().toString(16),
      license_key: key,
      user_id: params.user_id || 'acc-manual',
      user_email: params.user_email,
      user_name: params.user_name || params.user_email.split('@')[0],
      company: params.company || 'Doanh Nghiệp Đối Tác',
      product_id: params.product_id,
      product_name: params.product_name,
      subscription_type: params.subscription_type || 'yearly',
      plan_name: params.plan_name || `Gói Tùy Chỉnh (${params.max_machines || 1} Máy)`,
      max_machines: Number(params.max_machines) || 1,
      status: 'active',
      start_date: new Date().toISOString(),
      expiry_date: expiry.toISOString(),
      download_url: 'https://vault.revitstore.vn/tools/Setup.zip',
      version: 'v2.4.0',
      note: params.note || 'Cấp thủ công từ Admin Console',
      activations: []
    };

    window.dataStore.addLicense(newLicense);
    return newLicense;
  }

  /**
   * Gia hạn thêm thời gian sử dụng cho License
   */
  renewLicense(licenseId, addedDays = 365) {
    const licenses = window.dataStore.getLicenses();
    const lic = licenses.find(l => l.id === licenseId);
    if (!lic) return false;

    let currentExpiry = new Date(lic.expiry_date);
    const now = new Date();

    // Nếu đã hết hạn thì tính từ hiện tại, nếu chưa hết thì cộng dồn vào hạn cũ
    if (now > currentExpiry) {
      currentExpiry = new Date();
    }
    currentExpiry.setDate(currentExpiry.getDate() + addedDays);

    lic.expiry_date = currentExpiry.toISOString();
    lic.status = 'active'; // Tự động active lại nếu trước đó bị hết hạn
    window.dataStore.updateLicense(lic);
    return lic;
  }

  /**
   * Thay đổi số lượng máy tối đa (Nâng cấp gói team 3 máy, 5 máy, 10 máy)
   */
  adjustMaxMachines(licenseId, newMax) {
    const licenses = window.dataStore.getLicenses();
    const lic = licenses.find(l => l.id === licenseId);
    if (!lic) return false;

    lic.max_machines = Number(newMax);
    lic.plan_name = `Gói Team (${newMax} Máy)`;
    window.dataStore.updateLicense(lic);
    return lic;
  }

  /**
   * Tạm dừng hoặc kích hoạt lại License
   */
  toggleLicenseStatus(licenseId) {
    const licenses = window.dataStore.getLicenses();
    const lic = licenses.find(l => l.id === licenseId);
    if (!lic) return false;

    lic.status = lic.status === 'active' ? 'suspended' : 'active';
    window.dataStore.updateLicense(lic);
    return lic;
  }

  /**
   * Reset toàn bộ máy tính kích hoạt (Dành cho hỗ trợ khẩn cấp)
   */
  resetAllActivations(licenseId) {
    const licenses = window.dataStore.getLicenses();
    const lic = licenses.find(l => l.id === licenseId);
    if (!lic) return false;

    lic.activations = [];
    window.dataStore.updateLicense(lic);
    return true;
  }

  /**
   * Hủy 1 máy trạm đơn lẻ (Người dùng đổi máy mới)
   */
  deactivateSingleMachine(licenseId, machineId) {
    const licenses = window.dataStore.getLicenses();
    const lic = licenses.find(l => l.id === licenseId);
    if (!lic) return false;

    lic.activations = (lic.activations || []).filter(a => a.machine_id !== machineId);
    window.dataStore.updateLicense(lic);
    return true;
  }

  /**
   * Đổi tên gợi nhớ cho máy trạm (Ví dụ: Máy Bàn BIM 01, Laptop Sơn...)
   */
  renameMachine(licenseId, machineId, newFriendlyName) {
    const licenses = window.dataStore.getLicenses();
    const lic = licenses.find(l => l.id === licenseId);
    if (!lic) return false;

    const act = (lic.activations || []).find(a => a.machine_id === machineId);
    if (act) {
      act.machine_name = newFriendlyName;
      window.dataStore.updateLicense(lic);
      return true;
    }
    return false;
  }

  /**
   * Xuất file bản quyền Offline (.LIC) cho các dự án nội bộ không có Internet
   */
  exportOfflineLicenseFile(licenseId) {
    const licenses = window.dataStore.getLicenses();
    const lic = licenses.find(l => l.id === licenseId);
    if (!lic) throw new Error('Không tìm thấy license');

    const licensePayload = {
      product: lic.product_name,
      license_key: lic.license_key,
      customer: lic.user_name,
      company: lic.company,
      max_machines: lic.max_machines,
      issued_at: new Date().toISOString(),
      expires_at: lic.expiry_date,
      signature: 'RSA_SHA256_' + btoa(lic.license_key + '|' + lic.expiry_date)
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(licensePayload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${lic.product_name.replace(/\s+/g, '_')}_License.lic`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  /**
   * API ENDPOINT XÁC MINH TRỰC TUYẾN DÀNH CHO REVIT ADD-IN .NET C#
   * Cung cấp cơ chế Heartbeat định kỳ
   */
  verifyLicenseApi(licenseKey, machineId, machineName = 'Unknown-PC', revitVersion = '2025') {
    const licenses = window.dataStore.getLicenses();
    const license = licenses.find(l => l.license_key.toUpperCase() === licenseKey.trim().toUpperCase());

    if (!license) {
      return {
        valid: false,
        code: 'KEY_NOT_FOUND',
        message: 'Mã bản quyền (License Key) không tồn tại trên hệ thống máy chủ.'
      };
    }

    if (license.status === 'suspended') {
      return {
        valid: false,
        code: 'LICENSE_SUSPENDED',
        message: 'Bản quyền này đang bị tạm khóa bởi quản trị viên. Vui lòng liên hệ hỗ trợ.'
      };
    }

    const now = new Date();
    const expiryDate = new Date(license.expiry_date);
    if (now > expiryDate) {
      license.status = 'expired';
      window.dataStore.updateLicense(license);
      return {
        valid: false,
        code: 'LICENSE_EXPIRED',
        message: `Bản quyền đã hết hạn vào ngày ${expiryDate.toLocaleDateString('vi-VN')}. Vui lòng gia hạn để tiếp tục sử dụng.`
      };
    }

    license.activations = license.activations || [];
    let activation = license.activations.find(a => a.machine_id === machineId);

    if (activation) {
      activation.last_checked_at = now.toISOString();
      activation.revit_version = revitVersion;
      if (machineName && machineName !== 'Unknown-PC') {
        activation.machine_name = machineName;
      }
      window.dataStore.updateLicense(license);

      return {
        valid: true,
        code: 'HEARTBEAT_OK',
        product_name: license.product_name,
        subscription_type: license.subscription_type,
        expires_at: license.expiry_date,
        days_remaining: Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24)),
        machine_name: activation.machine_name,
        machines_used: license.activations.length,
        max_machines: license.max_machines
      };
    }

    if (license.activations.length >= license.max_machines) {
      return {
        valid: false,
        code: 'MAX_MACHINES_EXCEEDED',
        message: `Đã vượt quá số lượng máy trạm cho phép (${license.activations.length}/${license.max_machines} máy). Vui lòng đăng nhập website để gỡ bỏ máy tính cũ.`
      };
    }

    // Kích hoạt máy tính mới
    const newActivation = {
      machine_id: machineId,
      machine_name: machineName,
      os_info: navigator.userAgent.includes('Windows') ? 'Windows 11 Pro 64-bit' : 'Windows OS',
      revit_version: revitVersion,
      ip_address: '118.70.182.45',
      activated_at: now.toISOString(),
      last_checked_at: now.toISOString()
    };
    license.activations.push(newActivation);
    window.dataStore.updateLicense(license);

    return {
      valid: true,
      code: 'NEW_MACHINE_ACTIVATED',
      product_name: license.product_name,
      subscription_type: license.subscription_type,
      expires_at: license.expiry_date,
      days_remaining: Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24)),
      machine_name: machineName,
      machines_used: license.activations.length,
      max_machines: license.max_machines
    };
  }

  /**
   * Thống kê toàn diện chỉ số License cho Admin Console
   */
  getLicenseStats() {
    const licenses = window.dataStore.getLicenses();
    const now = new Date();
    let total = licenses.length;
    let active = 0;
    let expiringSoon = 0;
    let expired = 0;
    let suspended = 0;
    let totalDevices = 0;

    licenses.forEach(lic => {
      const exp = new Date(lic.expiry_date);
      const diffDays = Math.round((exp - now) / (1000 * 60 * 60 * 24));
      totalDevices += (lic.activations || []).length;

      if (lic.status === 'suspended') {
        suspended++;
      } else if (diffDays <= 0 || lic.status === 'expired') {
        expired++;
      } else {
        active++;
        if (diffDays <= 30) {
          expiringSoon++;
        }
      }
    });

    return { total, active, expiringSoon, expired, suspended, totalDevices };
  }

  /**
   * Lọc và tìm kiếm license linh hoạt theo từ khóa và trạng thái
   */
  filterLicenses(searchQuery = '', statusFilter = 'all') {
    let licenses = window.dataStore.getLicenses();
    const now = new Date();

    if (statusFilter && statusFilter !== 'all') {
      licenses = licenses.filter(lic => {
        const exp = new Date(lic.expiry_date);
        const diffDays = Math.round((exp - now) / (1000 * 60 * 60 * 24));
        if (statusFilter === 'active') return lic.status === 'active' && diffDays > 0;
        if (statusFilter === 'expiring') return lic.status === 'active' && diffDays > 0 && diffDays <= 30;
        if (statusFilter === 'expired') return lic.status === 'expired' || diffDays <= 0;
        if (statusFilter === 'suspended') return lic.status === 'suspended';
        return true;
      });
    }

    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      licenses = licenses.filter(lic => {
        return (lic.license_key && lic.license_key.toLowerCase().includes(q)) ||
               (lic.product_name && lic.product_name.toLowerCase().includes(q)) ||
               (lic.user_name && lic.user_name.toLowerCase().includes(q)) ||
               (lic.user_email && lic.user_email.toLowerCase().includes(q)) ||
               (lic.company && lic.company.toLowerCase().includes(q));
      });
    }

    return licenses;
  }

  /**
   * Xuất toàn bộ báo cáo License sang file CSV (hỗ trợ tiếng Việt cho Excel)
   */
  exportLicensesCsv() {
    const licenses = window.dataStore.getLicenses();
    const headers = ['Mã License', 'Tên Tool', 'Khách hàng', 'Email', 'Công ty', 'Gói', 'Số máy', 'Ngày bắt đầu', 'Ngày hết hạn', 'Trạng thái', 'Ghi chú'];
    const rows = licenses.map(l => [
      `"${l.license_key}"`,
      `"${l.product_name}"`,
      `"${l.user_name || ''}"`,
      `"${l.user_email || ''}"`,
      `"${l.company || ''}"`,
      `"${l.plan_name || l.subscription_type}"`,
      `"${(l.activations || []).length}/${l.max_machines}"`,
      `"${new Date(l.start_date).toLocaleDateString('vi-VN')}"`,
      `"${new Date(l.expiry_date).toLocaleDateString('vi-VN')}"`,
      `"${l.status}"`,
      `"${(l.note || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `RevitHub_Licenses_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

window.licenseManager = new LicenseManager();
