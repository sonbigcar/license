/**
 * ==============================================================================
 * REVIT BIM STORE - DATA STORE & SUPABASE REPOSITORY ADAPTER
 * Hỗ trợ Revit Tools, Revit Family, Project Templates, Video Reviews & Admin CRUD
 * ==============================================================================
 */

class DataStore {
  constructor() {
    this.STORAGE_PREFIX = 'revit_hub_';
    this.initDefaultData();
  }

  initDefaultData() {
    // 1. DỮ LIỆU SẢN PHẨM: TOOLS, FAMILY & TEMPLATE (CÓ VIDEO REVIEW)
    const defaultProducts = [
      // --- NHÓM 1: REVIT TOOLS (ADD-IN) ---
      {
        id: 'tool-001',
        name: 'MEP Auto Routing & Smart Elevation Pro',
        slug: 'mep-auto-routing-smart-elevation-pro',
        product_type: 'tool',
        category: 'Revit Add-in Tự Động Hóa',
        description: 'Công cụ số 1 cho kỹ sư MEP: Tự động vẽ đường ống né dầm né cột chỉ với 1 cú click. Tự động kiểm tra xung đột thời gian thực và xuất báo cáo va chạm chi tiết sang Excel.',
        short_description: 'Tự động né dầm/cột cho ống gió & ống nước, giải quyết va chạm tức thì.',
        revit_versions: ['2022', '2023', '2024', '2025'],
        thumbnail_url: 'assets/card_tools.jpg',
        video_url: 'https://www.youtube.com/embed/5qap5aO4i9A', // Video demo MEP automation
        price: 1800000,
        sale_price: 1200000,
        billing_cycle: 'yearly',
        is_active: true,
        metadata: {
          version: 'v2.4.0',
          target_revit: 'Revit 2022-2025',
          file_name: 'MEP_Routing_Pro_v2.4.0_Setup.exe',
          file_size: '28.5 MB',
          author: 'RevitHub Studio'
        }
      },
      {
        id: 'tool-002',
        name: 'Batch Sheet Exporter & Auto Renaming Pro',
        slug: 'batch-sheet-exporter-auto-renaming',
        product_type: 'tool',
        category: 'Revit Add-in Tự Động Hóa',
        description: 'Công cụ xuất hàng loạt bản vẽ PDF, DWG, NWC theo cú pháp chuẩn ISO 19650. Tự động đánh số và sắp xếp bản vẽ theo tiến độ dự án, tiết kiệm 90% thời gian.',
        short_description: 'Xuất hàng loạt PDF/DWG/NWC chuẩn ISO 19650, tiết kiệm 90% thời gian.',
        revit_versions: ['2021', '2022', '2023', '2024', '2025'],
        thumbnail_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
        video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        price: 950000,
        sale_price: 750000,
        billing_cycle: 'yearly',
        is_active: true,
        metadata: {
          version: 'v1.8.2',
          target_revit: 'Revit 2021-2025',
          file_name: 'Batch_Sheet_Exporter_Setup.zip',
          file_size: '15.2 MB',
          author: 'RevitHub Studio'
        }
      },
      {
        id: 'tool-003',
        name: 'Rebar Detailer & Auto Scheduling Pro',
        slug: 'rebar-detailer-auto-scheduling',
        product_type: 'tool',
        category: 'Revit Add-in Kết Cấu',
        description: 'Tự động rải thép dầm, cột, móng, sàn theo TCVN 5574:2018. Tự động gắn tag thép hình học, sinh bảng thống kê thép chuẩn xác 100% không cần Dynamo.',
        short_description: 'Tự động rải thép dầm/cột và sinh bảng thống kê thép chuẩn TCVN.',
        revit_versions: ['2022', '2023', '2024', '2025'],
        thumbnail_url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80',
        video_url: 'https://www.youtube.com/embed/kJQP7kiw5Fk',
        price: 1500000,
        sale_price: 1100000,
        billing_cycle: 'yearly',
        is_active: true,
        metadata: {
          version: 'v3.1.0',
          target_revit: 'Revit 2022-2025',
          file_name: 'Rebar_Detailer_Setup.exe',
          file_size: '22.0 MB',
          author: 'RevitHub Studio'
        }
      },

      // --- NHÓM 2: REVIT FAMILY (.RFA) ---
      {
        id: 'fam-001',
        name: 'Bơm Chữa Cháy Trục Đứng Đa Tầng Cánh (Multistage Fire Pump)',
        slug: 'bom-chua-chay-truc-dung-da-tang-canh',
        product_type: 'family',
        category: 'MEP - Phòng Cháy Chữa Cháy',
        description: 'Family Revit chuẩn MEP đầy đủ connector PCCC (Suction/Discharge) và Cấp điện. Tham số đầy đủ theo Catalogue Grundfos/Ebara, tích hợp 2D Symbol TCVN hiển thị sắc nét trên mặt bằng mà không làm nặng mô hình.',
        short_description: 'Family chuẩn MEP đầy đủ Connector nước & điện, chuẩn TCVN.',
        revit_versions: ['2021', '2022', '2023', '2024', '2025'],
        thumbnail_url: 'assets/card_family.jpg',
        video_url: 'https://www.youtube.com/embed/5qap5aO4i9A',
        price: 350000,
        sale_price: 250000,
        billing_cycle: 'one_time',
        is_active: true,
        metadata: {
          lod: 'LOD 350',
          category: 'Mechanical Equipment',
          file_name: 'AHC_Vertical_FirePump_v2024.rfa',
          file_size: '4.8 MB',
          omniclass: '23.35.10.11'
        }
      },
      {
        id: 'fam-002',
        name: 'Van Bướm Tín Hiệu Điện Kèm Công Tắc Giám Sát',
        slug: 'van-buom-tin-hieu-dien-kem-cong-tac',
        product_type: 'family',
        category: 'MEP - Cấp Thoát Nước & PCCC',
        description: 'Van bướm kèm công tắc báo trạng thái Đóng/Mở về tủ trung tâm PCCC. Dải kích thước từ DN50 đến DN300, đầy đủ thông số thủy lực, áp lực làm việc PN16/PN25.',
        short_description: 'Đầy đủ dải kích thước DN50-DN300, tích hợp thông số thủy lực.',
        revit_versions: ['2022', '2023', '2024', '2025'],
        thumbnail_url: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=800&q=80',
        video_url: 'https://www.youtube.com/embed/kJQP7kiw5Fk',
        price: 200000,
        sale_price: 150000,
        billing_cycle: 'one_time',
        is_active: true,
        metadata: {
          lod: 'LOD 300',
          category: 'Pipe Accessories',
          file_name: 'Signal_Butterfly_Valve_DN50-300.rfa',
          file_size: '3.2 MB'
        }
      },
      {
        id: 'fam-003',
        name: 'Cửa Đi Nhôm Kính Xingfa Hệ 55 Mở Quay 1-2 Cánh Parametric',
        slug: 'cua-di-nhom-kinh-xingfa-he-55',
        product_type: 'family',
        category: 'Kiến Trúc - Cửa & Vách',
        description: 'Family cửa nhôm Xingfa hệ 55 đầy đủ thông số biến thiên (Parametric: Chiều rộng, chiều cao, độ dày kính, màu nhôm). Tích hợp góc mở 2D/3D linh hoạt.',
        short_description: 'Family thông số biến thiên linh hoạt, đầy đủ thông số kích thước cửa.',
        revit_versions: ['2020', '2021', '2022', '2023', '2024', '2025'],
        thumbnail_url: 'https://images.unsplash.com/photo-1534237710431-e2fc698436d0?auto=format&fit=crop&w=800&q=80',
        video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        price: 180000,
        sale_price: 120000,
        billing_cycle: 'one_time',
        is_active: true,
        metadata: {
          lod: 'LOD 300',
          category: 'Doors',
          file_name: 'Xingfa_Door_System55_Parametric.rfa',
          file_size: '3.6 MB'
        }
      },

      // --- NHÓM 3: PROJECT TEMPLATES (.RTE) ---
      {
        id: 'tmpl-001',
        name: 'Template Revit MEP Nhà Cao Tầng & TTTM Chuẩn TCVN / ISO 19650',
        slug: 'template-revit-mep-nha-cao-tang-tcvn',
        product_type: 'template',
        category: 'Project Template - MEP',
        description: 'Bộ Template dự án MEP hoàn chỉnh nhất: Cấu hình sẵn toàn bộ Pipe System, Duct System, View Template phân hệ (HVAC, PCCC, Cấp thoát nước, Điện), Bộ lọc màu Filter tiêu chuẩn, Khung tên Titleblock chuẩn quốc tế.',
        short_description: 'Template đầy đủ View Template, hệ thống đường ống và bảng thống kê MEP.',
        revit_versions: ['2022', '2023', '2024', '2025'],
        thumbnail_url: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80',
        video_url: 'https://www.youtube.com/embed/5qap5aO4i9A',
        price: 850000,
        sale_price: 590000,
        billing_cycle: 'one_time',
        is_active: true,
        metadata: {
          format: '.RTE (Revit Template)',
          file_name: 'RevitHub_MEP_HighRise_Template_v2024.rte',
          file_size: '45.0 MB',
          standards: 'TCVN, NFPA, ISO 19650'
        }
      },
      {
        id: 'tmpl-002',
        name: 'Template Kiến Trúc Nhà Phố & Biệt Thự Hiện Đại TCVN',
        slug: 'template-kien-truc-nha-pho-biet-thu',
        product_type: 'template',
        category: 'Project Template - Kiến Trúc',
        description: 'Template thiết kế nhà phố, biệt thự: Cài đặt sẵn thư viện tường nhiều lớp, chủng loại trần, sàn, ghi chú ký hiệu dim/tag chuẩn bản vẽ thi công Việt Nam, tự động xuất diện tích phòng và bảng vật liệu.',
        short_description: 'Bộ template chuyên nghiệp cho kiến trúc sư, xuất hồ sơ thi công nhanh chóng.',
        revit_versions: ['2021', '2022', '2023', '2024', '2025'],
        thumbnail_url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
        video_url: 'https://www.youtube.com/embed/kJQP7kiw5Fk',
        price: 650000,
        sale_price: 450000,
        billing_cycle: 'one_time',
        is_active: true,
        metadata: {
          format: '.RTE (Revit Template)',
          file_name: 'RevitHub_Architectural_Villa_Template.rte',
          file_size: '38.0 MB',
          standards: 'TCVN Hồ sơ thiết kế kỹ thuật'
        }
      }
    ];

    // Luôn đảm bảo có dữ liệu sản phẩm đầy đủ và cập nhật video_url
    const existing = this.get('products');
    if (!existing || existing.length === 0 || !existing[0].video_url) {
      this.save('products', defaultProducts);
    }

    // 2. DỮ LIỆU TÀI KHOẢN NGƯỜI DÙNG (Dành cho Admin quản lý)
    if (!localStorage.getItem(this.STORAGE_PREFIX + 'accounts')) {
      const defaultAccounts = [
        {
          id: 'acc-admin-01',
          email: 'admin@doanson.com',
          username: 'sonbigcar',
          full_name: 'Đoàn Thanh Sơn (Admin)',
          phone: '0908123456',
          company: 'DoanSon BIM Studio',
          role: 'admin',
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
          orders_count: 0
        },
        {
          id: 'acc-admin-02',
          email: 'admin@revitstore.vn',
          username: 'admin',
          full_name: 'Quản Trị Viên Hệ Thống',
          phone: '0909999888',
          company: 'DoanSon BIM Studio',
          role: 'admin',
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
          orders_count: 0
        },
        {
          id: 'acc-user-01',
          email: 'engineer.bim@gmail.com',
          full_name: 'Đoàn Sơn - BIM Coordinator',
          phone: '0908123456',
          company: 'MEP BIM Solutions Vietnam',
          role: 'customer',
          status: 'active',
          created_at: '2026-02-15T08:30:00Z',
          orders_count: 3
        },
        {
          id: 'acc-user-02',
          email: 'nguyen.hvac@vinabim.com',
          full_name: 'Nguyễn Văn Hùng - Kỹ Sư HVAC',
          phone: '0912345678',
          company: 'VinaBIM Engineering',
          role: 'customer',
          status: 'active',
          created_at: '2026-03-10T14:20:00Z',
          orders_count: 1
        },
        {
          id: 'acc-user-03',
          email: 'tran.arc@designstudio.vn',
          full_name: 'Trần Minh Quân - Chủ Trì Kiến Trúc',
          phone: '0987654321',
          company: 'S-Design Architects',
          role: 'customer',
          status: 'active',
          created_at: '2026-03-22T09:15:00Z',
          orders_count: 2
        }
      ];
      this.save('accounts', defaultAccounts);
    }

    // 3. DỮ LIỆU ĐẶT HÀNG DỊCH VỤ THUÊ VIẾT TOOLS & TẠO TEMPLATE
    if (!localStorage.getItem(this.STORAGE_PREFIX + 'custom_requests')) {
      const defaultRequests = [
        {
          id: 'req-001',
          customer_name: 'Công ty Cổ phần Tư vấn Thiết kế BIM Group',
          contact_email: 'bim.director@bimgroup.vn',
          phone: '0903888777',
          service_type: 'Viết Add-in Revit Riêng',
          title: 'Add-in tự động tính toán thủy lực và chọn đường kính ống nước lạnh Chiller',
          description: 'Cần viết plugin Revit C# kết nối cơ sở dữ liệu tổn thất áp lực để tự động gắn thông số vào đường ống và xuất bảng tính sang Excel theo biểu mẫu nội bộ.',
          status: 'in_progress',
          created_at: '2026-03-15T10:00:00Z'
        },
        {
          id: 'req-002',
          customer_name: 'S-Design Architecture Studio',
          contact_email: 'contact@sdesign.vn',
          phone: '0912888999',
          service_type: 'Xây dựng Bộ Template Chuẩn',
          title: 'Chuẩn hóa bộ Template Kiến trúc & Quy hoạch cho 50 máy trạm',
          description: 'Xây dựng Shared Parameter, View Template đồng bộ và chuyển đổi toàn bộ thư viện AutoCAD sang Family Revit chuẩn.',
          status: 'new',
          created_at: '2026-03-18T16:45:00Z'
        }
      ];
      this.save('custom_requests', defaultRequests);
    }

    if (!localStorage.getItem(this.STORAGE_PREFIX + 'orders')) {
      this.save('orders', []);
    }
    if (!localStorage.getItem(this.STORAGE_PREFIX + 'user_purchases')) {
      this.save('user_purchases', []);
    }
    if (!localStorage.getItem(this.STORAGE_PREFIX + 'licenses')) {
      this.save('licenses', []);
    }
    if (!localStorage.getItem(this.STORAGE_PREFIX + 'download_logs')) {
      this.save('download_logs', []);
    }
  }

  get(key) {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_PREFIX + key)) || [];
    } catch (e) {
      return [];
    }
  }

  save(key, data) {
    localStorage.setItem(this.STORAGE_PREFIX + key, JSON.stringify(data));
  }

  getProducts() {
    return this.get('products');
  }

  getProductById(id) {
    return this.getProducts().find(p => p.id === id);
  }

  /**
   * ADMIN THÊM / CẬP NHẬT SẢN PHẨM & NIÊM YẾT GIÁ
   */
  saveProduct(product) {
    const products = this.getProducts();
    const idx = products.findIndex(p => p.id === product.id);
    if (idx >= 0) {
      products[idx] = product;
    } else {
      products.unshift(product);
    }
    this.save('products', products);
  }

  deleteProduct(productId) {
    let products = this.getProducts();
    products = products.filter(p => p.id !== productId);
    this.save('products', products);
  }

  getAccounts() {
    return this.get('accounts');
  }

  saveAccount(account) {
    const accounts = this.getAccounts();
    const idx = accounts.findIndex(a => a.id === account.id || a.email === account.email);
    if (idx >= 0) {
      accounts[idx] = account;
    } else {
      accounts.unshift(account);
    }
    this.save('accounts', accounts);
  }

  deleteAccount(accountId) {
    let accounts = this.getAccounts();
    accounts = accounts.filter(a => a.id !== accountId);
    this.save('accounts', accounts);
  }

  getCustomRequests() {
    return this.get('custom_requests');
  }

  saveCustomRequest(req) {
    const requests = this.getCustomRequests();
    requests.unshift(req);
    this.save('custom_requests', requests);
  }

  deleteCustomRequest(reqId) {
    let requests = this.getCustomRequests();
    requests = requests.filter(r => r.id !== reqId);
    this.save('custom_requests', requests);
  }

  getOrders() {
    return this.get('orders');
  }

  saveOrder(order) {
    const orders = this.getOrders();
    const index = orders.findIndex(o => o.id === order.id);
    if (index >= 0) {
      orders[index] = order;
    } else {
      orders.unshift(order);
    }
    this.save('orders', orders);
  }

  getUserPurchases(userId) {
    return this.get('user_purchases').filter(p => p.user_id === userId);
  }

  hasPurchasedProduct(userId, productId) {
    return this.get('user_purchases').some(p => p.user_id === userId && p.product_id === productId && p.is_active);
  }

  addPurchase(purchase) {
    const purchases = this.get('user_purchases');
    if (!purchases.some(p => p.user_id === purchase.user_id && p.product_id === purchase.product_id)) {
      purchases.unshift(purchase);
      this.save('user_purchases', purchases);
    }
  }

  getLicenses(userId) {
    if (!userId) return this.get('licenses');
    return this.get('licenses').filter(l => l.user_id === userId);
  }

  addLicense(license) {
    const licenses = this.get('licenses');
    licenses.unshift(license);
    this.save('licenses', licenses);
  }

  updateLicense(license) {
    const licenses = this.get('licenses');
    const idx = licenses.findIndex(l => l.id === license.id);
    if (idx >= 0) {
      licenses[idx] = license;
      this.save('licenses', licenses);
    }
  }

  logDownload(log) {
    const logs = this.get('download_logs');
    logs.unshift(log);
    this.save('download_logs', logs);
  }

  /**
   * ============================================================================
   * SUPABASE CLOUD CONNECTOR (BƯỚC 2: PRODUCTION INTEGRATION)
   * ============================================================================
   */
  setSupabaseConfig(url, anonKey) {
    if (url && anonKey) {
      localStorage.setItem('revit_hub_supabase_url', url);
      localStorage.setItem('revit_hub_supabase_anon_key', anonKey);
      window.SUPABASE_CONFIG = { url, anonKey };
      return true;
    }
    return false;
  }

  getSupabaseConfig() {
    return {
      url: localStorage.getItem('revit_hub_supabase_url') || '',
      anonKey: localStorage.getItem('revit_hub_supabase_anon_key') || ''
    };
  }

  isSupabaseConnected() {
    const cfg = this.getSupabaseConfig();
    return Boolean(cfg.url && cfg.anonKey);
  }

  async fetchFromSupabase(table, query = '') {
    const cfg = this.getSupabaseConfig();
    if (!cfg.url || !cfg.anonKey) return null;

    try {
      const res = await fetch(`${cfg.url}/rest/v1/${table}${query}`, {
        headers: {
          'apikey': cfg.anonKey,
          'Authorization': `Bearer ${cfg.anonKey}`
        }
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('[Supabase Sync] Lỗi kết nối cloud:', e.message);
    }
    return null;
  }

  getBankConfig() {
    const saved = this.get('bank_config');
    if (saved && saved.accountNo) return saved;
    return {
      bankId: '970422', // MB Bank
      bankName: 'Ngân hàng TMCP Quân Đội (MB Bank)',
      accountNo: '0908123456',
      accountName: 'DOAN THANH SON',
      template: 'compact2'
    };
  }

  saveBankConfig(config) {
    this.save('bank_config', config);
    return config;
  }
}

window.dataStore = new DataStore();
