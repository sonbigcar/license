/**
 * ==============================================================================
 * REVIT BIM STORE - ADMIN DASHBOARD & ACCOUNT MANAGEMENT CONTROLLER
 * Quản lý Tài Khoản Người Dùng, Sản Phẩm, Đơn Hàng, Bản Quyền & Dịch Vụ
 * ==============================================================================
 */

class AdminPanel {
  constructor() {
    this.currentTab = 'accounts'; // Mặc định mở Tab Quản lý tài khoản
    this.licenseSearchQuery = '';
    this.licenseStatusFilter = 'all';
  }

  render() {
    const user = window.authManager.getCurrentUser();
    const container = document.getElementById('adminView');
    if (!container) return;

    if (!user || user.role !== 'admin') {
      container.innerHTML = `
        <div class="portal-container" style="text-align: center; padding: 100px 20px;">
          <div style="font-size: 3.5rem; margin-bottom: 16px;">🛡️</div>
          <h2 style="font-family: var(--font-heading); font-size: 2rem;">Khu Vực Quản Trị Hệ Thống (Admin Only)</h2>
          <p style="color: var(--text-muted); max-width: 500px; margin: 12px auto 24px;">
            Tab này chỉ hiển thị và cho phép truy cập đối với tài khoản có quyền Quản Trị Viên (Admin).
          </p>
          <button class="btn btn-primary" onclick="window.storeApp.openAuthModal()">
            🔐 Đăng Nhập Tài Khoản Quản Trị
          </button>
        </div>
      `;
      return;
    }

    const accounts = window.dataStore.getAccounts();
    const orders = window.dataStore.getOrders();
    const products = window.dataStore.getProducts();
    const licenses = window.dataStore.getLicenses();
    const requests = window.dataStore.getCustomRequests();
    const logs = window.dataStore.get('download_logs') || [];

    const totalRevenue = orders
      .filter(o => o.status === 'paid')
      .reduce((sum, o) => sum + o.total_amount, 0);

    container.innerHTML = `
      <div class="portal-container">
        <div class="portal-header">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div>
              <span class="badge badge-admin">Master Administrator Portal</span>
              <h2 class="portal-title">Bảng Điều Khiển & Quản Lý Tài Khoản</h2>
            </div>
            <div style="display: flex; gap: 10px;">
              <button class="btn btn-secondary btn-sm" onclick="window.storeApp.switchMainView('storefrontView')">
                ← Về Cửa Hàng
              </button>
            </div>
          </div>
        </div>

        <!-- Thống kê tổng quan -->
        <div class="admin-stats-grid">
          <div class="glass-panel admin-stat-card">
            <span style="font-size: 0.8rem; color: var(--text-dim); text-transform: uppercase;">Doanh thu thực nhận</span>
            <div style="font-family: var(--font-heading); font-size: 1.8rem; font-weight: 800; color: var(--success); margin-top: 6px;">
              ${window.storeApp.formatCurrency(totalRevenue)}
            </div>
          </div>

          <div class="glass-panel admin-stat-card" style="border-left-color: var(--primary);">
            <span style="font-size: 0.8rem; color: var(--text-dim); text-transform: uppercase;">Tổng số tài khoản</span>
            <div style="font-family: var(--font-heading); font-size: 1.8rem; font-weight: 800; color: #fff; margin-top: 6px;">
              ${accounts.length} Người dùng
            </div>
          </div>

          <div class="glass-panel admin-stat-card" style="border-left-color: #c084fc;">
            <span style="font-size: 0.8rem; color: var(--text-dim); text-transform: uppercase;">Yêu cầu dịch vụ custom</span>
            <div style="font-family: var(--font-heading); font-size: 1.8rem; font-weight: 800; color: #fff; margin-top: 6px;">
              ${requests.length} Đơn vị
            </div>
          </div>

          <div class="glass-panel admin-stat-card" style="border-left-color: var(--warning);">
            <span style="font-size: 0.8rem; color: var(--text-dim); text-transform: uppercase;">Lượt tải file bảo mật</span>
            <div style="font-family: var(--font-heading); font-size: 1.8rem; font-weight: 800; color: #fff; margin-top: 6px;">
              ${logs.length}
            </div>
          </div>
        </div>

        <!-- Admin Sub-tabs (Đặc biệt có Tab Quản Lý Tài Khoản) -->
        <div class="portal-tabs">
          <button class="portal-tab-btn ${this.currentTab === 'accounts' ? 'active' : ''}" onclick="window.adminPanel.switchTab('accounts')">
            👥 Quản Lý Tài Khoản (${accounts.length})
          </button>
          <button class="portal-tab-btn ${this.currentTab === 'orders' ? 'active' : ''}" onclick="window.adminPanel.switchTab('orders')">
            📦 Quản Lý Đơn Hàng (${orders.length})
          </button>
          <button class="portal-tab-btn ${this.currentTab === 'products' ? 'active' : ''}" onclick="window.adminPanel.switchTab('products')">
            🏷️ Quản Lý Sản Phẩm (${products.length})
          </button>
          <button class="portal-tab-btn ${this.currentTab === 'requests' ? 'active' : ''}" onclick="window.adminPanel.switchTab('requests')">
            ✍️ Yêu Cầu Thuê Viết Tools & Template (${requests.length})
          </button>
          <button class="portal-tab-btn ${this.currentTab === 'licenses' ? 'active' : ''}" onclick="window.adminPanel.switchTab('licenses')">
            🔑 Quản Lý Giấy Phép (${licenses.length})
          </button>
          <button class="portal-tab-btn ${this.currentTab === 'settings' ? 'active' : ''}" onclick="window.adminPanel.switchTab('settings')">
            🏦 Cấu Hình Tài Khoản Nhận Tiền
          </button>
        </div>

        <div id="adminTabContent">
          ${this.getTabContent(this.currentTab, { accounts, orders, products, licenses, requests, logs })}
        </div>
      </div>
    `;
  }

  switchTab(tab) {
    this.currentTab = tab;
    this.render();
  }

  getTabContent(tab, data) {
    if (tab === 'accounts') {
      return this.renderAccountsTable(data.accounts);
    } else if (tab === 'orders') {
      return this.renderOrdersTable(data.orders);
    } else if (tab === 'products') {
      return this.renderProductsTable(data.products);
    } else if (tab === 'requests') {
      return this.renderRequestsTable(data.requests);
    } else if (tab === 'licenses') {
      return this.renderLicensesTable(data.licenses);
    } else if (tab === 'settings') {
      return this.renderSettingsTab();
    }
    return '';
  }

  /**
   * BẢNG QUẢN LÝ TÀI KHOẢN NGƯỜI DÙNG (YÊU CẦU TRỌNG TÂM CỦA KHÁCH)
   */
  renderAccountsTable(accounts) {
    return `
      <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <p style="color: var(--text-muted); font-size: 0.92rem; margin: 0;">
          Danh sách tài khoản hệ thống (Chỉ cần 1 tài khoản Admin chính chủ <strong>sonbigcar</strong>).
        </p>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary btn-sm" onclick="window.adminPanel.addNewAccountPrompt()">
            + Tạo Tài Khoản Mới
          </button>
          <button class="btn btn-secondary btn-sm" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.4);" onclick="window.adminPanel.cleanupDummyAccounts()" title="Xóa bỏ toàn bộ các tài khoản ảo mẫu mặc định, chỉ giữ lại tài khoản sonbigcar">
            🧹 Xóa Các Tài Khoản Ảo Mặc Định
          </button>
        </div>
      </div>

      <div class="admin-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Họ và Tên</th>
              <th>Email</th>
              <th>Số điện thoại</th>
              <th>Công ty / Đơn vị</th>
              <th>Phân quyền</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            ${accounts.map(acc => `
              <tr>
                <td><strong>${acc.full_name}</strong></td>
                <td style="font-family: var(--font-mono); color: var(--primary);">${acc.email}</td>
                <td>${acc.phone || '-'}</td>
                <td>${acc.company || 'Cá nhân'}</td>
                <td>
                  <span class="badge ${acc.role === 'admin' ? 'badge-admin' : 'account-badge-customer'}">
                    ${acc.role === 'admin' ? '👑 Admin' : '👤 Kỹ sư'}
                  </span>
                </td>
                <td>
                  <span class="badge ${acc.status === 'active' ? 'badge-family' : 'badge-admin'}">
                    ${acc.status === 'active' ? 'Hoạt động' : 'Đã khóa'}
                  </span>
                </td>
                <td>
                  <div style="display: flex; gap: 6px;">
                    <button class="btn btn-secondary btn-sm" onclick="window.adminPanel.toggleRole('${acc.id}')" title="Đổi quyền Admin / Customer">
                      ${acc.role === 'admin' ? 'Hạ quyền Kỹ sư' : 'Nâng quyền Admin'}
                    </button>
                    <button class="btn btn-secondary btn-sm" style="color: ${acc.status === 'active' ? 'var(--danger)' : 'var(--success)'};" onclick="window.adminPanel.toggleStatus('${acc.id}')">
                      ${acc.status === 'active' ? 'Khóa' : 'Mở khóa'}
                    </button>
                    <button class="btn btn-secondary btn-sm" style="color: var(--danger);" onclick="window.adminPanel.deleteAccountPrompt('${acc.id}', '${acc.full_name}')" title="Xóa tài khoản này">
                      🗑️ Xóa
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderRequestsTable(requests) {
    return `
      <div style="margin-bottom: 16px;">
        <p style="color: var(--text-muted); font-size: 0.92rem;">
          Yêu cầu đặt hàng lập trình Add-in và xây dựng bộ Template chuẩn hóa do các đơn vị gửi về.
        </p>
      </div>

      <div class="admin-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Đơn vị / Khách hàng</th>
              <th>Liên hệ</th>
              <th>Loại dịch vụ</th>
              <th>Tiêu đề & Yêu cầu</th>
              <th>Ngày gửi</th>
              <th>Tiến độ</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${requests.map(req => `
              <tr>
                <td><strong>${req.customer_name}</strong></td>
                <td>
                  ${req.contact_email}<br>
                  <small style="color: var(--text-dim);">${req.phone}</small>
                </td>
                <td><span class="badge badge-custom">${req.service_type}</span></td>
                <td>
                  <strong>${req.title}</strong>
                  <p style="font-size: 0.84rem; color: var(--text-muted); margin-top: 4px;">${req.description}</p>
                </td>
                <td>${new Date(req.created_at).toLocaleDateString('vi-VN')}</td>
                <td>
                  <span class="badge ${req.status === 'completed' ? 'badge-family' : (req.status === 'in_progress' ? 'badge-tool' : 'badge-custom')}">
                    ${req.status === 'completed' ? 'Đã hoàn thành' : (req.status === 'in_progress' ? 'Đang thực hiện' : 'Tiếp nhận mới')}
                  </span>
                </td>
                <td>
                  <div style="display: flex; gap: 6px;">
                    <button class="btn btn-secondary btn-sm" onclick="window.adminPanel.updateRequestStatus('${req.id}')">
                      Chuyển trạng thái
                    </button>
                    <button class="btn btn-secondary btn-sm" style="color: var(--danger);" onclick="window.adminPanel.deleteRequestPrompt('${req.id}')" title="Xóa yêu cầu">
                      🗑️ Xóa
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderOrdersTable(orders) {
    if (orders.length === 0) {
      return `<p style="padding: 24px; color: var(--text-muted);">Chưa có đơn hàng nào.</p>`;
    }

    return `
      <div class="admin-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Mã Đơn</th>
              <th>Khách hàng</th>
              <th>Sản phẩm</th>
              <th>Tổng tiền</th>
              <th>Cổng TT</th>
              <th>Thời gian</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map(o => `
              <tr>
                <td style="font-family: var(--font-mono); font-weight: 700; color: var(--primary);">#${o.order_code}</td>
                <td>
                  <strong>${o.user_name || 'Khách'}</strong><br>
                  <small style="color: var(--text-dim);">${o.user_email}</small>
                </td>
                <td>
                  <ul style="list-style: none; padding: 0; font-size: 0.85rem;">
                    ${(o.items || []).map(i => `<li>• ${i.name}</li>`).join('')}
                  </ul>
                </td>
                <td style="font-weight: 800; color: #fff;">${window.storeApp.formatCurrency(o.total_amount)}</td>
                <td><span class="badge badge-version">VietQR Napas 24/7</span></td>
                <td>${new Date(o.created_at).toLocaleString('vi-VN')}</td>
                <td>
                  <span class="badge ${o.status === 'paid' ? 'badge-family' : 'badge-custom'}">
                    ${o.status === 'paid' ? 'Đã Thanh Toán' : 'Chờ Chuyển Khoản'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderProductsTable(products) {
    return `
      <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <p style="color: var(--text-muted); font-size: 0.92rem; margin: 0;">
          Quản lý toàn bộ danh mục Revit Tools, Family và Project Templates.
        </p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-primary btn-sm" onclick="window.storeApp.openProductEditorModal()">
            ✨ + Thêm Sản Phẩm & Niêm Yết Giá Mới
          </button>
          <button class="btn btn-secondary btn-sm" onclick="window.adminPanel.forceSyncToCloud(this)" title="Đồng bộ danh sách sản phẩm hiện tại lên máy chủ trung tâm">
            ☁️ Đồng Bộ Ngay Lên Máy Chủ
          </button>
          <button class="btn btn-secondary btn-sm" onclick="window.adminPanel.exportProductsJson()" title="Xuất file JSON danh mục sản phẩm để đồng bộ sang máy khác">
            📤 Xuất File JSON
          </button>
          <button class="btn btn-secondary btn-sm" onclick="window.adminPanel.importProductsJson()" title="Nhập file JSON danh mục sản phẩm từ máy khác">
            📥 Nạp File JSON
          </button>
        </div>
      </div>
      <div class="admin-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tên Sản Phẩm</th>
              <th>Loại</th>
              <th>Chuyên mục</th>
              <th>Giá niêm yết</th>
              <th>Video Review</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(p => `
              <tr>
                <td><strong>${p.name}</strong></td>
                <td>
                  <span class="badge ${p.product_type === 'tool' ? 'badge-tool' : (p.product_type === 'template' ? 'badge-template' : 'badge-family')}">
                    ${p.product_type.toUpperCase()}
                  </span>
                </td>
                <td>${p.category}</td>
                <td style="font-weight: 800; color: var(--primary);">${window.storeApp.formatCurrency(p.sale_price || p.price)}</td>
                <td>
                  ${p.video_url ? '<span class="badge badge-tool">🎬 Có Video</span>' : '<span style="color: var(--text-dim); font-size: 0.8rem;">Chưa có</span>'}
                </td>
                <td><span class="badge badge-family">Đang bán</span></td>
                <td>
                  <div style="display: flex; gap: 6px;">
                    <button class="btn btn-secondary btn-sm" onclick="window.storeApp.openProductEditorModal('${p.id}')" title="Sửa & Niêm Yết Giá">
                      ✏️ Sửa
                    </button>
                    <button class="btn btn-secondary btn-sm" style="color: var(--danger);" onclick="window.storeApp.deleteProduct('${p.id}')" title="Xóa">
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderLicensesTable() {
    const stats = window.licenseManager.getLicenseStats();
    const filteredLicenses = window.licenseManager.filterLicenses(this.licenseSearchQuery, this.licenseStatusFilter);
    const now = new Date();

    return `
      <!-- THỐNG KÊ CHỈ SỐ LICENSE (METRIC CARDS) -->
      <div class="license-metrics-grid">
        <div class="license-metric-box">
          <div class="license-metric-icon" style="background: var(--primary-light); color: var(--primary);">🔑</div>
          <div class="license-metric-info">
            <div class="license-metric-num">${stats.total}</div>
            <div class="license-metric-label">Tổng Key Phát Hành</div>
          </div>
        </div>

        <div class="license-metric-box">
          <div class="license-metric-icon" style="background: #ECFDF5; color: #059669;">🟢</div>
          <div class="license-metric-info">
            <div class="license-metric-num" style="color: #059669;">${stats.active}</div>
            <div class="license-metric-label">Key Đang Kích Hoạt</div>
          </div>
        </div>

        <div class="license-metric-box">
          <div class="license-metric-icon" style="background: #FFFBEB; color: #D97706;">⚠️</div>
          <div class="license-metric-info">
            <div class="license-metric-num" style="color: #D97706;">${stats.expiringSoon}</div>
            <div class="license-metric-label">Sắp Hết Hạn (≤ 30 Ngày)</div>
          </div>
        </div>

        <div class="license-metric-box">
          <div class="license-metric-icon" style="background: #EFF6FF; color: #2563EB;">🖥️</div>
          <div class="license-metric-info">
            <div class="license-metric-num" style="color: #2563EB;">${stats.totalDevices}</div>
            <div class="license-metric-label">Trạm Máy Đang Kết Nối</div>
          </div>
        </div>
      </div>

      <!-- THANH CÔNG CỤ TÌM KIẾM, LỌC VÀ HÀNH ĐỘNG -->
      <div class="license-toolbar">
        <div class="license-filter-group">
          <input type="text" class="license-search-input" placeholder="🔍 Tìm theo Key, Khách hàng, Email, Tên Tool..." value="${this.licenseSearchQuery}" oninput="window.adminPanel.handleLicenseSearch(this.value)">
          
          <select class="form-control" style="width: auto; padding: 8px 14px; border-radius: var(--radius-full);" onchange="window.adminPanel.handleLicenseFilter(this.value)">
            <option value="all" ${this.licenseStatusFilter === 'all' ? 'selected' : ''}>Mọi trạng thái (${stats.total})</option>
            <option value="active" ${this.licenseStatusFilter === 'active' ? 'selected' : ''}>🟢 Đang hoạt động (${stats.active})</option>
            <option value="expiring" ${this.licenseStatusFilter === 'expiring' ? 'selected' : ''}>⚠️ Sắp hết hạn (≤ 30 ngày)</option>
            <option value="expired" ${this.licenseStatusFilter === 'expired' ? 'selected' : ''}>⛔ Đã hết hạn (${stats.expired})</option>
            <option value="suspended" ${this.licenseStatusFilter === 'suspended' ? 'selected' : ''}>⏸️ Tạm khóa (${stats.suspended})</option>
          </select>
        </div>

        <div class="license-action-bar">
          <button class="btn btn-primary btn-sm" onclick="window.adminPanel.openManualLicenseModal()">
            ✨ + Cấp Giấy Phép Thủ Công Mới
          </button>
          <button class="btn btn-secondary btn-sm" onclick="window.licenseManager.exportLicensesCsv()">
            📥 Xuất Báo Cáo CSV (Excel)
          </button>
        </div>
      </div>

      <!-- BẢNG CHI TIẾT GIẤY PHÉP -->
      <div class="admin-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>License Key</th>
              <th>Khách Hàng & Doanh Nghiệp</th>
              <th>Sản Phẩm Add-in</th>
              <th>Gói & Máy Trạm</th>
              <th>Hạn Sử Dụng & Tiến Trình</th>
              <th>Trạng Thái</th>
              <th>Quản Trị Bản Quyền</th>
            </tr>
          </thead>
          <tbody>
            ${filteredLicenses.length === 0 ? `
              <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
                  Không tìm thấy giấy phép nào phù hợp với bộ lọc.
                </td>
              </tr>
            ` : filteredLicenses.map(l => {
              const exp = new Date(l.expiry_date);
              const remainingDays = Math.round((exp - now) / (1000 * 60 * 60 * 24));
              const isExpired = remainingDays <= 0 || l.status === 'expired';
              const isNearExpiry = remainingDays > 0 && remainingDays <= 30;
              const usedMachines = (l.activations || []).length;
              const isFull = usedMachines >= l.max_machines;

              let statusBadge = `<span class="badge badge-family">🟢 Hoạt Động</span>`;
              if (l.status === 'suspended') {
                statusBadge = `<span class="badge badge-admin">⏸️ Tạm Khóa</span>`;
              } else if (isExpired) {
                statusBadge = `<span class="badge" style="background:#FFE4E6; color:#E11D48; border:1px solid #FECDD3;">⛔ Hết Hạn</span>`;
              } else if (isNearExpiry) {
                statusBadge = `<span class="badge badge-custom">⚠️ Còn ${remainingDays} ngày</span>`;
              }

              return `
                <tr>
                  <td>
                    <div style="font-family: var(--font-mono); font-weight: 800; color: var(--primary); font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
                      <span>${l.license_key}</span>
                      <button style="border:none; background:none; cursor:pointer; font-size:0.85rem;" title="Sao chép Key" onclick="navigator.clipboard.writeText('${l.license_key}'); alert('Đã sao chép: ${l.license_key}');">📋</button>
                    </div>
                    <small style="color: var(--text-dim); font-size: 0.76rem;">${l.plan_name || 'Bản quyền điện tử'}</small>
                  </td>

                  <td>
                    <strong style="color: var(--text-pure);">${l.user_name || 'Khách Vãng Lai'}</strong><br>
                    <small style="font-family: var(--font-mono); color: var(--text-muted);">${l.user_email}</small><br>
                    <span style="font-size: 0.78rem; color: var(--text-dim);">🏢 ${l.company || 'Cá nhân'}</span>
                  </td>

                  <td>
                    <strong>${l.product_name}</strong>
                    <div style="font-size: 0.78rem; color: var(--text-dim); margin-top: 2px;">
                      Phiên bản: <span class="badge badge-version" style="font-size: 0.7rem; padding: 2px 6px;">${l.version || 'v2.4.0'}</span>
                    </div>
                  </td>

                  <td>
                    <div class="station-pill ${isFull ? 'full' : ''}" onclick="window.adminPanel.openLicenseDevicesModal('${l.id}')" title="Bấm để xem & quản lý chi tiết máy trạm">
                      <span>🖥️</span>
                      <span>${usedMachines} / ${l.max_machines} máy</span>
                      <span style="font-size: 0.7rem; opacity: 0.8;">(Xem)</span>
                    </div>
                    <div style="font-size: 0.74rem; color: var(--text-dim); margin-top: 4px;">
                      ${isFull ? '⚠️ Đã đạt giới hạn máy' : `Còn trống ${l.max_machines - usedMachines} slot`}
                    </div>
                  </td>

                  <td>
                    <div style="font-size: 0.88rem; font-weight: 700; color: ${isExpired ? 'var(--danger)' : (isNearExpiry ? 'var(--warning)' : 'var(--text-pure)')};">
                      ${exp.toLocaleDateString('vi-VN')}
                    </div>
                    <div style="font-size: 0.78rem; color: var(--text-dim);">
                      ${isExpired ? `Đã quá hạn ${Math.abs(remainingDays)} ngày` : `Còn lại ${remainingDays} ngày`}
                    </div>
                  </td>

                  <td>${statusBadge}</td>

                  <td>
                    <div class="license-action-cell">
                      <button class="btn btn-secondary btn-sm" onclick="window.adminPanel.openLicenseDevicesModal('${l.id}')" title="Xem danh sách HWID máy trạm">
                        🖥️ Máy Trạm
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="window.adminPanel.renewLicensePrompt('${l.id}')" title="Gia hạn thời gian sử dụng">
                        ⚡ Gia Hạn
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="window.adminPanel.adjustMaxMachinesPrompt('${l.id}', ${l.max_machines})" title="Thay đổi hạn mức số máy">
                        💻 Đổi Slot
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="window.adminPanel.resetLicenseDevicesPrompt('${l.id}')" title="Reset toàn bộ máy tính để khách cài lại">
                        🔄 Reset
                      </button>
                      <button class="btn btn-secondary btn-sm" style="color: ${l.status === 'suspended' ? 'var(--success)' : 'var(--danger)'};" onclick="window.adminPanel.toggleLicenseStatus('${l.id}')" title="${l.status === 'suspended' ? 'Mở khóa key' : 'Tạm khóa key'}">
                        ${l.status === 'suspended' ? '▶️ Mở' : '⏸️ Khóa'}
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="window.licenseManager.exportOfflineLicenseFile('${l.id}')" title="Tải file .LIC cho máy Offline">
                        📄 .LIC
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  handleLicenseSearch(val) {
    this.licenseSearchQuery = val;
    const container = document.getElementById('adminTabContent');
    if (container && this.currentTab === 'licenses') {
      container.innerHTML = this.renderLicensesTable();
    }
  }

  handleLicenseFilter(val) {
    this.licenseStatusFilter = val;
    const container = document.getElementById('adminTabContent');
    if (container && this.currentTab === 'licenses') {
      container.innerHTML = this.renderLicensesTable();
    }
  }

  openManualLicenseModal() {
    const modal = document.getElementById('createLicenseModalOverlay');
    const select = document.getElementById('licAddinSelect');
    if (!modal || !select) return;

    const tools = window.dataStore.getProducts().filter(p => p.product_type === 'tool');
    select.innerHTML = tools.map(t => `<option value="${t.id}">${t.name} (v${t.metadata?.version || '2.4.0'})</option>`).join('');

    // Reset fields
    const emailInput = document.getElementById('licCustomerEmail');
    const nameInput = document.getElementById('licCustomerName');
    const companyInput = document.getElementById('licCompany');
    const noteInput = document.getElementById('licNote');
    if (emailInput) emailInput.value = '';
    if (nameInput) nameInput.value = '';
    if (companyInput) companyInput.value = '';
    if (noteInput) noteInput.value = '';

    modal.classList.add('active');
  }

  closeManualLicenseModal() {
    const modal = document.getElementById('createLicenseModalOverlay');
    if (modal) modal.classList.remove('active');
  }

  handleManualLicenseSubmit(event) {
    event.preventDefault();
    const productId = document.getElementById('licAddinSelect').value;
    const product = window.dataStore.getProductById(productId);
    const email = document.getElementById('licCustomerEmail').value.trim();
    const name = document.getElementById('licCustomerName').value.trim();
    const company = document.getElementById('licCompany').value.trim();
    const durationDays = Number(document.getElementById('licDurationSelect').value) || 365;
    const maxMachines = Number(document.getElementById('licMaxMachinesSelect').value) || 1;
    const note = document.getElementById('licNote').value.trim();

    if (!product || !email) {
      alert('Vui lòng chọn sản phẩm và nhập email khách hàng!');
      return;
    }

    const newLic = window.licenseManager.createManualLicense({
      product_id: product.id,
      product_name: product.name,
      user_email: email,
      user_name: name || email.split('@')[0],
      company: company || 'Doanh Nghiệp Đối Tác',
      duration_days: durationDays,
      max_machines: maxMachines,
      subscription_type: durationDays <= 30 ? 'monthly' : 'yearly',
      plan_name: `Gói Cấp Thủ Công (${maxMachines} Máy)`,
      note: note || 'Cấp trực tiếp từ Admin Console'
    });

    this.closeManualLicenseModal();
    alert(`🎉 ĐÃ CẤP GIẤY PHÉP THÀNH CÔNG!\n\n• Mã License Key: ${newLic.license_key}\n• Khách hàng: ${newLic.user_name} (${newLic.user_email})\n• Số máy trạm: ${newLic.max_machines} máy\n• Hạn dùng: ${new Date(newLic.expiry_date).toLocaleDateString('vi-VN')}`);
    this.render();
  }

  openLicenseDevicesModal(licenseId) {
    const licenses = window.dataStore.getLicenses();
    const lic = licenses.find(l => l.id === licenseId);
    if (!lic) return;

    const modal = document.getElementById('licenseDevicesModalOverlay');
    const title = document.getElementById('licenseDevicesModalTitle');
    const body = document.getElementById('licenseDevicesModalBody');
    if (!modal || !body) return;

    if (title) {
      title.innerHTML = `🖥️ Máy Trạm Đã Kích Hoạt: <span style="font-family:var(--font-mono); color:var(--primary); font-size:1.05rem;">${lic.license_key}</span>`;
    }

    const activations = lic.activations || [];

    body.innerHTML = `
      <div style="background: #FAF3EE; border: 1px solid #EAE0D7; border-radius: var(--radius-lg); padding: 18px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <h4 style="font-size: 1.1rem; color: var(--text-pure); font-weight: 800; margin-bottom: 4px;">${lic.product_name}</h4>
            <div style="font-size: 0.85rem; color: var(--text-muted);">
              Khách hàng: <strong>${lic.user_name}</strong> (${lic.user_email}) • Đơn vị: <strong>${lic.company || 'Cá nhân'}</strong>
            </div>
          </div>
          <div style="text-align: right;">
            <span class="badge ${activations.length >= lic.max_machines ? 'badge-custom' : 'badge-family'}">
              Đang dùng ${activations.length} / ${lic.max_machines} máy
            </span>
          </div>
        </div>
      </div>

      <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <h5 style="font-weight: 800; color: var(--text-pure); font-size: 0.95rem;">Danh Sách Máy Trạm (Workstations)</h5>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" style="color: var(--danger);" onclick="window.adminPanel.resetLicenseDevicesPrompt('${lic.id}')">
            🔄 Reset Toàn Bộ Máy
          </button>
        </div>
      </div>

      ${activations.length === 0 ? `
        <div style="text-align: center; padding: 36px 20px; background: #FFFBF9; border: 1px dashed #EAE0D7; border-radius: var(--radius-lg); color: var(--text-muted);">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">💻</div>
          <p>Chưa có máy tính trạm nào kích hoạt key này.</p>
          <small style="color: var(--text-dim);">Khi kỹ sư dán mã key vào Revit Add-in, máy tính trạm sẽ lập tức xuất hiện tại đây.</small>
        </div>
      ` : `
        <div>
          ${activations.map(act => `
            <div class="device-card-item">
              <div class="device-info-col">
                <div class="device-icon-box">🖥️</div>
                <div>
                  <div style="font-weight: 800; color: var(--text-pure); font-size: 1rem; display: flex; align-items: center; gap: 8px;">
                    <span>${act.machine_name || 'BIM Workstation'}</span>
                    <button style="border:none; background:none; cursor:pointer; font-size:0.85rem;" title="Đổi tên máy" onclick="window.adminPanel.adminRenameDevice('${lic.id}', '${act.machine_id}', '${act.machine_name || ''}')">✏️</button>
                  </div>
                  <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--primary); margin-top: 2px;">
                    HWID: ${act.machine_id}
                  </div>
                  <div style="font-size: 0.78rem; color: var(--text-dim); margin-top: 4px;">
                    HĐH: <strong>${act.os_info || 'Windows 11'}</strong> • Bản Revit: <span class="badge badge-version" style="font-size: 0.68rem; padding: 1px 6px;">${act.revit_version || '2025'}</span> • IP: ${act.ip_address || '118.70.182.45'}
                  </div>
                  <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">
                    Heartbeat gần nhất: ${new Date(act.last_checked_at).toLocaleString('vi-VN')}
                  </div>
                </div>
              </div>

              <div>
                <button class="btn btn-secondary btn-sm" style="color: var(--danger);" onclick="window.adminPanel.adminDeactivateDevice('${lic.id}', '${act.machine_id}')">
                  🗑️ Gỡ Máy Này
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;

    modal.classList.add('active');
  }

  closeLicenseDevicesModal() {
    const modal = document.getElementById('licenseDevicesModalOverlay');
    if (modal) modal.classList.remove('active');
  }

  adminRenameDevice(licenseId, machineId, currentName) {
    const newName = prompt('Nhập tên gợi nhớ mới cho máy tính trạm này:', currentName);
    if (newName && newName.trim()) {
      window.licenseManager.renameMachine(licenseId, machineId, newName.trim());
      this.openLicenseDevicesModal(licenseId);
      this.render();
    }
  }

  adminDeactivateDevice(licenseId, machineId) {
    if (confirm('Bạn có chắc muốn gỡ bỏ máy tính trạm này? Khe kích hoạt sẽ được giải phóng để kỹ sư có thể kích hoạt trên máy mới.')) {
      window.licenseManager.deactivateSingleMachine(licenseId, machineId);
      this.openLicenseDevicesModal(licenseId);
      this.render();
    }
  }

  renderSettingsTab() {
    const bankCfg = window.dataStore.getBankConfig();
    const previewQrUrl = `https://img.vietqr.io/image/${bankCfg.bankId}-${bankCfg.accountNo}-compact2.png?amount=50000&addInfo=DOANSON%20DEMO&accountName=${encodeURIComponent(bankCfg.accountName)}`;

    return `
      <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 24px; align-items: start;">
        <!-- CỘT TRÁI: FORM CÀI ĐẶT 1 TÀI KHOẢN NHẬN TIỀN DUY NHẤT -->
        <div style="background: #FFFFFF; border: var(--border-light); border-radius: var(--radius-xl); padding: 28px; box-shadow: var(--shadow-sm);">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
            <div style="font-size: 2.2rem;">🏦</div>
            <div>
              <h3 style="font-family: var(--font-heading); font-size: 1.25rem; color: var(--text-pure); margin-bottom: 2px;">
                Cấu Hình Tài Khoản Nhận Tiền VietQR Napas 24/7
              </h3>
              <p style="font-size: 0.86rem; color: var(--text-muted); margin: 0;">
                Hệ thống sử dụng DUY NHẤT 1 tài khoản này để tạo mã VietQR tự động cho khách hàng.
              </p>
            </div>
          </div>

          <!-- BANNER TRẠNG THÁI 1 TÀI KHOẢN DUY NHẤT -->
          <div style="background: #ECFDF5; border: 1.5px solid #A7F3D0; border-radius: var(--radius-md); padding: 14px 16px; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #065F46; font-size: 0.92rem; margin-bottom: 4px;">
              <span>🟢</span>
              <span>1 Tài khoản nhận tiền duy nhất đang kích hoạt toàn hệ thống</span>
            </div>
            <p style="font-size: 0.84rem; color: #047857; margin: 0; line-height: 1.5;">
              Ngân hàng: <strong>${bankCfg.bankName}</strong> | STK: <strong style="letter-spacing: 0.5px;">${bankCfg.accountNo}</strong> | Chủ TK: <strong>${bankCfg.accountName}</strong>
            </p>
          </div>

          <form onsubmit="window.adminPanel.handleSaveBankSettings(event)">
            <div class="form-group">
              <label>Ngân hàng nhận tiền *</label>
              <select id="cfgBankSelect" class="form-control" required>
                <option value="970422|Ngân hàng TMCP Quân Đội (MB Bank)" ${bankCfg.bankId === '970422' ? 'selected' : ''}>MB Bank (Ngân hàng TMCP Quân Đội - BIN 970422)</option>
                <option value="970436|Ngân hàng Ngoại thương Việt Nam (Vietcombank)" ${bankCfg.bankId === '970436' || bankCfg.bankId === 'VCB' ? 'selected' : ''}>Vietcombank (BIN 970436)</option>
                <option value="970407|Ngân hàng Kỹ thương Việt Nam (Techcombank)" ${bankCfg.bankId === '970407' || bankCfg.bankId === 'TCB' ? 'selected' : ''}>Techcombank (BIN 970407)</option>
                <option value="970432|Ngân hàng Việt Nam Thịnh Vượng (VPBank)" ${bankCfg.bankId === '970432' || bankCfg.bankId === 'VPB' ? 'selected' : ''}>VPBank (BIN 970432)</option>
                <option value="970416|Ngân hàng Á Châu (ACB)" ${bankCfg.bankId === '970416' || bankCfg.bankId === 'ACB' ? 'selected' : ''}>ACB (BIN 970416)</option>
                <option value="970418|Ngân hàng Đầu tư và Phát triển (BIDV)" ${bankCfg.bankId === '970418' || bankCfg.bankId === 'BIDV' ? 'selected' : ''}>BIDV (BIN 970418)</option>
                <option value="970405|Ngân hàng Nông nghiệp (Agribank)" ${bankCfg.bankId === '970405' ? 'selected' : ''}>Agribank (BIN 970405)</option>
                <option value="970423|Ngân hàng Tiên Phong (TPBank)" ${bankCfg.bankId === '970423' ? 'selected' : ''}>TPBank (BIN 970423)</option>
                <option value="970403|Ngân hàng TMCP Sài Gòn Thương Tín (Sacombank)" ${bankCfg.bankId === '970403' ? 'selected' : ''}>Sacombank (BIN 970403)</option>
                <option value="970448|Ngân hàng Phương Đông (OCB)" ${bankCfg.bankId === '970448' ? 'selected' : ''}>OCB (BIN 970448)</option>
                <option value="970415|Ngân hàng Công Thương Việt Nam (VietinBank)" ${bankCfg.bankId === '970415' ? 'selected' : ''}>VietinBank (BIN 970415)</option>
                <option value="970429|Ngân hàng Sài Gòn (SCB)" ${bankCfg.bankId === '970429' ? 'selected' : ''}>SCB (BIN 970429)</option>
              </select>
            </div>

            <div class="form-group">
              <label>Số tài khoản thụ hưởng (STK) *</label>
              <input type="text" id="cfgAccountNo" class="form-control" value="${bankCfg.accountNo || ''}" placeholder="Ví dụ: 0908123456" required>
            </div>

            <div class="form-group">
              <label>Tên chủ tài khoản (In hoa không dấu) *</label>
              <input type="text" id="cfgAccountName" class="form-control" value="${bankCfg.accountName || ''}" placeholder="Ví dụ: DOAN THANH SON" required>
            </div>

            <div class="form-group">
              <label>Cú pháp tiền tố chuyển khoản</label>
              <input type="text" class="form-control" value="DOANSON <Mã_Đơn_Hàng>" disabled style="background: #F3EAE3; color: var(--text-muted);">
              <small style="color: var(--text-dim); margin-top: 4px; display: block;">Hệ thống tự động nối tiền tố DOANSON với mã đơn hàng 6 số để nhận diện giao dịch.</small>
            </div>

            <button type="submit" id="saveBankBtn" class="btn btn-primary" style="width: 100%; margin-top: 10px;">
              💾 Lưu Cấu Hình & Đồng Bộ Toàn Hệ Thống
            </button>
          </form>
        </div>

        <!-- CỘT PHẢI: XEM TRƯỚC MÃ VIETQR TRỰC TIẾP -->
        <div style="background: #FFFFFF; border: var(--border-light); border-radius: var(--radius-xl); padding: 24px; box-shadow: var(--shadow-sm); text-align: center;">
          <h4 style="font-family: var(--font-heading); font-size: 1.05rem; color: var(--text-pure); margin-bottom: 6px;">
            📱 Xem Trước Mã VietQR
          </h4>
          <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 16px;">
            Bạn có thể dùng App Ngân hàng quét thử mã này ngay trên màn hình để kiểm tra STK và Tên chủ tài khoản:
          </p>

          <div style="background: #F8FAFC; border: 2px dashed #CBD5E1; border-radius: var(--radius-lg); padding: 16px; display: inline-block; margin-bottom: 14px;">
            <img src="${previewQrUrl}" alt="Xem trước mã VietQR" style="max-width: 220px; width: 100%; height: auto; border-radius: 8px;">
          </div>

          <div style="font-size: 0.85rem; color: var(--text-pure); background: #FAF3EE; padding: 10px 14px; border-radius: var(--radius-md); text-align: left; line-height: 1.6;">
            <div>🏦 <strong>${bankCfg.bankName}</strong></div>
            <div>💳 STK: <strong>${bankCfg.accountNo}</strong></div>
            <div>👤 Tên: <strong>${bankCfg.accountName}</strong></div>
          </div>
        </div>
      </div>
    `;
  }

  async handleSaveBankSettings(e) {
    e.preventDefault();
    const bankVal = document.getElementById('cfgBankSelect').value.split('|');
    const bankId = bankVal[0];
    const bankName = bankVal[1];
    const accountNo = document.getElementById('cfgAccountNo').value.trim();
    const accountName = document.getElementById('cfgAccountName').value.trim().toUpperCase();

    if (!accountNo || !accountName) {
      alert('Vui lòng điền đủ Số tài khoản và Tên chủ tài khoản.');
      return;
    }

    const btn = document.getElementById('saveBankBtn');
    const origText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Đang lưu & đồng bộ lên máy chủ trung tâm...';
    }

    const res = await window.dataStore.saveBankConfig({
      bankId,
      bankName,
      accountNo,
      accountName,
      template: 'compact2'
    });

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origText;
    }

    if (res && res.success) {
      alert(`🎉 ĐÃ ĐỒNG BỘ THÀNH CÔNG TÀI KHOẢN NHẬN TIỀN LÊN MÁY CHỦ!\n\n• Ngân hàng: ${bankName}\n• Số tài khoản: ${accountNo}\n• Chủ tài khoản: ${accountName}\n\nMọi khách hàng mua sản phẩm trên máy tính hoặc điện thoại đều sẽ quét mã VietQR thanh toán vào tài khoản này.`);
    } else {
      alert(`Đã lưu cấu hình tài khoản nhận tiền vào bộ nhớ!\n(Lưu ý: Đang đồng bộ nền sang máy chủ trung tâm)`);
    }

    this.render();
  }

  toggleLicenseStatus(licenseId) {
    const updated = window.licenseManager.toggleLicenseStatus(licenseId);
    if (updated) {
      this.render();
    }
  }

  renewLicensePrompt(licenseId) {
    const daysStr = prompt('Nhập số ngày muốn gia hạn (Ví dụ: 365 = 1 năm, 30 = 1 tháng, 1095 = 3 năm):', '365');
    if (!daysStr) return;
    const days = Number(daysStr);
    if (isNaN(days) || days <= 0) {
      alert('Số ngày không hợp lệ!');
      return;
    }
    const updated = window.licenseManager.renewLicense(licenseId, days);
    if (updated) {
      alert(`Đã gia hạn thành công thêm ${days} ngày! Hạn mới: ${new Date(updated.expiry_date).toLocaleDateString('vi-VN')}`);
      this.render();
    }
  }

  adjustMaxMachinesPrompt(licenseId, currentMax) {
    const newMaxStr = prompt(`Hạn mức số máy hiện tại: ${currentMax} máy.\nNhập số lượng máy tối đa mới cho phép kích hoạt:`, currentMax);
    if (!newMaxStr) return;
    const newMax = Number(newMaxStr);
    if (isNaN(newMax) || newMax < 1) {
      alert('Số lượng máy phải từ 1 trở lên!');
      return;
    }
    const updated = window.licenseManager.adjustMaxMachines(licenseId, newMax);
    if (updated) {
      alert(`Đã cập nhật hạn mức thành công: ${newMax} máy!`);
      this.render();
    }
  }

  resetLicenseDevicesPrompt(licenseId) {
    if (confirm('⚠️ BẠN CÓ CHẮC CHẮN MUỐN RESET TOÀN BỘ MÁY TRẠM?\n\nMọi máy tính đang liên kết với key này sẽ bị hủy kích hoạt. Khách hàng sẽ phải nhập lại key từ Revit để liên kết lại.')) {
      window.licenseManager.resetAllActivations(licenseId);
      this.closeLicenseDevicesModal();
      alert('Đã reset toàn bộ máy trạm thành công!');
      this.render();
    }
  }

  toggleRole(accId) {
    const accounts = window.dataStore.getAccounts();
    const acc = accounts.find(a => a.id === accId);
    if (!acc) return;
    acc.role = acc.role === 'admin' ? 'customer' : 'admin';
    window.dataStore.saveAccount(acc);
    alert(`Đã chuyển quyền của ${acc.full_name} thành: ${acc.role.toUpperCase()}`);
    this.render();
  }

  toggleStatus(accId) {
    const accounts = window.dataStore.getAccounts();
    const acc = accounts.find(a => a.id === accId);
    if (!acc) return;
    acc.status = acc.status === 'active' ? 'suspended' : 'active';
    window.dataStore.saveAccount(acc);
    this.render();
  }

  updateRequestStatus(reqId) {
    const requests = window.dataStore.getCustomRequests();
    const req = requests.find(r => r.id === reqId);
    if (!req) return;
    if (req.status === 'new') req.status = 'in_progress';
    else if (req.status === 'in_progress') req.status = 'completed';
    else req.status = 'new';
    window.dataStore.save('custom_requests', requests);
    this.render();
  }

  deleteAccountPrompt(accId, accName) {
    const currentUser = window.authManager.getCurrentUser();
    if (currentUser && currentUser.id === accId) {
      alert('Không thể xóa tài khoản bạn đang đăng nhập!');
      return;
    }
    if (confirm(`⚠️ Bạn có chắc chắn muốn xóa tài khoản "${accName}"?\nHành động này không thể hoàn tác.`)) {
      window.dataStore.deleteAccount(accId);
      alert(`Đã xóa tài khoản "${accName}" thành công!`);
      this.render();
    }
  }

  deleteRequestPrompt(reqId) {
    if (confirm('⚠️ Bạn có chắc chắn muốn xóa yêu cầu dịch vụ này?')) {
      window.dataStore.deleteCustomRequest(reqId);
      alert('Đã xóa yêu cầu thành công!');
      this.render();
    }
  }

  addNewAccountPrompt() {
    const email = prompt('Nhập Email:');
    if (!email) return;
    const name = prompt('Nhập Họ và tên:');
    const role = confirm('Cấp quyền Admin? Bấm OK nếu là Admin, Cancel nếu là Kỹ sư') ? 'admin' : 'customer';
    window.dataStore.saveAccount({
      id: 'acc-' + Date.now().toString(16),
      email,
      full_name: name || email.split('@')[0],
      phone: '0901234567',
      company: 'BIM Engineering Corp',
      role,
      status: 'active',
    });
    alert('Đã tạo tài khoản mới thành công!');
    this.render();
  }

  exportProductsJson() {
    const products = window.dataStore.getProducts();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(products, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `DoanSon_Products_Backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    alert('✅ Đã xuất file JSON thành công! Bạn có thể mang file này nạp sang máy tính hoặc trình duyệt khác.');
  }

  importProductsJson() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (Array.isArray(imported)) {
            window.dataStore.save('products', imported);
            alert(`🎉 Nạp thành công ${imported.length} sản phẩm vào cơ sở dữ liệu!`);
            this.render();
            if (window.storeApp) window.storeApp.renderProducts();
          } else {
            alert('File JSON không đúng cấu trúc danh sách sản phẩm!');
          }
        } catch (err) {
          alert('Lỗi đọc file JSON: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  async forceSyncToCloud(btnEl) {
    const origText = btnEl ? btnEl.innerHTML : '';
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.innerHTML = '⏳ Đang đồng bộ...';
    }

    const products = window.dataStore.getProducts();
    const res = await window.dataStore.syncProductsToGitHub(products);

    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerHTML = origText;
    }

    if (res && res.success) {
      alert(`🎉 Đã đồng bộ thành công ${products.length} sản phẩm lên máy chủ trung tâm!\nMọi người dùng mở website trên máy tính của họ sẽ thấy ngay danh mục này.`);
    } else {
      alert(`⚠️ Đồng bộ thất bại: ${res ? res.message : 'Lỗi kết nối'}\nBạn vẫn có thể dùng nút 'Xuất File JSON' để nạp sang máy khác.`);
    }
  }

  cleanupDummyAccounts() {
    if (confirm('Bạn có chắc chắn muốn dọn dẹp và xóa toàn bộ các tài khoản ảo mặc định (như admin@revitstore.vn, engineer.bim...)?\nHệ thống sẽ chỉ giữ lại duy nhất 1 tài khoản chính chủ của bạn (sonbigcar).')) {
      const remaining = window.dataStore.cleanupDummyAccounts();
      alert(`🎉 Đã dọn dẹp thành công!\nHiện tại hệ thống chỉ còn ${remaining.length} tài khoản thực tế (Admin sonbigcar).`);
      this.render();
    }
  }
}

window.adminPanel = new AdminPanel();
