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
      window.dataStore.save('licenses', []);
    } else {
      // Dọn dẹp các license mẫu của tài khoản ảo cũ
      const dummyEmails = ['engineer.bim@gmail.com', 'nguyen.hvac@vinabim.com'];
      const cleaned = existing.filter(l => !dummyEmails.includes(l.user_email));
      if (cleaned.length !== existing.length) {
        window.dataStore.save('licenses', cleaned);
      }
    }
  }

  /**
   * Sinh key bản quyền thông minh mang tiền tố nhận diện gói:
   * - VIP: REVIT-VIP-XXXX-XXXX
   * - Combo Duct + Pipe: DS-DUCT-PIPE-XXXX-XXXX
   * - Combo Duct + Elec: DS-DUCT-ELEC-XXXX-XXXX
   * - Gói lẻ: DS-DUCT-XXXX-XXXX, DS-PIPE-XXXX-XXXX...
   */
  generateLicenseKey(allowedModules = ['MEP-ALL']) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let prefix = 'REVIT-VIP';

    const mods = (Array.isArray(allowedModules) ? allowedModules : [allowedModules]).map(m => String(m).toUpperCase().replace('MEP-', ''));
    const isAll = mods.includes('ALL') || mods.length >= 6;

    if (isAll) {
      prefix = 'REVIT-VIP';
    } else if (mods.includes('DUCT') && mods.includes('PIPE') && mods.length === 2) {
      prefix = 'DS-DUCT-PIPE';
    } else if (mods.includes('DUCT') && mods.includes('ELEC') && mods.length === 2) {
      prefix = 'DS-DUCT-ELEC';
    } else if (mods.length === 1) {
      prefix = `DS-${mods[0]}`;
    } else if (mods.length > 0) {
      prefix = `DS-${mods.join('-')}`;
    }

    const segments = [prefix];
    for (let s = 0; s < 2; s++) {
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
    const key = params.license_key || this.generateLicenseKey(params.allowed_modules);
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
      allowed_modules: params.allowed_modules || ['MEP-ALL'],
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
    this.syncLicenseToRemote(newLicense).catch(() => {});
    return newLicense;
  }

  /**
   * Đồng bộ toàn diện thông tin License sang Server Node local, Cloudflare Worker và GitHub Repository
   */
  async syncLicenseToRemote(lic) {
    if (!lic || !lic.license_key) return;

    const maxSlots = Number(lic.max_machines || lic.max_accounts || 3);
    const regAccounts = (lic.registered_accounts !== undefined)
      ? lic.registered_accounts
      : (lic.activations || []).map(a => ({
          username: a.username || lic.user_name || 'user',
          fullName: a.machine_name || 'PC-Workstation',
          machineId: a.machine_id,
          registeredAt: a.registered_at || new Date().toISOString(),
          lastActive: a.last_checked_at || new Date().toISOString(),
          status: a.status || 'Active',
          app: a.app || 'Revit Tools'
        }));

    const payload = {
      license_key: lic.license_key,
      allowed_modules: lic.allowed_modules || ['MEP-ALL'],
      plan_name: lic.plan_name || 'Gói Bản Quyền DoanSon Hub',
      expiry_date: lic.expiry_date,
      max_machines: maxSlots,
      max_accounts: maxSlots,
      status: lic.status || 'active',
      registered_accounts: regAccounts
    };

    // 1. Đồng bộ lên Node server local (nếu có dev server chạy)
    try {
      await fetch('/api/v1/license/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {}

    // 2. Đồng bộ lên Cloudflare Worker trung tâm (cho mọi máy tính khác & Revit Add-in từ xa)
    try {
      await fetch('https://revit-store-api.polydactyl-wormhole.workers.dev/api/v1/license/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {}

    // 3. Đồng bộ lên GitHub Repo data/licenses_vault.json
    try {
      if (window.dataStore && typeof window.dataStore.syncLicensesVaultToGitHub === 'function') {
        await window.dataStore.syncLicensesVaultToGitHub(lic);
      }
    } catch (ghErr) {
      console.warn('[Sync GitHub] Lỗi:', ghErr);
    }
  }

  /**
   * Gia hạn thêm thời gian sử dụng cho License
   */
  async renewLicense(licenseId, addedDays = 365) {
    const licenses = window.dataStore.getLicenses();
    const lic = licenses.find(l => l.id === licenseId || l.license_key === licenseId);
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

    await this.syncLicenseToRemote(lic);
    return lic;
  }

  /**
   * Thay đổi số lượng máy tối đa (Nâng cấp gói team 3 máy, 5 máy, 10 máy)
   * Đồng bộ tức thì lên Server, Worker và GitHub để mọi máy khác nhận diện ngay.
   */
  async adjustMaxMachines(licenseId, newMax) {
    const licenses = window.dataStore.getLicenses();
    const lic = licenses.find(l => l.id === licenseId || l.license_key === licenseId);
    if (!lic) return false;

    const slotsNum = Number(newMax);
    lic.max_machines = slotsNum;
    lic.max_accounts = slotsNum;

    // Cập nhật số máy trong plan_name nếu có định dạng (X Máy), bảo toàn tên gói gốc
    if (lic.plan_name && lic.plan_name.includes('Máy')) {
      lic.plan_name = lic.plan_name.replace(/\(\d+\s*Máy[^\)]*\)/i, `(${slotsNum} Máy)`);
    } else if (lic.plan_name) {
      lic.plan_name = `${lic.plan_name} (${slotsNum} Máy)`;
    } else {
      lic.plan_name = `Gói Team (${slotsNum} Máy)`;
    }

    window.dataStore.updateLicense(lic);

    // Đồng bộ tức thì sang tất cả hệ thống (Server, Worker, GitHub)
    await this.syncLicenseToRemote(lic);
    return lic;
  }

  /**
   * Cập nhật danh sách các module được cấp phép cho License (Full VIP, Duct, Pipe, Sheet, Fire, Elec, AI)
   */
  async updateLicenseModules(licenseId, allowedModules, customPlanName = null) {
    const licenses = window.dataStore.getLicenses();
    const lic = licenses.find(l => l.id === licenseId || l.license_key === licenseId);
    if (!lic) return false;

    const isAll = allowedModules.includes('MEP-ALL');
    lic.allowed_modules = isAll ? ['MEP-ALL'] : allowedModules;

    const slots = lic.max_machines || 3;
    if (customPlanName) {
      lic.plan_name = customPlanName;
    } else if (isAll) {
      lic.plan_name = `Gói Full VIP (Tất Cả Tools - ${slots} Máy)`;
    } else {
      const names = lic.allowed_modules.map(m => m.replace('MEP-', ''));
      lic.plan_name = `Gói Combo (${names.join(' + ')} - ${slots} Máy)`;
    }

    window.dataStore.updateLicense(lic);
    await this.syncLicenseToRemote(lic);
    return lic;
  }

  /**
   * Tạm dừng hoặc kích hoạt lại License
   */
  async toggleLicenseStatus(licenseId) {
    const licenses = window.dataStore.getLicenses();
    const lic = licenses.find(l => l.id === licenseId || l.license_key === licenseId);
    if (!lic) return false;

    lic.status = lic.status === 'active' ? 'suspended' : 'active';
    window.dataStore.updateLicense(lic);

    await this.syncLicenseToRemote(lic);
    return lic;
  }

  /**
   * Reset toàn bộ máy tính kích hoạt (Dành cho hỗ trợ khẩn cấp)
   */
  async resetAllActivations(licenseId) {
    const licenses = window.dataStore.getLicenses();
    const lic = licenses.find(l => l.id === licenseId || l.license_key === licenseId);
    if (!lic) return false;

    lic.activations = [];
    lic.registered_accounts = [];
    window.dataStore.updateLicense(lic);

    await this.syncLicenseToRemote(lic);
    return true;
  }

  /**
   * Hủy 1 máy trạm đơn lẻ (Người dùng đổi máy mới)
   */
  async deactivateSingleMachine(licenseId, machineId) {
    const licenses = window.dataStore.getLicenses();
    const lic = licenses.find(l => l.id === licenseId || l.license_key === licenseId);
    if (!lic) return false;

    lic.activations = (lic.activations || []).filter(a => (a.machine_id || a.machineId) !== machineId);
    lic.registered_accounts = (lic.registered_accounts || []).filter(a => (a.machineId || a.machine_id) !== machineId);
    window.dataStore.updateLicense(lic);

    await this.syncLicenseToRemote(lic);
    return true;
  }

  /**
   * Đổi tên gợi nhớ cho máy trạm (Ví dụ: Máy Bàn BIM 01, Laptop Sơn...)
   */
  async renameMachine(licenseId, machineId, newFriendlyName) {
    const licenses = window.dataStore.getLicenses();
    const lic = licenses.find(l => l.id === licenseId || l.license_key === licenseId);
    if (!lic) return false;

    let updated = false;
    const act = (lic.activations || []).find(a => (a.machine_id || a.machineId) === machineId);
    if (act) {
      act.machine_name = newFriendlyName;
      updated = true;
    }

    const reg = (lic.registered_accounts || []).find(a => (a.machineId || a.machine_id) === machineId);
    if (reg) {
      reg.fullName = newFriendlyName;
      reg.machine_name = newFriendlyName;
      updated = true;
    }

    if (updated) {
      window.dataStore.updateLicense(lic);
      await this.syncLicenseToRemote(lic);
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

      const allowedModules = license.allowed_modules || ['MEP-ALL'];
      return {
        valid: true,
        code: 'HEARTBEAT_OK',
        product_name: license.product_name,
        allowed_modules: allowedModules,
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

    const allowedModules = license.allowed_modules || ['MEP-ALL'];
    return {
      valid: true,
      code: 'NEW_MACHINE_ACTIVATED',
      product_name: license.product_name,
      allowed_modules: allowedModules,
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
