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
    this._hasFetchedInitialOrders = false;
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
            Tab này dành riêng cho Quản Trị Viên (Admin) quản lý sản phẩm, đơn hàng, tài khoản và bản quyền.
          </p>
          <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="window.storeApp.openAuthModal()">
              🔐 Đăng Nhập Mật Khẩu Admin
            </button>
            <button class="btn btn-secondary" style="border-color: var(--primary); color: var(--primary); font-weight: 700;" onclick="window.adminPanel.quickLoginAdmin()">
              ⚡ Đăng Nhập Nhanh (Chủ Cửa Hàng sonbigcar)
            </button>
          </div>
        </div>
      `;
      return;
    }

    if (!this._hasFetchedInitialOrders && window.dataStore && typeof window.dataStore.fetchRemoteOrders === 'function') {
      this._hasFetchedInitialOrders = true;
      Promise.all([
        window.dataStore.fetchRemoteOrders(),
        window.dataStore.fetchRemoteCustomRequests ? window.dataStore.fetchRemoteCustomRequests() : Promise.resolve()
      ]).then(() => {
        this.render();
      }).catch(() => {});
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
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-sm" onclick="window.storeApp.openPillarEditorModal()" style="font-weight: 700; border-color: var(--primary); color: var(--primary); display: inline-flex; align-items: center; gap: 6px;">
                <span>✏️</span> Sửa 3 Thẻ Trụ Cột Trang Chủ
              </button>
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

  async switchTab(tab) {
    this.currentTab = tab;
    this.render();
    if (tab === 'orders' && window.dataStore && typeof window.dataStore.fetchRemoteOrders === 'function') {
      await window.dataStore.fetchRemoteOrders();
      this.render();
    }
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
              <th>Gói Bản Quyền Sở Hữu</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            ${accounts.map(acc => {
              const userLics = window.dataStore.getLicensesByAccount ? window.dataStore.getLicensesByAccount(acc) : [];
              let licSummaryHtml = '';
              if (!userLics || userLics.length === 0) {
                licSummaryHtml = `<span style="font-size: 0.8rem; color: var(--text-dim);">Chưa có license</span>`;
              } else {
                licSummaryHtml = userLics.map(l => {
                  const mods = l.allowed_modules || ['MEP-ALL'];
                  const isAll = mods.includes('MEP-ALL') || mods.length >= 6;
                  const badgeColor = isAll ? '#4F46E5' : '#0284C7';
                  const badgeBg = isAll ? '#EEF2FF' : '#E0F2FE';
                  const usedCount = (l.activations || []).length;
                  return `
                    <div style="margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                      <span class="badge" style="background: ${badgeBg}; color: ${badgeColor}; font-size: 0.72rem; font-weight: 700; white-space: nowrap;">
                        ${l.plan_name || 'Bản quyền Tools'}
                      </span>
                      <span style="font-size: 0.72rem; color: var(--text-dim); font-family: var(--font-mono);">
                        (${usedCount}/${l.max_machines} máy)
                      </span>
                    </div>
                  `;
                }).join('');
              }

              return `
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
                    ${licSummaryHtml}
                  </td>
                  <td>
                    <span class="badge ${acc.status === 'active' ? 'badge-family' : 'badge-admin'}">
                      ${acc.status === 'active' ? 'Hoạt động' : 'Đã khóa'}
                    </span>
                  </td>
                  <td>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                      <button class="btn btn-primary btn-sm" style="background: #4F46E5; border-color: #4F46E5; color: #FFFFFF; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25);" onclick="window.adminPanel.openAccountLicenseModal('${acc.id}')" title="Điều chỉnh hoặc thay đổi loại bản quyền cho tài khoản này">
                        ⚙️ Điều Chỉnh Loại Bản Quyền
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="window.adminPanel.toggleRole('${acc.id}')" title="Đổi quyền Admin / Customer">
                        ${acc.role === 'admin' ? 'Hạ Kỹ sư' : 'Lên Admin'}
                      </button>
                      <button class="btn btn-secondary btn-sm" style="color: ${acc.status === 'active' ? 'var(--danger)' : 'var(--success)'};" onclick="window.adminPanel.toggleStatus('${acc.id}')">
                        ${acc.status === 'active' ? 'Khóa' : 'Mở'}
                      </button>
                      <button class="btn btn-secondary btn-sm" style="color: var(--danger);" onclick="window.adminPanel.deleteAccountPrompt('${acc.id}', '${acc.full_name}')" title="Xóa tài khoản này">
                        🗑️
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
    const pendingApprovalOrders = orders.filter(o => o.status === 'pending_approval');

    if (orders.length === 0) {
      return `
        <div style="background: #FFFFFF; border: var(--border-light); border-radius: var(--radius-xl); padding: 48px 24px; text-align: center; box-shadow: var(--shadow-sm); margin-bottom: 24px;">
          <div style="font-size: 3rem; margin-bottom: 12px;">📦</div>
          <h3 style="font-family: var(--font-heading); font-size: 1.25rem; color: var(--text-pure); margin-bottom: 6px;">
            Chưa có đơn hàng nào được lưu trong bộ nhớ máy này
          </h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 500px; margin: 0 auto 20px; line-height: 1.6;">
            Nếu khách hàng đã mua sản phẩm và chuyển khoản trên máy tính khác, bấm nút bên dưới để hệ thống lập tức kết nối và tải toàn bộ đơn hàng từ máy chủ trung tâm về:
          </p>
          <button class="btn btn-primary" onclick="window.adminPanel.refreshOrdersFromCloud(this)">
            🔄 Tải Đơn Hàng Mới Nhất Từ Máy Chủ Trung Tâm
          </button>
        </div>
      `;
    }

    return `
      <!-- THÔNG BÁO NỔI BẬT NẾU CÓ ĐƠN KHÁCH BÁO ĐÃ CHUYỂN KHOẢN -->
      ${pendingApprovalOrders.length > 0 ? `
        <div style="background: #FFFBEB; border: 2px solid #F59E0B; border-radius: var(--radius-lg); padding: 16px 20px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 1.8rem;">🔔</div>
            <div>
              <strong style="font-size: 1.05rem; color: #92400E; display: block; margin-bottom: 2px;">
                CÓ ${pendingApprovalOrders.length} ĐƠN HÀNG KHÁCH BÁO ĐÃ CHUYỂN KHOẢN - ĐANG CHỜ DUYỆT!
              </strong>
              <span style="font-size: 0.86rem; color: #78350F;">
                Vui lòng mở ứng dụng ngân hàng đối soát đúng số tiền và nội dung CK, sau đó bấm <strong>"✅ Duyệt Đã Nhận Tiền"</strong> để hệ thống cấp bản quyền tức thì cho khách.
              </span>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="window.adminPanel.refreshOrdersFromCloud(this)" style="font-weight: 700; border-color: #F59E0B; color: #92400E;">
            🔄 Làm Mới Danh Sách
          </button>
        </div>
      ` : ''}

      <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <p style="color: var(--text-muted); font-size: 0.92rem; margin: 0;">
            Quản lý toàn bộ đơn hàng trên toàn hệ thống (Tổng cộng: <strong>${orders.length} đơn</strong>).
          </p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" onclick="window.adminPanel.refreshOrdersFromCloud(this)" title="Đồng bộ và tải ngay các đơn hàng mới nhất từ toàn bộ khách hàng trên máy chủ trung tâm">
            🔄 Đồng Bộ & Tải Đơn Hàng Mới Nhất
          </button>
        </div>
      </div>

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
              <th>Thao Tác Duyệt Đơn</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map(o => `
              <tr style="${o.status === 'pending_approval' ? 'background: #FFFDF5;' : ''}">
                <td style="font-family: var(--font-mono); font-weight: 700; color: var(--primary);">
                  #${o.order_code}
                </td>
                <td>
                  <strong>${o.user_name || 'Khách'}</strong><br>
                  <small style="color: var(--text-dim);">${o.user_email}</small>
                </td>
                <td>
                  <ul style="list-style: none; padding: 0; font-size: 0.85rem;">
                    ${(o.items || []).map(i => `<li>• ${i.name}</li>`).join('')}
                  </ul>
                </td>
                <td style="font-weight: 800; color: var(--text-pure); font-size: 1rem;">
                  ${window.storeApp.formatCurrency(o.total_amount)}
                </td>
                <td>
                  <span class="badge badge-version">VietQR Napas 24/7</span><br>
                  <small style="font-family: var(--font-mono); color: var(--text-dim); font-size: 0.74rem;">${o.transfer_content || 'DOANSON ' + o.order_code}</small>
                </td>
                <td>
                  <span style="font-size: 0.85rem;">${new Date(o.created_at).toLocaleString('vi-VN')}</span>
                  ${o.notified_at ? `<br><small style="color: #B45309; font-weight: 600;">Khách báo CK: ${new Date(o.notified_at).toLocaleTimeString('vi-VN')}</small>` : ''}
                </td>
                <td>
                  ${o.status === 'paid' 
                    ? '<span class="badge badge-family" style="font-weight: 700;">🟢 Đã Thanh Toán</span>'
                    : (o.status === 'pending_approval'
                        ? '<span class="badge" style="background: #FEF3C7; color: #B45309; border: 1.5px solid #F59E0B; font-weight: 800;">🔔 Chờ Duyệt (Khách Đã CK)</span>'
                        : (o.status === 'cancelled'
                            ? '<span class="badge badge-admin">❌ Đã Hủy</span>'
                            : '<span class="badge badge-version">⏳ Chờ Chuyển Khoản</span>'))
                  }
                </td>
                <td>
                  <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    ${o.status !== 'paid' ? `
                      <button class="btn btn-primary btn-sm" style="${o.status === 'pending_approval' ? 'font-weight: 800; box-shadow: 0 2px 8px rgba(224, 90, 43, 0.4);' : ''}" onclick="window.adminPanel.approveOrderPrompt(${o.order_code}, ${o.total_amount})" title="Kiểm tra tiền đã vào tài khoản và bấm duyệt để cấp license">
                        ✅ Duyệt Đã Nhận Tiền
                      </button>
                      <button class="btn btn-secondary btn-sm" style="color: var(--danger);" onclick="window.adminPanel.rejectOrderPrompt(${o.order_code})" title="Từ chối đơn hàng">
                        ❌ Hủy đơn
                      </button>
                    ` : `
                      <span style="color: var(--success); font-weight: 700; font-size: 0.85rem; padding: 4px 6px;">✓ Đã Kích Hoạt</span>
                    `}
                    <button class="btn btn-secondary btn-sm" style="color: var(--text-dim);" onclick="window.adminPanel.deleteOrderPrompt('${o.id}')" title="Xóa đơn hàng này">
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
          <button class="btn btn-secondary btn-sm" style="font-weight: 700; border-color: #818CF8; color: #4F46E5; background: #EEF2FF;" onclick="window.adminPanel.openPackageManagerModal()" title="Cấu hình & Đăng ký thêm các loại gói module bản quyền">
            🧩 Gói Bản Quyền
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

      <!-- BANNER NỔI BẬT: QUẢN LÝ & ĐĂNG KÝ GÓI BẢN QUYỀN -->
      <div style="background: linear-gradient(135deg, #FAF5FF 0%, #EEF2FF 100%); border: 2px solid #C7D2FE; border-radius: var(--radius-lg); padding: 18px 24px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.08);">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="font-size: 1.5rem;">🧩</span>
            <strong style="font-size: 1.15rem; color: #3730A3;">Cấu Hình & Đăng Ký Các Gói Module Bản Quyền</strong>
            <span class="badge" style="background: #4F46E5; color: #fff; font-size: 0.72rem; font-weight: 700;">Full VIP • Duct • Pipe • Elec</span>
          </div>
          <p style="font-size: 0.86rem; color: #4338CA; margin: 0;">
            Đăng ký thêm gói module mới (Combo Duct+Pipe, Combo Duct+Elec, Gói lẻ...) và định giá niêm yết bán trên Store.
          </p>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn btn-primary" style="background: #4F46E5; border-color: #4F46E5; font-weight: 800; font-size: 0.92rem; padding: 10px 18px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35); display: inline-flex; align-items: center; gap: 6px;" onclick="window.adminPanel.openPackageManagerModal()">
            <span>🧩</span> Gói Bản Quyền: Đăng Ký & Quản Lý Gói Mới
          </button>
          <button class="btn btn-primary" onclick="window.adminPanel.openManualLicenseModal()" style="display: inline-flex; align-items: center; gap: 6px;">
            <span>✨</span> + Cấp Giấy Phép Thủ Công Mới
          </button>
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

        <div class="license-action-bar" style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" style="color: #4F46E5; font-weight: 800; border-color: #818CF8; background: #EEF2FF; display: inline-flex; align-items: center; gap: 4px;" onclick="window.adminPanel.openPackageManagerModal()">
            <span>🧩</span> Gói Bản Quyền
          </button>
          <button class="btn btn-primary btn-sm" onclick="window.adminPanel.openManualLicenseModal()">
            ✨ + Cấp Key Thủ Công
          </button>
          <button class="btn btn-secondary btn-sm" onclick="window.licenseManager.exportLicensesCsv()">
            📥 Xuất CSV (Excel)
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
                    <div style="margin-top: 5px; cursor: pointer;" onclick="window.adminPanel.openEditModulesModal('${l.id}')" title="Bấm để chỉnh sửa phân quyền module của key này">
                      ${(() => {
                        const moduleMap = {
                          'MEP-DUCT': '❄️ Duct',
                          'MEP-PIPE': '🚰 Pipe',
                          'MEP-SHEET': '📑 Sheet',
                          'MEP-FIRE': '🧯 Fire',
                          'MEP-ELEC': '⚡ Elec',
                          'MEP-AI': '🤖 AI',
                          'MEP-ALL': '⭐ Full VIP'
                        };
                        const mods = l.allowed_modules || ['MEP-ALL'];
                        if (mods.includes('MEP-ALL') || mods.length >= 6) {
                          return `<span class="badge" style="background:#EEF2FF; color:#4F46E5; font-size:0.7rem; font-weight:700;">⭐ Full VIP (Tất Cả Tools)</span>`;
                        }
                        return mods.map(m => `<span class="badge" style="background:#F1F5F9; color:#334155; font-size:0.68rem; margin-right:3px;">${moduleMap[m] || m}</span>`).join('');
                      })()}
                      <span style="font-size: 0.72rem; color: var(--primary); text-decoration: underline; margin-left: 4px;">✏️ Sửa</span>
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
                      <button class="btn btn-secondary btn-sm" style="color: #4F46E5; font-weight: 700; border-color: rgba(79, 70, 229, 0.35); background: #EEF2FF;" onclick="window.adminPanel.openEditModulesModal('${l.id}')" title="Chỉnh sửa gói module (Full VIP, Duct, Pipe, Elec...)">
                        🧩 Sửa Module
                      </button>
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

  selectModulePreset(preset) {
    const checkboxes = document.querySelectorAll('input[name="licModuleCheck"]');
    checkboxes.forEach(cb => {
      if (preset === 'all') {
        cb.checked = true;
      } else if (preset === 'duct_pipe') {
        cb.checked = (cb.value === 'MEP-DUCT' || cb.value === 'MEP-PIPE');
      } else if (preset === 'duct_elec') {
        cb.checked = (cb.value === 'MEP-DUCT' || cb.value === 'MEP-ELEC');
      }
    });
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

    const checkedBoxes = Array.from(document.querySelectorAll('input[name="licModuleCheck"]:checked'));
    const allowedModules = checkedBoxes.map(cb => cb.value);
    if (allowedModules.length === 0) {
      alert('Vui lòng chọn ít nhất 1 module cho giấy phép!');
      return;
    }

    const isAll = allowedModules.length >= 6;
    const finalModules = isAll ? ['MEP-ALL'] : allowedModules;
    const planName = isAll
      ? `Gói Full VIP (Tất Cả Tools - ${maxMachines} Máy)`
      : `Gói Combo (${allowedModules.map(m => m.replace('MEP-', '')).join(' + ')} - ${maxMachines} Máy)`;

    const newLic = window.licenseManager.createManualLicense({
      product_id: product.id,
      product_name: product.name,
      user_email: email,
      user_name: name || email.split('@')[0],
      company: company || 'Doanh Nghiệp Đối Tác',
      duration_days: durationDays,
      max_machines: maxMachines,
      allowed_modules: finalModules,
      subscription_type: durationDays <= 30 ? 'monthly' : 'yearly',
      plan_name: planName,
      note: note || 'Cấp trực tiếp từ Admin Console'
    });

    this.closeManualLicenseModal();
    alert(`🎉 ĐÃ CẤP GIẤY PHÉP THÀNH CÔNG!\n\n• Mã License Key: ${newLic.license_key}\n• Gói Module: ${planName}\n• Khách hàng: ${newLic.user_name} (${newLic.user_email})\n• Số máy trạm: ${newLic.max_machines} máy\n• Hạn dùng: ${new Date(newLic.expiry_date).toLocaleDateString('vi-VN')}`);
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

  openEditModulesModal(licenseId) {
    const licenses = window.dataStore.getLicenses();
    const lic = licenses.find(l => l.id === licenseId);
    if (!lic) return;

    document.getElementById('editLicId').value = lic.id;
    document.getElementById('editLicKeyDisplay').textContent = lic.license_key;
    document.getElementById('editLicUserDisplay').textContent =
      `Khách hàng: ${lic.user_name} (${lic.user_email}) • Đơn vị: ${lic.company || 'Cá nhân'} • Gói hiện tại: ${lic.plan_name || 'Tùy chỉnh'}`;

    const mods = lic.allowed_modules || ['MEP-ALL'];
    const isAll = mods.includes('MEP-ALL') || mods.length >= 6;

    const checkboxes = document.querySelectorAll('input[name="editLicModuleCheck"]');
    checkboxes.forEach(cb => {
      if (isAll) {
        cb.checked = true;
      } else {
        cb.checked = mods.includes(cb.value);
      }
    });

    const modal = document.getElementById('editLicenseModulesModalOverlay');
    if (modal) modal.classList.add('active');
  }

  closeEditModulesModal() {
    const modal = document.getElementById('editLicenseModulesModalOverlay');
    if (modal) modal.classList.remove('active');
  }

  setEditModulePreset(preset) {
    const checkboxes = document.querySelectorAll('input[name="editLicModuleCheck"]');
    checkboxes.forEach(cb => {
      if (preset === 'all') {
        cb.checked = true;
      } else if (preset === 'duct_pipe') {
        cb.checked = (cb.value === 'MEP-DUCT' || cb.value === 'MEP-PIPE');
      } else if (preset === 'duct_elec') {
        cb.checked = (cb.value === 'MEP-DUCT' || cb.value === 'MEP-ELEC');
      } else if (preset === 'duct_only') {
        cb.checked = (cb.value === 'MEP-DUCT');
      } else if (preset === 'pipe_only') {
        cb.checked = (cb.value === 'MEP-PIPE');
      }
    });
  }

  async saveEditModules() {
    const licId = document.getElementById('editLicId').value;
    const checkboxes = document.querySelectorAll('input[name="editLicModuleCheck"]:checked');
    const selected = Array.from(checkboxes).map(cb => cb.value);

    if (selected.length === 0) {
      alert('Vui lòng chọn ít nhất 1 module cho giấy phép!');
      return;
    }

    const updated = window.licenseManager.updateLicenseModules(licId, selected);
    if (!updated) {
      alert('Không tìm thấy giấy phép để cập nhật!');
      return;
    }

    // Đồng bộ lên Server API để máy trạm Revit Add-in nhận ngay khi gọi Verify
    try {
      await fetch('/api/v1/license/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: updated.license_key,
          allowed_modules: updated.allowed_modules,
          plan_name: updated.plan_name,
          expiry_date: updated.expiry_date
        })
      });
    } catch (e) {}

    this.closeEditModulesModal();
    alert(`🎉 ĐÃ CẬP NHẬT GÓI MODULE THÀNH CÔNG!\n\n• Key: ${updated.license_key}\n• Gói mới: ${updated.plan_name}\n• Các module được mở: ${updated.allowed_modules.join(', ')}`);
    this.render();
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

  async toggleRole(accId) {
    const accounts = window.dataStore.getAccounts();
    const acc = accounts.find(a => a.id === accId);
    if (!acc) return;
    acc.role = acc.role === 'admin' ? 'customer' : 'admin';
    await window.dataStore.saveAccount(acc);
    alert(`Đã chuyển quyền của ${acc.full_name} thành: ${acc.role.toUpperCase()}`);
    this.render();
  }

  async toggleStatus(accId) {
    const accounts = window.dataStore.getAccounts();
    const acc = accounts.find(a => a.id === accId);
    if (!acc) return;
    acc.status = acc.status === 'active' ? 'suspended' : 'active';
    await window.dataStore.saveAccount(acc);
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

  async deleteAccountPrompt(accId, accName) {
    const currentUser = window.authManager.getCurrentUser();
    if (currentUser && currentUser.id === accId) {
      alert('Không thể xóa tài khoản bạn đang đăng nhập!');
      return;
    }
    if (confirm(`⚠️ Bạn có chắc chắn muốn xóa tài khoản "${accName}"?\nHành động này không thể hoàn tác.`)) {
      await window.dataStore.deleteAccount(accId);
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

  async approveOrderPrompt(orderCode, totalAmount) {
    const formattedAmount = window.storeApp ? window.storeApp.formatCurrency(totalAmount) : `${totalAmount} ₫`;
    if (confirm(`⚠️ XÁC NHẬN DUYỆT ĐƠN HÀNG #${orderCode}\n\nBạn có chắc chắn tài khoản ngân hàng của bạn đã nhận được số tiền ${formattedAmount}?\n\nSau khi bấm OK, hệ thống sẽ kích hoạt sản phẩm và cấp License bản quyền cho khách hàng ngay lập tức.`)) {
      try {
        const res = await window.paymentGateway.approveOrderByAdmin(orderCode);
        if (res && res.success) {
          alert(`🎉 ĐÃ DUYỆT ĐƠN HÀNG #${orderCode} THÀNH CÔNG!\nKhách hàng đã nhận được bản quyền và có thể tải sản phẩm ngay.`);
          this.render();
        }
      } catch (err) {
        alert('Lỗi duyệt đơn hàng: ' + err.message);
      }
    }
  }

  async rejectOrderPrompt(orderCode) {
    const reason = prompt('Nhập lý do từ chối đơn hàng (Ví dụ: Chưa nhận được tiền trong tài khoản):', 'Chưa nhận được tiền chuyển khoản');
    if (!reason) return;
    try {
      await window.paymentGateway.rejectOrderByAdmin(orderCode, reason);
      alert(`Đã từ chối đơn hàng #${orderCode}.`);
      this.render();
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }
  }

  async refreshOrdersFromCloud(btnEl) {
    const origText = btnEl ? btnEl.innerHTML : '';
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.innerHTML = '⏳ Đang tải từ máy chủ...';
    }

    let orders = [];
    try {
      orders = await window.dataStore.fetchRemoteOrders();
      if (window.dataStore.fetchRemoteCustomRequests) {
        await window.dataStore.fetchRemoteCustomRequests();
      }
    } catch (e) {
      console.warn('[Admin] Lỗi refresh:', e);
      orders = window.dataStore.getOrders();
    }

    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerHTML = origText;
    }

    const pendingCount = orders.filter(o => o.status === 'pending_approval').length;
    let msg = `🎉 ĐÃ ĐỒNG BỘ THÀNH CÔNG VỚI MÁY CHỦ TRUNG TÂM!\n\n• Tổng số đơn hàng: ${orders.length} đơn\n`;
    if (pendingCount > 0) {
      msg += `• 🔔 CÓ ${pendingCount} ĐƠN HÀNG KHÁCH BÁO ĐÃ CHUYỂN KHOẢN ĐANG CHỜ BẠN DUYỆT!`;
    } else {
      msg += `• Trạng thái: Không có đơn hàng nào chờ duyệt.`;
    }
    alert(msg);
    this.render();
  }

  async deleteOrderPrompt(orderId) {
    if (confirm('⚠️ Bạn có chắc muốn xóa lịch sử đơn hàng này?\nHành động này không thể hoàn tác.')) {
      let orders = window.dataStore.getOrders();
      const target = orders.find(o => o.id === orderId);
      orders = orders.filter(o => o.id !== orderId);
      window.dataStore.save('orders', orders);

      if (target && target.github_issue_number && window.dataStore.deleteOrderIssue) {
        await window.dataStore.deleteOrderIssue(target.github_issue_number);
      }

      alert('Đã xóa đơn hàng thành công!');
      this.render();
    }
  }

  // =========================================================================
  // QUẢN LÝ & ĐĂNG KÝ GÓI MODULE BẢN QUYỀN (YÊU CẦU 1)
  // =========================================================================
  openPackageManagerModal() {
    const modal = document.getElementById('packageManagerModalOverlay');
    if (!modal) return;
    this.switchPkgModalTab('list');
    modal.classList.add('active');
  }

  closePackageManagerModal() {
    const modal = document.getElementById('packageManagerModalOverlay');
    if (modal) modal.classList.remove('active');
  }

  switchPkgModalTab(tab) {
    const tabs = ['list', 'create', 'modules'];
    tabs.forEach(t => {
      const btn = document.getElementById(`pkgTabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
      const sec = document.getElementById(`pkgModalSection${t.charAt(0).toUpperCase() + t.slice(1)}`);
      if (btn && sec) {
        if (t === tab) {
          btn.style.background = '#EEF2FF';
          btn.style.color = '#4F46E5';
          btn.style.borderColor = '#C7D2FE';
          sec.style.display = 'block';
        } else {
          btn.style.background = '';
          btn.style.color = '';
          btn.style.borderColor = '';
          sec.style.display = 'none';
        }
      }
    });

    if (tab === 'list') {
      this.renderPkgModalList();
    } else if (tab === 'create') {
      this.renderPkgCreateFormModules();
    } else if (tab === 'modules') {
      this.renderPkgModalModuleCatalog();
    }
  }

  renderPkgModalList() {
    const container = document.getElementById('pkgModalListContainer');
    if (!container) return;

    const presets = window.dataStore.getPackagePresets();
    const catalog = window.dataStore.getModuleCatalog();
    const catalogMap = {};
    catalog.forEach(m => { catalogMap[m.code] = `${m.icon || '🧩'} ${m.name}`; });

    if (presets.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 30px; color: var(--text-muted); background: #F8FAFC; border-radius: var(--radius-md);">
          Chưa có gói bản quyền nào được cấu hình. Hãy bấm <strong>+ Đăng Ký Gói Mới</strong> để tạo gói đầu tiên!
        </div>
      `;
      return;
    }

    container.innerHTML = presets.map((pkg, idx) => {
      const isAll = (pkg.modules || []).includes('MEP-ALL');
      const moduleBadges = isAll
        ? `<span class="badge" style="background:#EEF2FF; color:#4F46E5; font-weight:700;">⭐ Full VIP (Mở Toàn Bộ Tools)</span>`
        : (pkg.modules || []).map(m => `
            <span class="badge" style="background:#F1F5F9; color:#334155; font-size:0.75rem; margin-right:4px;">
              ${catalogMap[m] || m}
            </span>
          `).join('');

      return `
        <div style="background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: var(--radius-md); padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; box-shadow: var(--shadow-sm);">
          <div style="flex: 1; min-width: 260px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <strong style="font-size: 1.05rem; color: var(--text-pure);">${pkg.name}</strong>
              ${pkg.badge ? `<span class="badge badge-family" style="font-size: 0.72rem;">${pkg.badge}</span>` : ''}
            </div>
            <p style="font-size: 0.84rem; color: var(--text-muted); margin: 0 0 8px 0;">${pkg.desc || 'Không có mô tả chi tiết.'}</p>
            <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
              <span style="font-size: 0.78rem; color: var(--text-dim); margin-right: 4px;">Module bao gồm:</span>
              ${moduleBadges}
            </div>
          </div>

          <div style="text-align: right; min-width: 170px;">
            <div style="font-size: 0.8rem; color: var(--text-dim); text-decoration: line-through;">
              ${window.storeApp.formatCurrency(pkg.price)}
            </div>
            <div style="font-family: var(--font-heading); font-size: 1.3rem; font-weight: 800; color: var(--primary);">
              ${window.storeApp.formatCurrency(pkg.sale_price || pkg.price)}
            </div>
            <div style="margin-top: 8px; display: flex; gap: 6px; justify-content: flex-end;">
              <button class="btn btn-secondary btn-sm" style="color: var(--danger); font-size: 0.78rem; padding: 4px 8px;" onclick="window.adminPanel.handleDeletePackage('${pkg.id}')" title="Xóa gói này">
                🗑️ Xóa Gói
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderPkgCreateFormModules() {
    const container = document.getElementById('newPkgModulesCheckboxContainer');
    if (!container) return;

    const catalog = window.dataStore.getModuleCatalog();
    container.innerHTML = catalog.map(m => `
      <label style="display: flex; align-items: center; gap: 8px; font-size: 0.88rem; cursor: pointer; background: #FFFFFF; padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid #E2E8F0;">
        <input type="checkbox" name="newPkgModuleCheckbox" value="${m.code}" ${m.code === 'MEP-ALL' ? '' : 'checked'}>
        <span>${m.icon || '🧩'} <strong>${m.name}</strong></span>
      </label>
    `).join('');
  }

  renderPkgModalModuleCatalog() {
    const container = document.getElementById('pkgModalModuleCatalogList');
    if (!container) return;

    const catalog = window.dataStore.getModuleCatalog();
    container.innerHTML = catalog.map(m => `
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: var(--radius-md); padding: 12px 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-weight: 800; font-size: 0.95rem; color: var(--text-pure);">${m.icon || '🧩'} ${m.name}</span>
          <span class="badge" style="font-family: var(--font-mono); font-size: 0.72rem; background: #EEF2FF; color: #4F46E5;">${m.code}</span>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">${m.desc || 'Module chức năng Revit Add-in'}</div>
      </div>
    `).join('');
  }

  handleSaveNewPackage(event) {
    event.preventDefault();
    const name = document.getElementById('newPkgName').value.trim();
    const badge = document.getElementById('newPkgBadge').value.trim();
    const price = Number(document.getElementById('newPkgPrice').value) || 0;
    const sale_price = Number(document.getElementById('newPkgSalePrice').value) || price;
    const desc = document.getElementById('newPkgDesc').value.trim();

    const checkedBoxes = Array.from(document.querySelectorAll('input[name="newPkgModuleCheckbox"]:checked'));
    const modules = checkedBoxes.map(cb => cb.value);

    if (modules.length === 0) {
      alert('Vui lòng chọn ít nhất 1 module cho gói bản quyền này!');
      return;
    }

    const newPkg = window.dataStore.addPackagePreset({
      name,
      badge: badge || '✨ Gói Mới',
      price,
      sale_price,
      modules,
      desc
    });

    // Reset Form
    document.getElementById('newPkgName').value = '';
    document.getElementById('newPkgBadge').value = '';
    document.getElementById('newPkgPrice').value = '';
    document.getElementById('newPkgSalePrice').value = '';
    document.getElementById('newPkgDesc').value = '';

    alert(`🎉 ĐÃ ĐĂNG KÝ GÓI BẢN QUYỀN THÀNH CÔNG!\n\n• Tên Gói: ${newPkg.name}\n• Giá bán: ${window.storeApp.formatCurrency(newPkg.sale_price)}\n• Module: ${newPkg.modules.join(', ')}\n\nGói này hiện đã có sẵn trên trang mua hàng và khu vực cấp phép cho tài khoản!`);
    this.switchPkgModalTab('list');
    if (window.storeApp && typeof window.storeApp.render === 'function') {
      window.storeApp.render();
    }
  }

  handleDeletePackage(pkgId) {
    if (confirm('Bạn có chắc muốn xóa gói bản quyền này khỏi danh sách bán và quản lý?')) {
      window.dataStore.deletePackagePreset(pkgId);
      this.renderPkgModalList();
    }
  }

  handleSaveNewModule(event) {
    event.preventDefault();
    const code = document.getElementById('newModCode').value.trim().toUpperCase();
    const name = document.getElementById('newModName').value.trim();
    const icon = document.getElementById('newModIcon').value.trim() || '🧩';

    try {
      window.dataStore.addModuleToCatalog({ code, name, icon });
      document.getElementById('newModCode').value = '';
      document.getElementById('newModName').value = '';
      document.getElementById('newModIcon').value = '🧩';
      alert(`🎉 Đã thêm module ${code} vào hệ thống thành công!`);
      this.renderPkgModalModuleCatalog();
    } catch (e) {
      alert(e.message || 'Lỗi thêm module!');
    }
  }

  // =========================================================================
  // QUẢN LÝ & ĐIỀU CHỈNH GÓI BẢN QUYỀN TÀI KHOẢN (YÊU CẦU 3)
  // =========================================================================
  openAccountLicenseModal(accountId) {
    const modal = document.getElementById('accountLicenseModalOverlay');
    if (!modal) return;

    const accounts = window.dataStore.getAccounts();
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) {
      alert('Không tìm thấy thông tin tài khoản!');
      return;
    }

    document.getElementById('accLicSelectedUserId').value = acc.id;
    document.getElementById('accLicUserFullName').textContent = acc.full_name;
    document.getElementById('accLicUserEmail').textContent = acc.email;
    document.getElementById('accLicUserRoleBadge').innerHTML = `
      <span class="badge ${acc.role === 'admin' ? 'badge-admin' : 'account-badge-customer'}">
        ${acc.role === 'admin' ? '👑 Quản Trị Viên (Admin)' : '👤 Kỹ Sư BIM (Customer)'}
      </span>
    `;
    document.getElementById('accLicUserCompany').textContent = `🏢 Đơn vị: ${acc.company || 'Cá nhân'}`;

    // Nạp dropdown sản phẩm tools
    const toolSelect = document.getElementById('accGrantToolSelect');
    const tools = window.dataStore.getProducts().filter(p => p.product_type === 'tool');
    if (toolSelect) {
      toolSelect.innerHTML = tools.map(t => `
        <option value="${t.id}">${t.name} (v${t.metadata?.version || '2.4.0'})</option>
      `).join('');
    }

    // Nạp dropdown Gói Module Bản Quyền từ Presets
    const pkgSelect = document.getElementById('accGrantPkgSelect');
    const presets = window.dataStore.getPackagePresets();
    if (pkgSelect) {
      pkgSelect.innerHTML = presets.map(p => `
        <option value="${p.id}">
          ${p.name} - ${window.storeApp.formatCurrency(p.sale_price || p.price)} [${p.modules.join(', ')}]
        </option>
      `).join('');
    }

    // Render danh sách license hiện có của tài khoản
    this.renderAccountLicensesList(acc);

    modal.classList.add('active');
  }

  closeAccountLicenseModal() {
    const modal = document.getElementById('accountLicenseModalOverlay');
    if (modal) modal.classList.remove('active');
  }

  renderAccountLicensesList(account) {
    const container = document.getElementById('accLicExistingList');
    const badgeCount = document.getElementById('accLicCountBadge');
    if (!container) return;

    const userLics = window.dataStore.getLicensesByAccount(account);
    if (badgeCount) {
      badgeCount.textContent = `${userLics.length} Giấy phép`;
    }

    if (userLics.length === 0) {
      container.innerHTML = `
        <div style="background: #F8FAFC; border: 1.5px dashed #CBD5E1; border-radius: var(--radius-md); padding: 24px; text-align: center; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 6px;">📭</div>
          <div style="font-weight: 700; color: var(--text-pure); margin-bottom: 4px;">Tài khoản này chưa có Giấy Phép Bản Quyền nào!</div>
          <p style="font-size: 0.85rem; margin: 0;">Sử dụng biểu mẫu màu cam phía dưới để cấp gói bản quyền đầu tiên cho kỹ sư này.</p>
        </div>
      `;
      return;
    }

    const now = new Date();
    const presets = window.dataStore.getPackagePresets();

    container.innerHTML = userLics.map(lic => {
      const exp = new Date(lic.expiry_date);
      const remainingDays = Math.round((exp - now) / (1000 * 60 * 60 * 24));
      const isExpired = remainingDays <= 0 || lic.status === 'expired';
      const usedMachines = (lic.activations || []).length;
      const mods = lic.allowed_modules || ['MEP-ALL'];
      const isAll = mods.includes('MEP-ALL') || mods.length >= 6;

      const moduleBadges = isAll
        ? `<span class="badge" style="background:#EEF2FF; color:#4F46E5; font-weight:700; font-size:0.75rem;">⭐ Full VIP (Tất Cả Tools)</span>`
        : mods.map(m => `<span class="badge" style="background:#F1F5F9; color:#334155; font-size:0.72rem; margin-right:3px;">${m}</span>`).join('');

      return `
        <div style="background: #FFFFFF; border: 1.5px solid ${isExpired ? '#FECDD3' : '#E2E8F0'}; border-radius: var(--radius-md); padding: 16px; box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-family: var(--font-mono); font-weight: 800; font-size: 1.05rem; color: var(--primary);">${lic.license_key}</span>
                <button type="button" style="border:none; background:none; cursor:pointer;" onclick="navigator.clipboard.writeText('${lic.license_key}'); alert('Đã sao chép: ${lic.license_key}');" title="Sao chép Key">📋</button>
              </div>
              <div style="font-weight: 700; color: var(--text-pure); margin-top: 2px;">
                ${lic.product_name} • <span style="color: #4F46E5;">${lic.plan_name || 'Bản quyền điện tử'}</span>
              </div>
            </div>

            <div style="text-align: right;">
              <span class="badge ${isExpired ? 'badge-danger' : (lic.status === 'suspended' ? 'badge-admin' : 'badge-family')}">
                ${isExpired ? '⛔ Đã Hết Hạn' : (lic.status === 'suspended' ? '⏸️ Tạm Khóa' : '🟢 Đang Kích Hoạt')}
              </span>
              <div style="font-size: 0.78rem; color: var(--text-dim); margin-top: 3px;">
                Hạn: <strong>${exp.toLocaleDateString('vi-VN')}</strong> (${isExpired ? `Quá hạn ${Math.abs(remainingDays)} ngày` : `Còn ${remainingDays} ngày`})
              </div>
            </div>
          </div>

          <!-- Thông tin Module và Máy Trạm -->
          <div style="background: #F8FAFC; border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="font-size: 0.8rem; color: var(--text-muted);">Quyền truy cập:</span>
              ${moduleBadges}
            </div>
            <div style="font-size: 0.82rem; color: var(--text-pure); font-weight: 700;">
              🖥️ Máy trạm: ${usedMachines} / ${lic.max_machines} máy
            </div>
          </div>

          <!-- KHU VỰC ĐIỀU CHỈNH LOẠI BẢN QUYỀN CHO KEY NÀY -->
          <div style="background: #EEF2FF; border: 1.5px solid #C7D2FE; border-radius: var(--radius-md); padding: 12px 14px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
              <label style="font-weight: 800; font-size: 0.86rem; color: #3730A3; display: flex; align-items: center; gap: 6px; margin: 0;">
                <span>⚙️</span> Điều Chỉnh Loại Bản Quyền Cho Key Này:
              </label>
              <span style="font-size: 0.76rem; color: #4338CA;">Loại hiện tại: <strong>${lic.plan_name || 'Bản quyền'}</strong></span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <select id="accPkgSelect_${lic.id}" class="form-control" style="flex: 1; min-width: 260px; font-weight: 700; background: #FFFFFF; color: #1E293B;">
                ${presets.map(p => {
                  const isCurrent = lic.plan_name === p.name || (lic.package_id && lic.package_id === p.id);
                  return `<option value="${p.id}" ${isCurrent ? 'selected' : ''}>${p.name} [${p.modules.join(', ')}]</option>`;
                }).join('')}
              </select>
              <button type="button" class="btn btn-primary btn-sm" style="background: #4F46E5; border-color: #4F46E5; font-weight: 700; padding: 7px 14px; white-space: nowrap;" onclick="window.adminPanel.applyPackageSelectionToLicense('${lic.id}', 'accPkgSelect_${lic.id}')">
                💾 Cập Nhật Loại Bản Quyền
              </button>
            </div>
          </div>

          <!-- Các thao tác quản trị khác của Key -->
          <div style="display: flex; justify-content: flex-end; align-items: center; flex-wrap: wrap; gap: 8px;">

            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button type="button" class="btn btn-secondary btn-sm" style="color: #4F46E5; font-weight: 700; border-color: rgba(79, 70, 229, 0.4); background: #EEF2FF;" onclick="window.adminPanel.openEditModulesModal('${lic.id}')" title="Chọn chi tiết từng module checkbox cho key này">
                🧩 Sửa Module
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.adminPanel.renewLicensePrompt('${lic.id}')" title="Gia hạn thời gian sử dụng">
                ⚡ Gia Hạn
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.adminPanel.adjustMaxMachinesPrompt('${lic.id}', ${lic.max_machines})" title="Thay đổi số máy trạm">
                💻 Đổi Slot
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.adminPanel.resetLicenseDevicesPrompt('${lic.id}')" title="Xóa các máy cũ để khách cài lại">
                🔄 Reset Máy
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.adminPanel.openLicenseDevicesModal('${lic.id}')" title="Xem danh sách HWID máy trạm">
                🖥️ Xem Máy
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  applyPackageSelectionToLicense(licenseId, selectId) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl || !selectEl.value) {
      alert('Vui lòng chọn loại bản quyền trong combobox trước khi cập nhật!');
      return;
    }
    this.handleQuickApplyPackageToLicense(licenseId, selectEl.value);
  }

  async handleQuickApplyPackageToLicense(licenseId, packageId) {
    if (!packageId) return;
    const presets = window.dataStore.getPackagePresets();
    const pkg = presets.find(p => p.id === packageId);
    if (!pkg) return;

    if (confirm(`Bạn có chắc muốn chuyển giấy phép này sang: "${pkg.name}"?\nCác module sẽ được cập nhật thành: ${pkg.modules.join(', ')}`)) {
      const updated = window.licenseManager.updateLicenseModules(licenseId, pkg.modules, pkg.name);
      
      // Đồng bộ Server API
      try {
        await fetch('/api/v1/license/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            license_key: updated.license_key,
            allowed_modules: updated.allowed_modules,
            plan_name: updated.plan_name,
            expiry_date: updated.expiry_date
          })
        });
      } catch (e) {}

      const userId = document.getElementById('accLicSelectedUserId').value;
      const acc = window.dataStore.getAccounts().find(a => a.id === userId);
      if (acc) this.renderAccountLicensesList(acc);
      this.render();
      alert(`🎉 ĐÃ ĐỔI GÓI THÀNH CÔNG!\n\n• Key: ${updated.license_key}\n• Gói mới: ${updated.plan_name}\n• Module: ${updated.allowed_modules.join(', ')}`);
    }
  }

  async handleGrantPackageToAccount(event) {
    event.preventDefault();
    const userId = document.getElementById('accLicSelectedUserId').value;
    const acc = window.dataStore.getAccounts().find(a => a.id === userId);
    if (!acc) {
      alert('Không tìm thấy tài khoản người dùng!');
      return;
    }

    const toolId = document.getElementById('accGrantToolSelect').value;
    const tool = window.dataStore.getProductById(toolId);
    const pkgId = document.getElementById('accGrantPkgSelect').value;
    const presets = window.dataStore.getPackagePresets();
    const pkg = presets.find(p => p.id === pkgId);
    const durationDays = Number(document.getElementById('accGrantDurationSelect').value) || 365;
    const maxMachines = Number(document.getElementById('accGrantMachinesSelect').value) || 2;

    if (!tool || !pkg) {
      alert('Vui lòng chọn Tool và Gói Bản Quyền!');
      return;
    }

    const newLic = window.licenseManager.createManualLicense({
      product_id: tool.id,
      product_name: tool.name,
      user_id: acc.id,
      user_email: acc.email,
      user_name: acc.full_name,
      company: acc.company || 'Cá nhân',
      duration_days: durationDays,
      max_machines: maxMachines,
      allowed_modules: pkg.modules,
      plan_name: `${pkg.name} (${maxMachines} Máy)`,
      subscription_type: durationDays <= 30 ? 'monthly' : (durationDays >= 3650 ? 'lifetime' : 'yearly'),
      note: `Cấp trực tiếp từ Quản Lý Tài Khoản (Admin Portal)`
    });

    // Đồng bộ lên Server API
    try {
      await fetch('/api/v1/license/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: newLic.license_key,
          allowed_modules: newLic.allowed_modules,
          plan_name: newLic.plan_name,
          expiry_date: newLic.expiry_date
        })
      });
    } catch (e) {}

    // Cập nhật lại giao diện modal & admin table
    this.renderAccountLicensesList(acc);
    this.render();

    alert(`🎉 ĐÃ CẤP GÓI BẢN QUYỀN MỚI THÀNH CÔNG CHO TÀI KHOẢN!\n\n• Tài khoản: ${acc.full_name} (${acc.email})\n• Gói: ${newLic.plan_name}\n• Key: ${newLic.license_key}\n• Module: ${newLic.allowed_modules.join(', ')}\n• Số máy: ${newLic.max_machines} máy\n• Hạn dùng: ${new Date(newLic.expiry_date).toLocaleDateString('vi-VN')}`);
  }

  quickLoginAdmin() {
    const adminUser = {
      id: 'acc-admin-01',
      email: 'admin@doanson.com',
      username: 'sonbigcar',
      full_name: 'Đoàn Thanh Sơn (Admin)',
      phone: '0908123456',
      company: 'DoanSon BIM Studio',
      role: 'admin',
      status: 'active',
      created_at: new Date().toISOString()
    };
    window.authManager.saveUser(adminUser);
    alert('🎉 Chào mừng Sơn! Đã kích hoạt phiên làm việc Quản Trị Viên (Admin) thành công!');
    this.render();
    if (window.storeApp) {
      window.storeApp.updateUserNav();
      window.storeApp.updateNavTabsVisibility();
      window.storeApp.renderProducts();
    }
  }
}

window.adminPanel = new AdminPanel();
