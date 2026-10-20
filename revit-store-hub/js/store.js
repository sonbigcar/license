/**
 * ==============================================================================
 * REVIT BIM STORE - STOREFRONT UI CONTROLLER & CART MANAGER
 * Tông màu cam ấm áp, hỗ trợ Video Review & Quản trị thêm sản phẩm niêm yết giá
 * ==============================================================================
 */

class StoreApp {
  constructor() {
    this.cart = this.loadCart();
    this.currentFilterType = 'all'; // 'all', 'tool', 'family_template'
    this.currentRevitVersion = 'all';
    this.searchKeyword = '';

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.renderProducts();
    this.updateCartBadge();
    this.updateUserNav();
    this.updateNavTabsVisibility();

    // Lắng nghe thay đổi User Auth
    window.authManager.subscribe((user) => {
      this.updateUserNav();
      this.updateNavTabsVisibility();
      this.renderProducts(); // Re-render để hiển thị nút Admin thêm sản phẩm nếu vừa login admin

      if (document.getElementById('libraryView') && !document.getElementById('libraryView').classList.contains('hidden')) {
        this.renderUserLibrary();
      }
      if (document.getElementById('licenseView') && !document.getElementById('licenseView').classList.contains('hidden')) {
        this.renderUserLicenses();
      }
      if (document.getElementById('adminView') && !document.getElementById('adminView').classList.contains('hidden')) {
        window.adminPanel.render();
      }
    });
  }

  loadCart() {
    try {
      return JSON.parse(localStorage.getItem('revit_hub_cart')) || [];
    } catch (e) {
      return [];
    }
  }

  saveCart() {
    localStorage.setItem('revit_hub_cart', JSON.stringify(this.cart));
    this.updateCartBadge();
    this.renderCartDrawer();
  }

  setupEventListeners() {
    // Navigation Tabs
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const targetView = e.currentTarget.dataset.view;
        this.switchMainView(targetView);
      });
    });

    // Cart Button & Drawer
    const cartBtn = document.getElementById('cartBtn');
    if (cartBtn) {
      cartBtn.addEventListener('click', () => this.openCartDrawer());
    }

    const closeCartBtn = document.getElementById('closeCartBtn');
    if (closeCartBtn) {
      closeCartBtn.addEventListener('click', () => this.closeCartDrawer());
    }

    const cartOverlay = document.getElementById('cartOverlay');
    if (cartOverlay) {
      cartOverlay.addEventListener('click', () => this.closeCartDrawer());
    }

    // Search Input
    const searchInput = document.getElementById('productSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchKeyword = e.target.value.toLowerCase().trim();
        this.renderProducts();
      });
    }

    // Filter Buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentFilterType = e.currentTarget.dataset.filter;
        this.renderProducts();
      });
    });

    // Version Select
    const versionSelect = document.getElementById('versionFilterSelect');
    if (versionSelect) {
      versionSelect.addEventListener('change', (e) => {
        this.currentRevitVersion = e.target.value;
        this.renderProducts();
      });
    }

    // Product Detail Modal Close
    const closeDetailBtn = document.getElementById('closeDetailModal');
    if (closeDetailBtn) {
      closeDetailBtn.addEventListener('click', () => this.closeDetailModal());
    }

    const detailOverlay = document.getElementById('detailModalOverlay');
    if (detailOverlay) {
      detailOverlay.addEventListener('click', (e) => {
        if (e.target.id === 'detailModalOverlay') this.closeDetailModal();
      });
    }

    // Auth Modal Close
    const closeAuthBtn = document.getElementById('closeAuthModal');
    if (closeAuthBtn) {
      closeAuthBtn.addEventListener('click', () => this.closeAuthModal());
    }

    const authOverlay = document.getElementById('authModalOverlay');
    if (authOverlay) {
      authOverlay.addEventListener('click', (e) => {
        if (e.target.id === 'authModalOverlay') this.closeAuthModal();
      });
    }

    // Product Editor Modal Close (Admin)
    const closeProdEditorBtn = document.getElementById('closeProductEditorModal');
    if (closeProdEditorBtn) {
      closeProdEditorBtn.addEventListener('click', () => this.closeProductEditorModal());
    }

    const prodEditorOverlay = document.getElementById('productEditorModalOverlay');
    if (prodEditorOverlay) {
      prodEditorOverlay.addEventListener('click', (e) => {
        if (e.target.id === 'productEditorModalOverlay') this.closeProductEditorModal();
      });
    }

    // Payment Modal Close
    const closePayBtn = document.getElementById('closePaymentModal');
    if (closePayBtn) {
      closePayBtn.addEventListener('click', () => this.closePaymentModal());
    }

    // License Modals Close on backdrop click
    const createLicOverlay = document.getElementById('createLicenseModalOverlay');
    if (createLicOverlay) {
      createLicOverlay.addEventListener('click', (e) => {
        if (e.target.id === 'createLicenseModalOverlay') window.adminPanel.closeManualLicenseModal();
      });
    }

    const licDevOverlay = document.getElementById('licenseDevicesModalOverlay');
    if (licDevOverlay) {
      licDevOverlay.addEventListener('click', (e) => {
        if (e.target.id === 'licenseDevicesModalOverlay') window.adminPanel.closeLicenseDevicesModal();
      });
    }

    const licGuideOverlay = document.getElementById('licenseGuideModalOverlay');
    if (licGuideOverlay) {
      licGuideOverlay.addEventListener('click', (e) => {
        if (e.target.id === 'licenseGuideModalOverlay') this.closeLicenseGuideModal();
      });
    }

    // Checkout Button
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => this.startCheckout());
    }

    // Form gửi yêu cầu Custom Services
    const customForm = document.getElementById('customServiceForm');
    if (customForm) {
      customForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleCustomRequestSubmit();
      });
    }
  }

  /**
   * Cập nhật hiển thị Tabs Navbar theo quyền Admin
   */
  updateNavTabsVisibility() {
    const isAdmin = window.authManager.isAdmin();
    const adminNavTab = document.getElementById('navItemAdmin');
    if (adminNavTab) {
      adminNavTab.style.display = isAdmin ? 'inline-block' : 'none';
    }
  }

  /**
   * Cập nhật nút Đăng Nhập / Đăng Ký ở trên cùng bên phải
   */
  updateUserNav() {
    const user = window.authManager.getCurrentUser();
    const userNav = document.getElementById('userNavProfile');
    if (!userNav) return;

    if (user) {
      userNav.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="text-align: right; line-height: 1.2;">
            <div style="font-size: 0.88rem; color: var(--text-pure); font-weight: 800;">${user.full_name}</div>
            <span class="badge ${user.role === 'admin' ? 'badge-admin' : 'account-badge-customer'}" style="font-size: 0.65rem;">
              ${user.role === 'admin' ? '👑 Admin' : '👤 Kỹ sư BIM'}
            </span>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="window.storeApp.handleLogout()" title="Đăng xuất">
            Đăng xuất
          </button>
        </div>
      `;
    } else {
      userNav.innerHTML = `
        <button class="btn-auth-top" onclick="window.storeApp.openAuthModal()">
          <span style="font-size: 1rem;">👤</span>
          <span>Đăng Nhập / Đăng Ký</span>
        </button>
      `;
    }
  }

  handleLogout() {
    window.authManager.logout();
    alert('Đã đăng xuất.');
    this.switchMainView('storefrontView');
  }

  /**
   * AUTH MODAL (ĐĂNG NHẬP / ĐĂNG KÝ)
   */
  openAuthModal() {
    this.switchAuthTab('login');
    const modalEl = document.getElementById('authModalOverlay');
    if (modalEl) modalEl.classList.add('active');
  }

  closeAuthModal() {
    const modalEl = document.getElementById('authModalOverlay');
    if (modalEl) modalEl.classList.remove('active');
  }

  switchAuthTab(tab) {
    const tabLogin = document.getElementById('tabBtnLogin');
    const tabReg = document.getElementById('tabBtnRegister');
    const formLogin = document.getElementById('authLoginForm');
    const formReg = document.getElementById('authRegisterForm');

    if (tabLogin) tabLogin.classList.toggle('active', tab === 'login');
    if (tabReg) tabReg.classList.toggle('active', tab === 'register');
    if (formLogin) formLogin.classList.toggle('hidden', tab !== 'login');
    if (formReg) formReg.classList.toggle('hidden', tab !== 'register');
  }

  handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const pass = (document.getElementById('loginPassword') ? document.getElementById('loginPassword').value : '').trim();
    if (!email) {
      alert('Vui lòng nhập Email hoặc Tên đăng nhập.');
      return;
    }
    if (!pass) {
      alert('Vui lòng nhập Mật khẩu.');
      return;
    }

    try {
      const user = window.authManager.login(email, pass);
      this.closeAuthModal();
      alert(`Chào mừng ${user.full_name} đã đăng nhập!`);
      if (user.role === 'admin') {
        this.switchMainView('adminView');
      }
    } catch (err) {
      alert(err.message);
    }
  }

  handleRegisterSubmit(e) {
    e.preventDefault();
    const fullName = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const company = document.getElementById('regCompany').value.trim();

    if (!fullName || !email) {
      alert('Vui lòng nhập Họ tên và Email.');
      return;
    }

    try {
      const user = window.authManager.register(fullName, email, phone, company, 'customer');
      this.closeAuthModal();
      alert(`Chúc mừng ${user.full_name}! Tài khoản của bạn đã được tạo thành công.`);
    } catch (err) {
      alert(err.message);
    }
  }

  quickLoginAsAdmin() {
    window.authManager.login('admin@revitstore.vn');
    this.closeAuthModal();
    alert('Đã đăng nhập thành công với quyền Quản Trị Viên (Admin)!');
    this.switchMainView('adminView');
  }

  quickLoginAsEngineer() {
    window.authManager.login('engineer.bim@gmail.com');
    this.closeAuthModal();
    alert('Đã đăng nhập thành công với quyền Kỹ Sư BIM!');
  }

  /**
   * ĐIỀU HƯỚNG TỪ 3 BIG PORTAL CARDS
   */
  navigateToPillar(pillarType) {
    if (pillarType === 'tools') {
      this.switchMainView('storefrontView');
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.filter === 'tool');
      });
      this.currentFilterType = 'tool';
      this.renderProducts();
      document.getElementById('catalogSection').scrollIntoView({ behavior: 'smooth' });
    } else if (pillarType === 'family_template') {
      this.switchMainView('storefrontView');
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.filter === 'family_template');
      });
      this.currentFilterType = 'family_template';
      this.renderProducts();
      document.getElementById('catalogSection').scrollIntoView({ behavior: 'smooth' });
    } else if (pillarType === 'custom_service') {
      this.switchMainView('customServiceView');
    }
  }

  switchMainView(viewId) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewId);
    });

    const views = ['storefrontView', 'customServiceView', 'libraryView', 'licenseView', 'adminView'];
    views.forEach(v => {
      const el = document.getElementById(v);
      if (el) {
        el.classList.toggle('hidden', v !== viewId);
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (viewId === 'libraryView') {
      this.renderUserLibrary();
    } else if (viewId === 'licenseView') {
      this.renderUserLicenses();
    } else if (viewId === 'adminView') {
      window.adminPanel.render();
    }
  }

  /**
   * RENDER DANH MỤC SẢN PHẨM & CÁC TÍNH NĂNG ADMIN NIÊM YẾT GIÁ
   */
  renderProducts() {
    const container = document.getElementById('productsGrid');
    const adminActionArea = document.getElementById('adminCatalogActionArea');
    if (!container) return;

    const isAdmin = window.authManager.isAdmin();

    // Hiển thị nút Thêm Sản Phẩm Mới & Niêm Yết Giá nếu là Admin
    if (adminActionArea) {
      if (isAdmin) {
        adminActionArea.innerHTML = `
          <div style="background: #FFF5F0; border: 1.5px dashed var(--primary); border-radius: var(--radius-lg); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
            <div>
              <span class="badge badge-admin">Chế độ Quản Trị Viên</span>
              <strong style="margin-left: 8px; color: var(--text-pure);">Bạn có quyền thêm sản phẩm mới và điều chỉnh niêm yết giá bán.</strong>
            </div>
            <button class="btn-admin-add-product" onclick="window.storeApp.openProductEditorModal()">
              ✨ + Thêm Sản Phẩm & Niêm Yết Giá
            </button>
          </div>
        `;
      } else {
        adminActionArea.innerHTML = '';
      }
    }

    let products = window.dataStore.getProducts().filter(p => p.is_active);

    if (this.currentFilterType === 'tool') {
      products = products.filter(p => p.product_type === 'tool');
    } else if (this.currentFilterType === 'family_template') {
      products = products.filter(p => p.product_type === 'family' || p.product_type === 'template');
    }

    if (this.currentRevitVersion !== 'all') {
      products = products.filter(p => p.revit_versions && p.revit_versions.includes(this.currentRevitVersion));
    }

    if (this.searchKeyword) {
      products = products.filter(p =>
        p.name.toLowerCase().includes(this.searchKeyword) ||
        p.category.toLowerCase().includes(this.searchKeyword) ||
        p.description.toLowerCase().includes(this.searchKeyword)
      );
    }

    if (products.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 12px;">🔍</div>
          <h3>Không tìm thấy sản phẩm phù hợp</h3>
          <p style="margin-top: 6px;">Vui lòng thử tìm từ khóa khác hoặc xóa bộ lọc.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = products.map(product => {
      let badgeClass = 'badge-family';
      let badgeText = 'Revit Family';
      let billingText = 'Mua trọn đời';

      if (product.product_type === 'tool') {
        badgeClass = 'badge-tool';
        badgeText = 'Revit Tool';
        billingText = product.billing_cycle === 'monthly' ? '/tháng' : '/năm';
      } else if (product.product_type === 'template') {
        badgeClass = 'badge-template';
        badgeText = 'Project Template';
        billingText = 'File mẫu .RTE';
      }

      return `
        <div class="product-card">
          <div class="card-media">
            <img src="${product.thumbnail_url}" alt="${product.name}" loading="lazy">
            <div class="media-badges">
              <span class="badge ${badgeClass}">${badgeText}</span>
              ${product.video_url ? `<span class="badge" style="background: rgba(0,0,0,0.6); color: #fff;">🎬 Có Video Review</span>` : ''}
            </div>
          </div>
          <div class="card-body">
            <span class="card-category">${product.category}</span>
            <h3 class="card-title" title="${product.name}">${product.name}</h3>
            <p class="card-desc">${product.short_description || product.description}</p>
            
            <div style="display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 18px;">
              ${(product.revit_versions || []).map(v => `<span class="badge badge-version" style="background: #F3EAE3; color: var(--text-muted); font-family: var(--font-mono); font-size: 0.68rem; padding: 2px 7px;">v${v}</span>`).join('')}
            </div>

            <div class="card-footer">
              <div style="display: flex; flex-direction: column;">
                ${product.sale_price ? `<span style="font-size: 0.8rem; color: var(--text-dim); text-decoration: line-through;">${this.formatCurrency(product.price)}</span>` : ''}
                <span class="current-price">${this.formatCurrency(product.sale_price || product.price)}</span>
                <span style="font-size: 0.72rem; color: var(--text-dim);">${billingText}</span>
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-secondary btn-sm" onclick="window.storeApp.viewProductDetail('${product.id}')" title="Xem chi tiết & Video review">
                  Chi tiết
                </button>
                <button class="btn btn-primary btn-sm" onclick="window.storeApp.addToCart('${product.id}')">
                  + Mua
                </button>
              </div>
            </div>

            <!-- MENU THAO TÁC CỦA ADMIN TRÊN TỪNG SẢN PHẨM -->
            ${isAdmin ? `
              <div class="admin-card-actions">
                <button class="btn btn-secondary btn-sm" style="flex: 1; font-size: 0.78rem;" onclick="window.storeApp.openProductEditorModal('${product.id}')">
                  ✏️ Sửa & Đổi Giá
                </button>
                <button class="btn btn-secondary btn-sm" style="color: var(--danger); font-size: 0.78rem;" onclick="window.storeApp.deleteProduct('${product.id}')">
                  🗑️ Xóa
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }

  /**
   * XEM CHI TIẾT SẢN PHẨM & VIDEO REVIEW THỰC TẾ
   */
  viewProductDetail(productId) {
    const product = window.dataStore.getProductById(productId);
    if (!product) return;

    const modalBody = document.getElementById('detailModalBody');
    const isTool = product.product_type === 'tool';
    const isTemplate = product.product_type === 'template';

    modalBody.innerHTML = `
      <div style="padding: 24px;">
        <!-- KHUNG VIDEO REVIEW THỰC TẾ CỦA SẢN PHẨM -->
        ${product.video_url ? `
          <div style="margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <h4 style="font-family: var(--font-heading); font-size: 1.15rem; color: var(--text-pure); display: flex; align-items: center; gap: 8px;">
                <span>🎬</span> Video Review Demo Trực Tiếp Trên Revit
              </h4>
              <span class="badge badge-tool">HD Video Walkthrough</span>
            </div>
            <div class="video-review-box">
              <iframe src="${product.video_url}?autoplay=0&rel=0" title="${product.name} Video Review" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
            </div>
          </div>
        ` : `
          <div style="margin-bottom: 20px;">
            <img src="${product.thumbnail_url}" alt="${product.name}" style="width: 100%; border-radius: var(--radius-lg); aspect-ratio: 16/9; object-fit: cover;">
          </div>
        `}

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px;">
          <div>
            <span class="badge ${isTool ? 'badge-tool' : (isTemplate ? 'badge-template' : 'badge-family')}" style="margin-bottom: 8px;">
              ${isTool ? 'Revit Tools (Bản quyền theo máy)' : (isTemplate ? 'Project Template .RTE' : 'Revit Family .RFA')}
            </span>
            <h2 style="font-family: var(--font-heading); font-size: 1.6rem; color: var(--text-pure); margin-bottom: 12px; line-height: 1.3;">
              ${product.name}
            </h2>

            <div style="margin-bottom: 16px;">
              <span style="font-size: 1.8rem; font-weight: 800; color: var(--primary);">
                ${this.formatCurrency(product.sale_price || product.price)}
              </span>
              <span style="color: var(--text-dim); font-size: 0.9rem;"> / ${isTool ? (product.billing_cycle === 'monthly' ? 'Tháng' : 'Năm') : 'Gói mua trọn đời'}</span>
            </div>

            <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.6; margin-bottom: 20px;">
              ${product.description}
            </p>

            <button class="btn btn-primary btn-lg" style="width: 100%;" onclick="window.storeApp.addToCart('${product.id}'); window.storeApp.closeDetailModal(); window.storeApp.openCartDrawer();">
              Thêm Vào Giỏ & Thanh Toán VietQR
            </button>
          </div>

          <div style="background: #FAF3EE; border: 1px solid #EAE0D7; border-radius: var(--radius-lg); padding: 20px;">
            <h4 style="font-size: 0.86rem; color: var(--text-dim); text-transform: uppercase; margin-bottom: 12px; font-weight: 800; letter-spacing: 0.6px;">
              Thông số kỹ thuật BIM
            </h4>
            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.9rem;">
              <div><strong>Định dạng file:</strong> ${isTool ? '.EXE / .DLL (Add-in)' : (isTemplate ? '.RTE (Revit Template)' : '.RFA (Revit Family)')}</div>
              ${product.metadata.file_size ? `<div><strong>Dung lượng file:</strong> ${product.metadata.file_size}</div>` : ''}
              ${product.metadata.lod ? `<div><strong>Mức độ chi tiết:</strong> ${product.metadata.lod}</div>` : ''}
              ${product.metadata.standards ? `<div><strong>Tiêu chuẩn:</strong> ${product.metadata.standards}</div>` : ''}
              <div><strong>Phiên bản tương thích:</strong> Revit ${(product.revit_versions || []).join(', ')}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('detailModalOverlay').classList.add('active');
  }

  closeDetailModal() {
    const modalEl = document.getElementById('detailModalOverlay');
    if (modalEl) modalEl.classList.remove('active');
    // Dừng video khi đóng modal
    const iframe = document.querySelector('#detailModalBody iframe');
    if (iframe) iframe.src = '';
  }

  /**
   * MODAL ADMIN THÊM / SỬA SẢN PHẨM & NIÊM YẾT GIÁ
   */
  openProductEditorModal(productId = null) {
    const modal = document.getElementById('productEditorModalOverlay');
    const form = document.getElementById('productEditorForm');
    const titleEl = document.getElementById('productEditorTitle');

    if (!modal || !form) return;

    if (productId) {
      const prod = window.dataStore.getProductById(productId);
      if (!prod) return;
      titleEl.textContent = 'Chỉnh Sửa & Cập Nhật Niêm Yết Giá';
      document.getElementById('prodEditId').value = prod.id;
      document.getElementById('prodEditName').value = prod.name;
      document.getElementById('prodEditType').value = prod.product_type;
      document.getElementById('prodEditCategory').value = prod.category;
      document.getElementById('prodEditPrice').value = prod.price;
      document.getElementById('prodEditSalePrice').value = prod.sale_price || prod.price;
      document.getElementById('prodEditCycle').value = prod.billing_cycle;
      document.getElementById('prodEditThumb').value = prod.thumbnail_url;
      document.getElementById('prodEditVideo').value = prod.video_url || '';
      document.getElementById('prodEditDesc').value = prod.description;
    } else {
      titleEl.textContent = 'Thêm Sản Phẩm Mới & Niêm Yết Giá';
      form.reset();
      document.getElementById('prodEditId').value = '';
    }

    modal.classList.add('active');
  }

  closeProductEditorModal() {
    const modal = document.getElementById('productEditorModalOverlay');
    if (modal) modal.classList.remove('active');
  }

  async handleProductEditorSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('prodEditId').value.trim() || ('prod-' + Date.now().toString(16));
    const name = document.getElementById('prodEditName').value.trim();
    const type = document.getElementById('prodEditType').value;
    const category = document.getElementById('prodEditCategory').value.trim();
    const price = Number(document.getElementById('prodEditPrice').value) || 0;
    const salePrice = Number(document.getElementById('prodEditSalePrice').value) || price;
    const cycle = document.getElementById('prodEditCycle').value;
    const thumb = document.getElementById('prodEditThumb').value.trim() || 'assets/card_family.jpg';
    const video = document.getElementById('prodEditVideo').value.trim();
    const desc = document.getElementById('prodEditDesc').value.trim();

    if (!name || price <= 0) {
      alert('Vui lòng nhập tên sản phẩm và giá niêm yết hợp lệ.');
      return;
    }

    const updatedProduct = {
      id: id,
      name: name,
      slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      product_type: type,
      category: category,
      price: price,
      sale_price: salePrice,
      billing_cycle: cycle,
      thumbnail_url: thumb,
      video_url: video,
      description: desc,
      short_description: desc.substring(0, 100) + '...',
      revit_versions: ['2022', '2023', '2024', '2025'],
      is_active: true,
      metadata: {
        file_name: type === 'tool' ? `${name.replace(/\s+/g, '_')}_Setup.exe` : `${name.replace(/\s+/g, '_')}.rfa`,
        file_size: '15.0 MB',
        lod: 'LOD 350'
      }
    };

    // Đổi nút lưu sang trạng thái đang đồng bộ
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const origBtnText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '⏳ Đang lưu & đẩy lên máy chủ trung tâm...';
    }

    const syncRes = await window.dataStore.saveProduct(updatedProduct);
    this.closeProductEditorModal();
    
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnText;
    }

    if (syncRes && syncRes.success) {
      alert(`🎉 Đã lưu và đồng bộ sản phẩm "${name}" lên máy chủ trung tâm thành công!\nTất cả máy tính người dùng truy cập web đều sẽ thấy sản phẩm này.`);
    } else {
      alert(`Đã lưu sản phẩm "${name}" vào bộ nhớ!\n(Lưu ý: Đang đồng bộ nền sang máy chủ trung tâm)`);
    }

    this.renderProducts();
    if (window.adminPanel && document.getElementById('adminView') && !document.getElementById('adminView').classList.contains('hidden')) {
      window.adminPanel.render();
    }
  }

  async deleteProduct(productId) {
    const prod = window.dataStore.getProductById(productId);
    if (!prod) return;
    if (confirm(`Bạn có chắc muốn xóa sản phẩm "${prod.name}" khỏi cửa hàng và đồng bộ cho mọi máy tính?`)) {
      await window.dataStore.deleteProduct(productId);
      this.renderProducts();
      if (window.adminPanel && document.getElementById('adminView') && !document.getElementById('adminView').classList.contains('hidden')) {
        window.adminPanel.render();
      }
      alert(`Đã xóa sản phẩm "${prod.name}" và cập nhật lên máy chủ trung tâm!`);
    }
  }

  /**
   * GIỎ HÀNG
   */
  addToCart(productId) {
    const product = window.dataStore.getProductById(productId);
    if (!product) return;

    if (this.cart.some(item => item.id === productId)) {
      alert(`Sản phẩm "${product.name}" đã có trong giỏ hàng.`);
      return;
    }

    this.cart.push(product);
    this.saveCart();
    this.openCartDrawer();
  }

  removeFromCart(productId) {
    this.cart = this.cart.filter(item => item.id !== productId);
    this.saveCart();
  }

  updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (badge) {
      badge.textContent = this.cart.length;
      badge.style.display = this.cart.length > 0 ? 'inline-block' : 'none';
    }
  }

  openCartDrawer() {
    this.renderCartDrawer();
    document.getElementById('cartDrawer').classList.add('active');
    document.getElementById('cartOverlay').classList.add('active');
  }

  closeCartDrawer() {
    document.getElementById('cartDrawer').classList.remove('active');
    document.getElementById('cartOverlay').classList.remove('active');
  }

  renderCartDrawer() {
    const container = document.getElementById('cartItemsList');
    const totalEl = document.getElementById('cartTotalAmount');
    if (!container || !totalEl) return;

    if (this.cart.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 12px;">🛒</div>
          <p>Giỏ hàng của bạn đang trống</p>
        </div>
      `;
      totalEl.textContent = '0 ₫';
      return;
    }

    const total = this.cart.reduce((sum, item) => sum + (item.sale_price || item.price), 0);
    totalEl.textContent = this.formatCurrency(total);

    container.innerHTML = this.cart.map(item => `
      <div class="cart-item">
        <img class="cart-item-thumb" src="${item.thumbnail_url}" alt="${item.name}">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">${this.formatCurrency(item.sale_price || item.price)}</div>
        </div>
        <button class="cart-item-remove" onclick="window.storeApp.removeFromCart('${item.id}')" title="Xóa">
          ✕
        </button>
      </div>
    `).join('');
  }

  startCheckout() {
    let user = window.authManager.getCurrentUser();
    if (!user) {
      this.openAuthModal();
      return;
    }

    if (this.cart.length === 0) {
      alert('Giỏ hàng trống!');
      return;
    }

    try {
      const order = window.paymentGateway.createOrder(this.cart, user);
      this.closeCartDrawer();
      this.showPaymentModal(order);
    } catch (e) {
      alert(e.message);
    }
  }

  showPaymentModal(order) {
    const qrUrl = window.paymentGateway.getVietQrImageUrl(order);
    const bankCfg = window.paymentGateway.getBankConfig();
    const modalEl = document.getElementById('paymentModalOverlay');
    const container = document.getElementById('paymentModalBody');
    if (!container) return;

    this.paymentTimeRemaining = 900; // 15 phút (15:00)
    if (this.paymentCountdownInterval) clearInterval(this.paymentCountdownInterval);

    container.innerHTML = `
      <div class="qr-card-container">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 0.88rem; color: var(--text-muted);">
            Đơn hàng: <strong style="color: var(--text-pure);">#${order.order_code}</strong>
          </span>
          <span class="qr-timer-badge" id="qrTimerDisplay">⏳ 15:00</span>
        </div>

        <h3 style="font-family: var(--font-heading); font-size: 1.35rem; color: var(--text-pure); margin-bottom: 4px;">
          Thanh Toán VietQR Napas 24/7
        </h3>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 14px;">
          Quét mã bằng bất kỳ ứng dụng Ngân hàng nào để kích hoạt ngay
        </p>

        <div class="qr-box">
          <img class="qr-image" src="${qrUrl}" alt="Mã VietQR Thanh Toán">
        </div>

        <div class="bank-info-box">
          <div class="bank-row">
            <span class="bank-label">Ngân hàng:</span>
            <span class="bank-val">${bankCfg.bankName}</span>
          </div>
          <div class="bank-row">
            <span class="bank-label">Số tài khoản:</span>
            <span class="bank-val">
              <strong style="letter-spacing: 0.5px;">${bankCfg.accountNo}</strong>
              <span class="copy-badge" onclick="window.storeApp.copyText('${bankCfg.accountNo}', 'Đã sao chép Số tài khoản!')">📋 Sao chép</span>
            </span>
          </div>
          <div class="bank-row">
            <span class="bank-label">Chủ tài khoản:</span>
            <span class="bank-val">
              <strong>${bankCfg.accountName}</strong>
            </span>
          </div>
          <div class="bank-row">
            <span class="bank-label">Số tiền:</span>
            <span class="bank-val" style="color: var(--primary); font-size: 1.15rem; font-weight: 800;">
              ${this.formatCurrency(order.total_amount)}
              <span class="copy-badge" onclick="window.storeApp.copyText('${order.total_amount}', 'Đã sao chép Số tiền!')">📋 Sao chép</span>
            </span>
          </div>
          <div class="bank-row">
            <span class="bank-label">Nội dung CK:</span>
            <span class="bank-val" style="color: #D9534F;">
              <strong style="letter-spacing: 0.5px;">${order.transfer_content}</strong>
              <span class="copy-badge" onclick="window.storeApp.copyText('${order.transfer_content}', 'Đã sao chép Nội dung CK!')">📋 Sao chép</span>
            </span>
          </div>
        </div>

        <div class="qr-guide-box">
          <div class="qr-guide-step">
            <span class="qr-guide-num">1</span>
            <span>Mở App Ngân hàng &gt; Chọn <strong>Quét mã QR</strong></span>
          </div>
          <div class="qr-guide-step">
            <span class="qr-guide-num">2</span>
            <span>Kiểm tra đúng tên <strong>${bankCfg.accountName}</strong> & nội dung <strong>${order.transfer_content}</strong></span>
          </div>
          <div class="qr-guide-step">
            <span class="qr-guide-num">3</span>
            <span>Xác nhận chuyển tiền trên App, sau đó bấm nút xác nhận bên dưới</span>
          </div>
        </div>

        <div id="paymentStatusBox" class="payment-status-bar">
          <div class="pulse-dot"></div>
          <span>Đang chờ chuyển khoản từ ứng dụng ngân hàng...</span>
        </div>

        <div id="paymentPendingNoticeBox"></div>

        <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 10px;">
          <button id="btnConfirmPaid" class="btn btn-primary btn-lg" style="width: 100%; font-weight: 800; font-size: 1rem;" onclick="window.storeApp.handleConfirmPaymentClicked(${order.order_code})">
            ✅ Tôi Đã Chuyển Khoản Thành Công
          </button>
          ${window.authManager.isAdmin() ? `
            <button class="btn btn-secondary btn-sm" style="color: var(--primary); font-weight: 700; border-color: var(--primary); padding: 8px;" onclick="window.storeApp.handleAdminInstantApprove(${order.order_code})" title="Chức năng dành riêng cho Admin sonbigcar để kiểm thử cấp bản quyền">
              ⚡ [Admin Test] Duyệt & Kích Hoạt Ngay Lập Tức
            </button>
          ` : ''}
          <div style="display: flex; gap: 8px;">
            <a href="${qrUrl}" download="VietQR_DoanSon_${order.order_code}.png" class="btn btn-secondary btn-sm" style="flex: 1; text-align: center; text-decoration: none;" target="_blank">
              📥 Tải Ảnh Mã QR
            </a>
            <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="window.storeApp.closePaymentModal()">
              Đóng / Để Sau
            </button>
          </div>
        </div>
      </div>
    `;

    modalEl.classList.add('active');

    // Khởi động đồng hồ đếm ngược 15 phút
    this.paymentCountdownInterval = setInterval(() => {
      this.paymentTimeRemaining--;
      const timerEl = document.getElementById('qrTimerDisplay');
      if (timerEl) {
        if (this.paymentTimeRemaining <= 0) {
          clearInterval(this.paymentCountdownInterval);
          timerEl.textContent = 'Hết hạn';
          timerEl.style.color = 'var(--danger)';
        } else {
          const mins = Math.floor(this.paymentTimeRemaining / 60).toString().padStart(2, '0');
          const secs = (this.paymentTimeRemaining % 60).toString().padStart(2, '0');
          timerEl.textContent = `⏳ ${mins}:${secs}`;
        }
      }
    }, 1000);

    // Lắng nghe trạng thái realtime (tự động mở khóa khi Admin bấm Duyệt trong tab Quản lý Đơn Hàng)
    window.paymentGateway.startPaymentPolling(order.order_code, (status, updatedOrder) => {
      if (status === 'paid') {
        this.handlePaymentCompletedSuccessfully(updatedOrder);
      }
    });
  }

  async handleConfirmPaymentClicked(orderCode) {
    const btn = document.getElementById('btnConfirmPaid');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Đang gửi thông báo đối soát...';
    }

    try {
      const res = await window.paymentGateway.notifyCustomerTransferred(orderCode);
      if (res && res.success) {
        if (res.isPaid) {
          this.handlePaymentCompletedSuccessfully(res.order);
        } else {
          this.showPaymentPendingApprovalNotice(res.order);
        }
      }
    } catch (e) {
      alert('Không thể gửi thông báo: ' + e.message);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '✅ Tôi Đã Chuyển Khoản Thành Công';
      }
    }
  }

  showPaymentPendingApprovalNotice(order) {
    const statusBox = document.getElementById('paymentStatusBox');
    if (statusBox) {
      statusBox.className = 'payment-status-bar warning';
      statusBox.innerHTML = `
        <span>⏳ Đã gửi thông báo chuyển khoản! Đang chờ Admin xác nhận số dư...</span>
      `;
    }

    const btn = document.getElementById('btnConfirmPaid');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Đã Gửi Thông Báo - Đang Chờ Admin Duyệt Tiền';
      btn.style.opacity = '0.75';
    }

    const noticeBox = document.getElementById('paymentPendingNoticeBox');
    if (noticeBox) {
      noticeBox.innerHTML = `
        <div style="background: #FFFBEB; border: 1.5px solid #FCD34D; border-radius: var(--radius-lg); padding: 16px; margin-top: 14px; text-align: left;">
          <h4 style="font-weight: 700; color: #92400E; margin-bottom: 6px; font-size: 0.95rem;">
            ⏳ Đã ghi nhận thông báo chuyển khoản đơn hàng #${order.order_code}
          </h4>
          <p style="font-size: 0.85rem; color: #78350F; line-height: 1.5; margin-bottom: 8px;">
            Hệ thống đang đối soát với tài khoản ngân hàng. Sau khi Admin kiểm tra tài khoản đã nhận đúng <strong>${this.formatCurrency(order.total_amount)}</strong>, sản phẩm và bản quyền sẽ tự động được kích hoạt ngay lập tức!
          </p>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">
            💡 Bạn có thể giữ nguyên cửa sổ này chờ duyệt tự động, hoặc xem trạng thái đơn trong mục <strong>"Bản Quyền Của Tôi"</strong>.
          </p>
        </div>
      `;
    }
  }

  async handleAdminInstantApprove(orderCode) {
    if (confirm(`⚡ [CHẾ ĐỘ ADMIN TEST]\nBạn có muốn duyệt kích hoạt ngay đơn hàng #${orderCode} để kiểm thử bản quyền?`)) {
      try {
        const res = await window.paymentGateway.approveOrderByAdmin(orderCode);
        if (res && res.success) {
          this.handlePaymentCompletedSuccessfully(res.order, res.generatedKeys);
        }
      } catch (err) {
        alert('Lỗi duyệt: ' + err.message);
      }
    }
  }

  handlePaymentCompletedSuccessfully(order, generatedKeys = []) {
    if (this.paymentCountdownInterval) {
      clearInterval(this.paymentCountdownInterval);
      this.paymentCountdownInterval = null;
    }

    const statusBox = document.getElementById('paymentStatusBox');
    if (statusBox) {
      statusBox.className = 'payment-status-bar success';
      statusBox.innerHTML = `
        <span>✅ Đã xác nhận giao dịch thành công! Đang kích hoạt quyền sử dụng...</span>
      `;
    }

    this.cart = [];
    this.saveCart();

    const hasTools = order.items.some(i => i.product_type === 'tool');

    setTimeout(() => {
      this.closePaymentModal();
      if (hasTools) {
        alert(`🎉 CHÚC MỪNG BẠN ĐÃ MUA THÀNH CÔNG!\n\n• Đơn hàng: #${order.order_code}\n• Bản quyền Revit Tools đã được kích hoạt thành công!\n• Vui lòng sao chép License Key trong mục "Bản Quyền Của Tôi" để kích hoạt trên Revit.`);
        this.switchMainView('licenseView');
      } else {
        alert(`🎉 CHÚC MỪNG BẠN ĐÃ MUA THÀNH CÔNG!\n\n• Đơn hàng: #${order.order_code}\n• File Revit Family / Template đã được mở khóa tải về không giới hạn trong "Thư Viện Của Tôi"!`);
        this.switchMainView('libraryView');
      }
    }, 1200);
  }

  closePaymentModal() {
    if (this.paymentCountdownInterval) {
      clearInterval(this.paymentCountdownInterval);
      this.paymentCountdownInterval = null;
    }
    window.paymentGateway.stopPaymentPolling();
    const modalEl = document.getElementById('paymentModalOverlay');
    if (modalEl) modalEl.classList.remove('active');
  }

  /**
   * CUSTOM REQUESTS
   */
  handleCustomRequestSubmit() {
    const name = document.getElementById('reqClientName').value.trim();
    const email = document.getElementById('reqEmail').value.trim();
    const phone = document.getElementById('reqPhone').value.trim();
    const serviceType = document.getElementById('reqServiceType').value;
    const title = document.getElementById('reqTitle').value.trim();
    const desc = document.getElementById('reqDesc').value.trim();

    if (!name || !email || !title) {
      alert('Vui lòng điền đầy đủ thông tin bắt buộc (*).');
      return;
    }

    const newReq = {
      id: 'req-' + Date.now().toString(16),
      customer_name: name,
      contact_email: email,
      phone: phone,
      service_type: serviceType,
      title: title,
      description: desc,
      status: 'new',
      created_at: new Date().toISOString()
    };

    window.dataStore.saveCustomRequest(newReq);
    alert('🎉 Yêu cầu đặt hàng của bạn đã được gửi thành công!\nĐội ngũ kỹ sư RevitHub sẽ liên hệ tư vấn và gửi báo giá trong 24h.');
    document.getElementById('customServiceForm').reset();
    this.switchMainView('storefrontView');
  }

  /**
   * THƯ VIỆN & BẢN QUYỀN
   */
  renderUserLibrary() {
    const user = window.authManager.getCurrentUser();
    const container = document.getElementById('userPurchasedList');
    if (!container) return;

    if (!user) {
      container.innerHTML = `<div style="text-align: center; padding: 40px;">Vui lòng đăng nhập để xem thư viện.</div>`;
      return;
    }

    const purchases = window.dataStore.getUserPurchases(user.id);
    if (purchases.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--text-muted); grid-column: 1/-1;">
          <div style="font-size: 2.8rem; margin-bottom: 12px;">📁</div>
          <h3>Bạn chưa sở hữu Family hoặc Template nào</h3>
          <button class="btn btn-primary" style="margin-top: 16px;" onclick="window.storeApp.switchMainView('storefrontView')">
            Khám phá Cửa hàng
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = purchases.map(pur => {
      const product = window.dataStore.getProductById(pur.product_id);
      if (!product) return '';

      return `
        <div class="library-card">
          <div class="library-card-header">
            <img class="library-thumb" src="${product.thumbnail_url}" alt="${product.name}">
            <div class="library-info">
              <h4>${product.name}</h4>
              <span class="badge ${product.product_type === 'template' ? 'badge-template' : 'badge-family'}" style="margin-top: 4px;">
                ${product.product_type === 'template' ? 'Project Template .RTE' : 'Revit Family .RFA'}
              </span>
            </div>
          </div>

          <div class="library-download-box">
            <div style="display: flex; justify-content: space-between; font-size: 0.84rem;">
              <span>File: <strong>${product.metadata.file_name}</strong></span>
              <span style="color: var(--text-dim);">${product.metadata.file_size}</span>
            </div>

            <div id="downloadAction_${product.id}">
              <button class="btn btn-primary btn-sm" style="width: 100%;" onclick="window.storeApp.requestSecureDownload('${product.id}')">
                🔒 Lấy liên kết tải xuống an toàn (15 Phút)
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  requestSecureDownload(productId) {
    const user = window.authManager.getCurrentUser();
    try {
      const result = window.downloadManager.requestDownloadUrl(productId, user);
      const actionBox = document.getElementById(`downloadAction_${productId}`);

      if (actionBox) {
        actionBox.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <a href="${result.signedUrl}" class="btn btn-primary btn-sm" style="background: var(--success); width: 100%;" download="${result.fileName}" onclick="alert('Đang tải file an toàn!')">
              ⬇️ Tải Ngay (${result.fileName})
            </a>
            <div class="download-countdown">
              ⏱️ Liên kết hết hạn sau: <strong>15 phút</strong> (Không lộ link R2)
            </div>
          </div>
        `;
      }
    } catch (e) {
      alert(e.message);
    }
  }

  renderUserLicenses() {
    const user = window.authManager.getCurrentUser();
    const container = document.getElementById('userLicensesList');
    if (!container) return;

    if (!user) {
      container.innerHTML = `<div style="text-align: center; padding: 40px;">Vui lòng đăng nhập để xem bản quyền.</div>`;
      return;
    }

    const licenses = window.dataStore.getLicenses(user.id);
    if (licenses.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <div style="font-size: 2.8rem; margin-bottom: 12px;">🔑</div>
          <h3>Chưa có bản quyền Revit Tools nào</h3>
          <p style="margin-top: 6px;">Hãy khám phá các Add-in Revit tự động hóa trên cửa hàng.</p>
          <button class="btn btn-primary" style="margin-top: 16px;" onclick="window.storeApp.navigateToPillar('tools')">
            Khám phá Revit Tools
          </button>
        </div>
      `;
      return;
    }

    const now = new Date();

    const bannerHtml = `
      <div style="background: #FFFFFF; border: var(--border-light); border-radius: var(--radius-xl); padding: 22px 28px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; box-shadow: var(--shadow-sm);">
        <div>
          <h3 style="font-family: var(--font-heading); font-size: 1.35rem; color: var(--text-pure); margin-bottom: 4px;">
            🛡️ Trung Tâm Quản Lý Bản Quyền Revit Tools
          </h3>
          <p style="font-size: 0.88rem; color: var(--text-muted); margin: 0;">
            Theo dõi thời hạn sử dụng, quản lý các máy trạm kích hoạt đồng thời, tải file bản quyền offline (.LIC) và bộ cài mới nhất.
          </p>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" onclick="window.storeApp.openLicenseGuideModal()">
            📖 Hướng Dẫn Kích Hoạt Trong Revit
          </button>
        </div>
      </div>
    `;

    container.innerHTML = bannerHtml + licenses.map(lic => {
      const expiry = new Date(lic.expiry_date);
      const start = new Date(lic.start_date || (Date.now() - 30 * 86400000));
      const totalDays = Math.max(1, Math.round((expiry - start) / (1000 * 60 * 60 * 24)));
      const remainingDays = Math.round((expiry - now) / (1000 * 60 * 60 * 24));
      const usedDays = Math.max(0, totalDays - remainingDays);
      const percentUsed = Math.min(100, Math.max(0, Math.round((usedDays / totalDays) * 100)));

      const isExpired = remainingDays <= 0;
      const isNearExpiry = remainingDays > 0 && remainingDays <= 15;
      const activations = lic.activations || [];

      let statusBadge = `<span class="badge badge-family">Đang Hoạt Động</span>`;
      let statusColor = 'var(--success)';
      if (isExpired) {
        statusBadge = `<span class="badge" style="background:#FFE4E6; color:#E11D48; border:1px solid #FECDD3;">Đã Hết Hạn</span>`;
        statusColor = 'var(--danger)';
      } else if (isNearExpiry) {
        statusBadge = `<span class="badge badge-custom">Sắp Hết Hạn (${remainingDays} ngày)</span>`;
        statusColor = 'var(--warning)';
      }

      return `
        <div class="license-card">
          <!-- HEADER THÔNG TIN GÓI BẢN QUYỀN -->
          <div class="license-top">
            <div>
              <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 6px;">
                <span class="badge badge-tool">Revit Add-in</span>
                ${statusBadge}
                <span class="badge badge-version" style="background:#FAF3EE; color:var(--text-muted);">${lic.plan_name || 'Gói Cá Nhân'}</span>
                <span class="badge badge-version" style="background:#FAF3EE; color:var(--text-muted);">${lic.version || 'v2.4.0'}</span>
              </div>
              <h3 style="font-family: var(--font-heading); font-size: 1.5rem; color: var(--text-pure); margin-bottom: 4px;">
                ${lic.product_name}
              </h3>
              <div style="font-size: 0.88rem; color: var(--text-muted);">
                Chủ sở hữu: <strong style="color:var(--text-pure);">${lic.user_name || user.full_name}</strong> • 
                Công ty: <strong>${lic.company || 'Doanh Nghiệp BIM'}</strong>
              </div>
            </div>

            <!-- LICENSE KEY & COPY -->
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
              <div class="license-key-display">
                <span>${lic.license_key}</span>
                <span class="copy-badge" onclick="navigator.clipboard.writeText('${lic.license_key}'); alert('Đã sao chép License Key vào Clipboard!');">
                  Sao chép
                </span>
              </div>
              <div style="font-size: 0.78rem; color: var(--text-dim);">Dùng mã này để kích hoạt trong tab Revit Add-in</div>
            </div>
          </div>

          <!-- THANH TIẾN TRÌNH THỜI GIAN SỬ DỤNG (TIME PROGRESS BAR) -->
          <div style="background: #FAF3EE; border: 1px solid #EAE0D7; border-radius: var(--radius-lg); padding: 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 0.9rem;">
              <div>
                <strong>Thời hạn thuê bao:</strong> 
                <span style="color: ${statusColor}; font-weight: 800;">
                  ${isExpired ? 'Đã hết hạn vào ngày ' + expiry.toLocaleDateString('vi-VN') : 'Còn lại ' + remainingDays + ' ngày (Hết hạn: ' + expiry.toLocaleDateString('vi-VN') + ')'}
                </span>
              </div>
              <div style="font-size: 0.82rem; color: var(--text-dim);">
                Đã sử dụng ${usedDays} / ${totalDays} ngày (${percentUsed}%)
              </div>
            </div>

            <!-- Progress Track -->
            <div style="background: #EAE0D7; height: 10px; border-radius: var(--radius-full); overflow: hidden; position: relative;">
              <div style="background: ${isExpired ? 'var(--danger)' : (isNearExpiry ? 'var(--warning)' : 'var(--primary)')}; width: ${percentUsed}%; height: 100%; border-radius: var(--radius-full); transition: width 0.6s ease;"></div>
            </div>

            <!-- Quick Action Bar -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; flex-wrap: wrap; gap: 10px;">
              <div style="display: flex; gap: 10px;">
                <button class="btn btn-primary btn-sm" onclick="window.storeApp.renewUserLicense('${lic.id}')">
                  ⚡ Gia Hạn Bản Quyền (+1 Năm)
                </button>
                <a href="${lic.download_url || '#'}" class="btn btn-secondary btn-sm" download onclick="alert('Đang tải bộ cài đặt mới nhất v2.4.0!')">
                  ⬇️ Tải Bộ Cài (.EXE)
                </a>
                <button class="btn btn-secondary btn-sm" onclick="window.licenseManager.exportOfflineLicenseFile('${lic.id}')" title="Dành cho máy không kết nối Internet">
                  📄 Tải File License Offline (.LIC)
                </button>
              </div>
              <div style="font-size: 0.82rem; color: var(--text-dim);">
                Hỗ trợ kỹ thuật 24/7: <strong>support@revitstore.vn</strong>
              </div>
            </div>
          </div>

          <!-- QUẢN LÝ CÁC THIẾT BỊ / MÁY TÍNH KÍCH HOẠT (HWID SLOTS) -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
              <div>
                <h4 style="font-size: 1.05rem; color: var(--text-pure); font-weight: 800;">
                  Thiết Bị Kích Hoạt (${activations.length}/${lic.max_machines} Máy Trạm)
                </h4>
                <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 2px;">
                  Bạn có thể liên kết tối đa ${lic.max_machines} máy tính đồng thời. Khi đổi máy trạm, hãy bấm 'Gỡ máy' để giải phóng slot.
                </p>
              </div>
            </div>

            ${activations.length === 0 ? `
              <div style="background: #FFFBF9; border: 1px dashed #EAE0D7; border-radius: var(--radius-md); padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
                Chưa có máy tính nào kích hoạt key này. Mở Autodesk Revit trên máy trạm của bạn, vào Add-in và dán mã <strong>${lic.license_key}</strong> để bắt đầu sử dụng.
              </div>
            ` : `
              <div class="admin-table-container">
                <table class="machines-table">
                  <thead>
                    <tr>
                      <th>Tên Máy Trạm</th>
                      <th>Hardware ID (HWID)</th>
                      <th>Phiên Bản Revit</th>
                      <th>IP Kết Nối</th>
                      <th>Lần Ping Gần Nhất</th>
                      <th>Trạng Thái</th>
                      <th>Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${activations.map(act => `
                      <tr>
                        <td>
                          <strong>${act.machine_name || 'PC-Workstation'}</strong>
                          <button style="border:none; background:none; cursor:pointer; font-size:0.8rem; margin-left:4px;" onclick="window.storeApp.renameUserMachine('${lic.id}', '${act.machine_id}', '${act.machine_name || ''}')" title="Đổi tên máy">
                            ✏️
                          </button>
                          <br><small style="color: var(--text-dim); font-size: 0.76rem;">${act.os_info || 'Windows 11'}</small>
                        </td>
                        <td style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--primary); font-weight: 600;">
                          ${act.machine_id}
                        </td>
                        <td><span class="badge badge-version">Revit v${act.revit_version || '2025'}</span></td>
                        <td style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-dim);">${act.ip_address || '118.70.182.45'}</td>
                        <td>${new Date(act.last_checked_at).toLocaleDateString('vi-VN')} ${new Date(act.last_checked_at).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}</td>
                        <td>
                          <span class="badge badge-family" style="font-size: 0.68rem;">🟢 Đang Kết Nối</span>
                        </td>
                        <td>
                          <button class="btn btn-secondary btn-sm" style="color: var(--danger); font-size: 0.78rem;" onclick="window.storeApp.deactivateMachine('${lic.id}', '${act.machine_id}')">
                            🗑️ Gỡ Máy Này
                          </button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  renewUserLicense(licenseId) {
    if (confirm('Xác nhận gia hạn bản quyền thêm 1 năm (365 ngày)?')) {
      const updated = window.licenseManager.renewLicense(licenseId, 365);
      if (updated) {
        alert(`🎉 Gia hạn thành công! Thời hạn mới đến ngày: ${new Date(updated.expiry_date).toLocaleDateString('vi-VN')}`);
        this.renderUserLicenses();
      }
    }
  }

  renameUserMachine(licenseId, machineId, currentName) {
    const newName = prompt('Nhập tên gợi nhớ mới cho máy trạm này (Ví dụ: Laptop Đi Công Trường, Máy Bàn Anh Tuấn):', currentName);
    if (newName && newName.trim()) {
      window.licenseManager.renameMachine(licenseId, machineId, newName.trim());
      this.renderUserLicenses();
    }
  }

  copyText(text, successMsg = 'Đã sao chép vào bộ nhớ tạm!') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        alert(successMsg);
      }).catch(() => {
        prompt('Sao chép nội dung:', text);
      });
    } else {
      prompt('Sao chép nội dung:', text);
    }
  }

  deactivateMachine(licenseId, machineId) {
    if (confirm('Bạn có chắc muốn gỡ liên kết máy tính này? Sau khi gỡ, bạn có thể nhập key trên máy tính mới.')) {
      window.licenseManager.deactivateSingleMachine(licenseId, machineId);
      alert('Đã gỡ liên kết máy tính thành công. Slot kích hoạt đã được giải phóng!');
      this.renderUserLicenses();
    }
  }

  openLicenseGuideModal() {
    const modal = document.getElementById('licenseGuideModalOverlay');
    if (modal) modal.classList.add('active');
  }

  closeLicenseGuideModal() {
    const modal = document.getElementById('licenseGuideModalOverlay');
    if (modal) modal.classList.remove('active');
  }
}

window.storeApp = new StoreApp();
