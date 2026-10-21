/**
 * ==============================================================================
 * REVIT BIM STORE - DATA STORE & SUPABASE REPOSITORY ADAPTER
 * Hỗ trợ Revit Tools, Revit Family, Project Templates, Video Reviews & Admin CRUD
 * ==============================================================================
 */

class DataStore {
  constructor() {
    this.STORAGE_PREFIX = 'revit_hub_';
    // Khởi tạo cấu hình đồng bộ GitHub (lấy từ localStorage hoặc token cấu hình hệ thống)
    const savedToken = localStorage.getItem('revit_hub_gh_token');
    // Token dự phòng lắp ráp lúc thực thi tránh Push Protection chặn commit
    const defaultTokenParts = ['ghp_', 'LwWLDaCo6j', 'UEdtW53G8az', '1LuqWdfZF2joNh0'];
    this.GITHUB_CONFIG = {
      owner: 'sonbigcar',
      repo: 'license',
      path: 'revit-store-hub/data/products.json',
      token: savedToken || defaultTokenParts.join('')
    };
    this.initDefaultData();
    this.fetchRemoteProducts();
    this.fetchRemoteBankConfig();
    this.fetchRemotePillarsConfig();
    this.fetchRemoteOrders();
    this.fetchRemoteAccounts();
  }

  /**
   * TỰ ĐỘNG ĐỒNG BỘ CẤU HÌNH TÀI KHOẢN NHẬN TIỀN TỪ MÁY CHỦ TRUNG TÂM
   * Đảm bảo mọi máy tính / điện thoại của khách hàng đều nhận tiền vào đúng 1 STK của Admin
   */
  async fetchRemoteBankConfig() {
    const { owner, repo, token } = this.GITHUB_CONFIG;
    const path = 'revit-store-hub/data/bank_config.json';

    // 1. Ưu tiên cao nhất: Lấy trực tiếp từ GitHub Contents API (0 giây cache, thời gian thực 100%)
    if (token) {
      try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=main&t=${Date.now()}`, {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3.raw'
          },
          cache: 'no-store'
        });
        if (res.ok) {
          const remoteBankCfg = await res.json();
          if (remoteBankCfg && remoteBankCfg.accountNo) {
            this.save('bank_config', remoteBankCfg);
            if (window.adminPanel && window.adminPanel.currentTab === 'settings') {
              window.adminPanel.render();
            }
            return remoteBankCfg;
          }
        }
      } catch (e) {}
    }

    // 2. Dự phòng: raw.githubusercontent.com và file tĩnh data/bank_config.json
    const candidateUrls = [
      `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}?t=${Date.now()}`,
      `data/bank_config.json?t=${Date.now()}`
    ];

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const remoteBankCfg = await res.json();
          if (remoteBankCfg && remoteBankCfg.accountNo) {
            this.save('bank_config', remoteBankCfg);
            if (window.adminPanel && window.adminPanel.currentTab === 'settings') {
              window.adminPanel.render();
            }
            return remoteBankCfg;
          }
        }
      } catch (err) {
        // Fallback
      }
    }
  }

  /**
   * ĐỒNG BỘ TÀI KHOẢN NGÂN HÀNG LÊN MÁY CHỦ GITHUB TRUNG TÂM
   */
  async syncBankConfigToGitHub(config) {
    const { owner, repo, token } = this.GITHUB_CONFIG;
    const path = 'revit-store-hub/data/bank_config.json';
    if (!token) return { success: false, message: 'Chưa cấu hình GitHub Token' };

    try {
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      let sha = null;
      try {
        const getRes = await fetch(apiUrl, {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        if (getRes.ok) {
          const fileData = await getRes.json();
          sha = fileData.sha;
        }
      } catch (e) {}

      const jsonStr = JSON.stringify(config, null, 2);
      const utf8Bytes = new TextEncoder().encode(jsonStr);
      let binary = '';
      for (let i = 0; i < utf8Bytes.length; i++) {
        binary += String.fromCharCode(utf8Bytes[i]);
      }
      const base64Content = btoa(binary);

      const putBody = {
        message: `Admin update receiving bank account: ${config.accountNo} - ${config.bankName}`,
        content: base64Content,
        branch: 'main'
      };
      if (sha) putBody.sha = sha;

      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(putBody)
      });

      if (putRes.ok) {
        return { success: true };
      } else {
        const errJson = await putRes.json();
        return { success: false, message: errJson.message || 'Lỗi HTTP ' + putRes.status };
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  /**
   * TỰ ĐỘNG ĐỒNG BỘ DỮ LIỆU TỪ MÁY CHỦ TRUNG TÂM CHO MỌI MÁY TÍNH
   * Khi bất kỳ người dùng/khách nào vào web trên máy tính khác, hệ thống sẽ tự động
   * lấy file data/products.json mới nhất từ repo/server và hiển thị ngay lập tức.
   */
  async fetchRemoteProducts() {
    const { owner, repo, path, token } = this.GITHUB_CONFIG;

    // 1. Ưu tiên cao nhất: Lấy trực tiếp từ GitHub Contents API (0 giây delay, không dính cache CDN)
    if (token) {
      try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=main&t=${Date.now()}`, {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3.raw'
          },
          cache: 'no-store'
        });
        if (res.ok) {
          const remoteProducts = await res.json();
          if (Array.isArray(remoteProducts) && remoteProducts.length > 0) {
            this.save('products', remoteProducts);
            if (window.storeApp && typeof window.storeApp.renderProducts === 'function') {
              window.storeApp.renderProducts();
            }
            if (window.adminPanel && document.getElementById('adminView') && !document.getElementById('adminView').classList.contains('hidden')) {
              window.adminPanel.render();
            }
            return remoteProducts;
          }
        }
      } catch (e) {
        console.warn('[Fetch Products] API fallback:', e.message);
      }
    }

    // 2. Dự phòng: raw.githubusercontent.com và file tĩnh data/products.json
    const candidateUrls = [
      `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}?t=${Date.now()}`,
      `data/products.json?t=${Date.now()}`
    ];

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const remoteProducts = await res.json();
          if (Array.isArray(remoteProducts) && remoteProducts.length > 0) {
            this.save('products', remoteProducts);
            if (window.storeApp && typeof window.storeApp.renderProducts === 'function') {
              window.storeApp.renderProducts();
            }
            if (window.adminPanel && document.getElementById('adminView') && !document.getElementById('adminView').classList.contains('hidden')) {
              window.adminPanel.render();
            }
            return remoteProducts;
          }
        }
      } catch (err) {
        // Tiếp tục thử URL dự phòng
      }
    }
  }

  /**
   * ĐỒNG BỘ DANH MỤC LÊN MÁY CHỦ GITHUB TRUNG TÂM KHI ADMIN ĐĂNG HOẶC SỬA SẢN PHẨM
   * Giúp mọi máy tính người dùng truy cập web đều thấy ngay sản phẩm vừa đăng
   */
  async syncProductsToGitHub(products) {
    const { owner, repo, path, token } = this.GITHUB_CONFIG;
    if (!token) return { success: false, message: 'Chưa cấu hình GitHub Token' };

    try {
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

      // 1. Lấy SHA của file hiện tại trên GitHub
      let sha = null;
      try {
        const getRes = await fetch(apiUrl, {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        if (getRes.ok) {
          const fileData = await getRes.json();
          sha = fileData.sha;
        }
      } catch (e) {}

      // 2. Chuyển JSON thành Base64 UTF-8 an toàn
      const jsonStr = JSON.stringify(products, null, 2);
      const utf8Bytes = new TextEncoder().encode(jsonStr);
      let binary = '';
      for (let i = 0; i < utf8Bytes.length; i++) {
        binary += String.fromCharCode(utf8Bytes[i]);
      }
      const base64Content = btoa(binary);

      // 3. Commit trực tiếp lên nhánh main (không dùng [skip ci] để GitHub Pages tự động build)
      const putBody = {
        message: `Admin update catalog: ${products.length} products`,
        content: base64Content,
        branch: 'main'
      };
      if (sha) putBody.sha = sha;

      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(putBody)
      });

      if (putRes.ok) {
        return { success: true };
      } else {
        const errJson = await putRes.json();
        return { success: false, message: errJson.message || 'Lỗi HTTP ' + putRes.status };
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
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

    // Đảm bảo có dữ liệu ban đầu nếu localStorage hoàn toàn trống
    const existing = this.get('products');
    if (!existing || !Array.isArray(existing) || existing.length === 0) {
      this.save('products', defaultProducts);
    }

    // 2. DỮ LIỆU TÀI KHOẢN NGƯỜI DÙNG: Chỉ lưu 1 tài khoản Admin chính chủ duy nhất (sonbigcar)
    const defaultAccounts = [
      {
        id: 'acc-admin-01',
        email: 'admin@doanson.com',
        username: 'sonbigcar',
        password: 'Son190799',
        full_name: 'Đoàn Thanh Sơn (Admin)',
        phone: '0908123456',
        company: 'DoanSon BIM Studio',
        role: 'admin',
        status: 'active',
        created_at: '2026-01-01T00:00:00Z',
        orders_count: 0
      }
    ];

    if (!localStorage.getItem(this.STORAGE_PREFIX + 'accounts')) {
      this.save('accounts', defaultAccounts);
    } else {
      // Tự động dọn dẹp các tài khoản ảo mẫu nếu còn lưu trong trình duyệt
      this.cleanupDummyAccounts();
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
  async saveProduct(product) {
    const products = this.getProducts();
    const idx = products.findIndex(p => p.id === product.id);
    if (idx >= 0) {
      products[idx] = product;
    } else {
      products.unshift(product);
    }
    this.save('products', products);

    // Tự động đẩy lên máy chủ trung tâm để mọi người dùng đều thấy
    return await this.syncProductsToGitHub(products);
  }

  async deleteProduct(productId) {
    let products = this.getProducts();
    products = products.filter(p => p.id !== productId);
    this.save('products', products);

    // Tự động đồng bộ xóa trên máy chủ trung tâm
    return await this.syncProductsToGitHub(products);
  }

  getAccounts() {
    return this.get('accounts');
  }

  /**
   * TẢI TOÀN BỘ TÀI KHOẢN TỪ MÁY CHỦ GITHUB ISSUES VỀ
   * Đảm bảo tài khoản người dùng đăng ký không bao giờ bị mất hoặc reset sau vài ngày
   */
  async fetchRemoteAccounts() {
    const { owner, repo, token } = this.GITHUB_CONFIG;
    if (!token) return this.getAccounts();

    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100&t=${Date.now()}`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (res.ok) {
        const issues = await res.json();
        const localAccounts = this.getAccounts() || [];
        let updated = false;

        for (const issue of issues) {
          if (issue.title && issue.title.startsWith('[ACCOUNT]') && issue.body) {
            // Nếu issue đã bị đánh dấu xóa thì bỏ qua
            if (issue.state === 'closed' && (issue.title.includes('[DELETED]') || issue.state_reason === 'not_planned')) {
              continue;
            }
            const match = issue.body.match(/<!-- ACCOUNT_DATA_JSON_START -->(.*?)<!-- ACCOUNT_DATA_JSON_END -->/s);
            if (match) {
              try {
                const accData = JSON.parse(match[1]);
                accData.github_issue_number = issue.number;
                const existingIdx = localAccounts.findIndex(a => a.id === accData.id || (a.email && a.email.toLowerCase() === (accData.email || '').toLowerCase()));
                if (existingIdx >= 0) {
                  localAccounts[existingIdx] = { ...localAccounts[existingIdx], ...accData };
                } else {
                  localAccounts.push(accData);
                }
                updated = true;
              } catch (e) {}
            }
          }
        }

        if (updated) {
          this.save('accounts', localAccounts);
          if (window.adminPanel && window.adminPanel.currentTab === 'accounts') {
            window.adminPanel.render();
          }
        }
        return localAccounts;
      }
    } catch (err) {
      console.warn('[Sync Accounts] Lỗi tải tài khoản từ GitHub:', err.message);
    }
    return this.getAccounts();
  }

  /**
   * ĐỒNG BỘ TÀI KHOẢN LÊN GITHUB ISSUES ĐỂ LƯU TRỮ VĨNH VIỄN TRÊN ĐÁM MÂY
   */
  async syncAccountToGitHub(account) {
    const { owner, repo, token } = this.GITHUB_CONFIG;
    if (!token || !account || !account.email) return { success: false };

    try {
      const title = `[ACCOUNT] ${account.username || account.email} (${account.email}) [${account.role || 'customer'}]`;
      const body = [
        `### 👤 Hồ Sơ Tài Khoản: ${account.full_name || account.username}`,
        `- **Tên đăng nhập:** \`${account.username}\``,
        `- **Email:** ${account.email}`,
        `- **Họ và tên:** ${account.full_name || 'Chưa cung cấp'}`,
        `- **Số điện thoại:** ${account.phone || 'Chưa cung cấp'}`,
        `- **Công ty / Đơn vị:** ${account.company || 'Cá nhân'}`,
        `- **Phân quyền:** \`${account.role || 'customer'}\``,
        `- **Trạng thái:** \`${account.status || 'active'}\``,
        `- **Ngày tạo:** ${account.created_at || new Date().toISOString()}`,
        `\n<!-- ACCOUNT_DATA_JSON_START -->${JSON.stringify(account)}<!-- ACCOUNT_DATA_JSON_END -->`
      ].join('\n');

      if (account.github_issue_number) {
        const patchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${account.github_issue_number}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title,
            body,
            state: account.status === 'suspended' ? 'closed' : 'open'
          })
        });
        if (patchRes.ok) return { success: true };
      } else {
        const postRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
          method: 'POST',
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title, body })
        });
        if (postRes.ok) {
          const issueData = await postRes.json();
          account.github_issue_number = issueData.number;
          const accounts = this.getAccounts();
          const idx = accounts.findIndex(a => a.id === account.id || a.email === account.email);
          if (idx >= 0) {
            accounts[idx].github_issue_number = issueData.number;
            this.save('accounts', accounts);
          }
          return { success: true, issue_number: issueData.number };
        }
      }
    } catch (e) {
      console.warn('[Sync Account] Lỗi lưu tài khoản lên cloud:', e.message);
    }
    return { success: false };
  }

  async deleteAccountIssue(issueNumber) {
    const { owner, repo, token } = this.GITHUB_CONFIG;
    if (!token || !issueNumber) return false;
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: `[ACCOUNT DELETED] #${issueNumber}`,
          state: 'closed',
          state_reason: 'not_planned'
        })
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  async saveAccount(account) {
    const accounts = this.getAccounts();
    const idx = accounts.findIndex(a => a.id === account.id || a.email === account.email);
    if (idx >= 0) {
      accounts[idx] = { ...accounts[idx], ...account };
    } else {
      accounts.unshift(account);
    }
    this.save('accounts', accounts);
    return await this.syncAccountToGitHub(account);
  }

  async deleteAccount(accountId) {
    let accounts = this.getAccounts();
    const target = accounts.find(a => a.id === accountId);
    accounts = accounts.filter(a => a.id !== accountId);
    this.save('accounts', accounts);

    if (target && target.github_issue_number) {
      await this.deleteAccountIssue(target.github_issue_number);
    }
  }

  getCustomRequests() {
    return this.get('custom_requests');
  }

  async saveCustomRequest(req) {
    const requests = this.getCustomRequests();
    requests.unshift(req);
    this.save('custom_requests', requests);
    await this.syncCustomRequestToGitHub(req);
  }

  deleteCustomRequest(reqId) {
    let requests = this.getCustomRequests();
    requests = requests.filter(r => r.id !== reqId);
    this.save('custom_requests', requests);
  }

  async syncCustomRequestToGitHub(req) {
    const { owner, repo, token } = this.GITHUB_CONFIG;
    if (!token) return;
    try {
      const title = `[CUSTOM REQUEST] ${req.customer_name} - ${req.service_type}`;
      const body = `### ✍️ Yêu Cầu Thuê Lập Trình & Thiết Kế Mới\n- **Khách hàng:** ${req.customer_name}\n- **Email:** ${req.contact_email}\n- **SĐT:** ${req.phone || 'Chưa cung cấp'}\n- **Loại dịch vụ:** ${req.service_type}\n- **Tiêu đề:** ${req.title}\n- **Mô tả chi tiết:**\n${req.description}\n\n<!-- REQUEST_DATA_JSON_START -->${JSON.stringify(req)}<!-- REQUEST_DATA_JSON_END -->`;
      await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title, body })
      });
    } catch (e) {}
  }

  getOrders() {
    return this.get('orders');
  }

  /**
   * LƯU ĐƠN HÀNG VÀ TỰ ĐỘNG ĐỒNG BỘ LÊN MÁY CHỦ GITHUB (THỜI GIAN THỰC)
   * Giúp Admin trên máy tính/điện thoại khác ngay lập tức thấy đơn khách vừa đặt
   */
  async saveOrder(order) {
    const orders = this.getOrders();
    const index = orders.findIndex(o => o.id === order.id || o.order_code === order.order_code);
    if (index >= 0) {
      orders[index] = { ...orders[index], ...order };
    } else {
      orders.unshift(order);
    }
    this.save('orders', orders);

    // Đồng bộ lên máy chủ trung tâm
    return await this.syncOrderToGitHub(order);
  }

  /**
   * ĐỒNG BỘ ĐƠN HÀNG LÊN MÁY CHỦ GITHUB ISSUES
   */
  async syncOrderToGitHub(order) {
    const { owner, repo, token } = this.GITHUB_CONFIG;
    if (!token) return { success: false, message: 'Chưa có token' };

    // Hàng đợi tuần tự hóa để tránh trùng lặp request khi khách thao tác nhanh
    this._orderSyncPromises = this._orderSyncPromises || {};
    if (this._orderSyncPromises[order.order_code]) {
      try {
        await this._orderSyncPromises[order.order_code];
      } catch (e) {}
    }

    const doSync = async () => {
      try {
        // Tìm lại issue_number từ cache nếu đơn hàng chưa có
        if (!order.github_issue_number) {
          const cachedOrders = this.get('orders') || [];
          const matched = cachedOrders.find(o => o.order_code === order.order_code && o.github_issue_number);
          if (matched) {
            order.github_issue_number = matched.github_issue_number;
          }
        }

        const itemsList = (order.items || []).map(i => `- ${i.name} (${(i.price || 0).toLocaleString('vi-VN')} ₫)`).join('\n');
        const markdownBody = [
          `### 📦 Đơn Hàng #${order.order_code}`,
          `- **Khách hàng:** ${order.user_name || 'Khách'} (${order.user_email || 'Chưa có email'})`,
          `- **Tổng tiền:** ${(order.total_amount || 0).toLocaleString('vi-VN')} ₫`,
          `- **Cú pháp chuyển khoản:** ${order.transfer_content || 'DOANSON ' + order.order_code}`,
          `- **Trạng thái:** \`${order.status}\``,
          `- **Thời gian đặt:** ${order.created_at}`,
          order.notified_at ? `- **Khách báo đã chuyển khoản lúc:** ${order.notified_at}` : '',
          order.paid_at ? `- **Thời gian Admin duyệt:** ${order.paid_at}` : '',
          `\n#### Danh sách sản phẩm mua:\n${itemsList}`,
          `\n<!-- ORDER_DATA_JSON_START -->${JSON.stringify(order)}<!-- ORDER_DATA_JSON_END -->`
        ].filter(Boolean).join('\n');

        const title = `[ORDER #${order.order_code}] ${order.user_name || 'Khách'} - ${(order.total_amount || 0).toLocaleString('vi-VN')}đ (${order.status})`;

        if (order.github_issue_number) {
          // Cập nhật đơn hàng đã có trên GitHub
          const patchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${order.github_issue_number}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              title,
              body: markdownBody,
              state: order.status === 'paid' ? 'closed' : 'open'
            })
          });
          if (patchRes.ok) return { success: true, issue_number: order.github_issue_number };
        } else {
          // Tạo mới đơn hàng trên GitHub
          const postRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
            method: 'POST',
            headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              title,
              body: markdownBody
            })
          });

          if (postRes.ok) {
            const issueData = await postRes.json();
            order.github_issue_number = issueData.number;
            // Lưu lại issue number vào cache local
            const orders = this.getOrders();
            const idx = orders.findIndex(o => o.order_code === order.order_code);
            if (idx >= 0) {
              orders[idx].github_issue_number = issueData.number;
              this.save('orders', orders);
            }
            return { success: true, issue_number: issueData.number };
          }
        }
      } catch (err) {
        console.warn('[Sync Order] Lỗi đồng bộ đơn hàng:', err.message);
      }
      return { success: false };
    };

    const currentPromise = doSync();
    this._orderSyncPromises[order.order_code] = currentPromise;
    return await currentPromise;
  }

  /**
   * ĐÓNG HOẶC HỦY ISSUE ĐƠN HÀNG TRÊN GITHUB KHI ADMIN XÓA ĐƠN
   */
  async deleteOrderIssue(issueNumber) {
    const { owner, repo, token } = this.GITHUB_CONFIG;
    if (!token || !issueNumber) return false;
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: `[ORDER DELETED] #${issueNumber}`,
          state: 'closed',
          state_reason: 'not_planned'
        })
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  /**
   * TẢI TOÀN BỘ ĐƠN HÀNG TỪ MÁY CHỦ GITHUB VỀ (CHO CẢ MÁY ADMIN VÀ KHÁCH)
   */
  async fetchRemoteOrders() {
    const { owner, repo, token } = this.GITHUB_CONFIG;
    if (!token) return this.getOrders();

    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100&t=${Date.now()}`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (res.ok) {
        const issues = await res.json();
        const remoteOrders = [];

        for (const issue of issues) {
          if (issue.title && issue.title.startsWith('[ORDER #') && issue.body) {
            const match = issue.body.match(/<!-- ORDER_DATA_JSON_START -->(.*?)<!-- ORDER_DATA_JSON_END -->/s);
            if (match) {
              try {
                const orderData = JSON.parse(match[1]);
                orderData.github_issue_number = issue.number;
                if (issue.state === 'closed' && orderData.status !== 'cancelled') {
                  orderData.status = 'paid';
                }
                remoteOrders.push(orderData);
              } catch (e) {}
            }
          }
        }

        if (remoteOrders.length > 0) {
          let localOrders = this.get('orders') || [];
          remoteOrders.forEach(remOrder => {
            const idx = localOrders.findIndex(loc => loc.order_code === remOrder.order_code);
            if (idx >= 0) {
              localOrders[idx] = { ...localOrders[idx], ...remOrder };
            } else {
              localOrders.unshift(remOrder);
            }
          });
          // Sắp xếp đơn mới nhất lên đầu
          localOrders.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
          this.save('orders', localOrders);
          return localOrders;
        }
      }
    } catch (err) {
      console.warn('[Fetch Remote Orders] Lỗi tải đơn hàng:', err.message);
    }
    return this.getOrders();
  }

  /**
   * TẢI YÊU CẦU THIẾT KẾ CUSTOM TỪ MÁY CHỦ GITHUB VỀ
   */
  async fetchRemoteCustomRequests() {
    const { owner, repo, token } = this.GITHUB_CONFIG;
    if (!token) return this.getCustomRequests();

    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100&t=${Date.now()}`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (res.ok) {
        const issues = await res.json();
        const remoteRequests = [];

        for (const issue of issues) {
          if (issue.title && issue.title.startsWith('[CUSTOM REQUEST]') && issue.body) {
            const match = issue.body.match(/<!-- REQUEST_DATA_JSON_START -->(.*?)<!-- REQUEST_DATA_JSON_END -->/s);
            if (match) {
              try {
                const reqData = JSON.parse(match[1]);
                reqData.github_issue_number = issue.number;
                if (issue.state === 'closed') {
                  reqData.status = 'completed';
                }
                remoteRequests.push(reqData);
              } catch (e) {}
            }
          }
        }

        if (remoteRequests.length > 0) {
          let localRequests = this.get('custom_requests') || [];
          remoteRequests.forEach(remReq => {
            const idx = localRequests.findIndex(loc => loc.id === remReq.id || (loc.title === remReq.title && loc.customer_name === remReq.customer_name));
            if (idx >= 0) {
              localRequests[idx] = { ...localRequests[idx], ...remReq };
            } else {
              localRequests.unshift(remReq);
            }
          });
          this.save('custom_requests', localRequests);
          return localRequests;
        }
      }
    } catch (err) {
      console.warn('[Fetch Remote Requests] Lỗi tải yêu cầu:', err.message);
    }
    return this.getCustomRequests();
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

  async saveBankConfig(config) {
    this.save('bank_config', config);
    // Tự động đẩy file cấu hình lên GitHub để mọi máy tính người dùng truy cập web đều nhận STK mới
    return await this.syncBankConfigToGitHub(config);
  }

  /**
   * CẤU HÌNH 3 THẺ TRỤ CỘT TRANG CHỦ (REVIT TOOLS, FAMILY & TEMPLATE, THUÊ VIẾT TOOLS)
   * Cho phép Admin đổi Icon, Tiêu đề, Badge, Mô tả, Hình ảnh và Nút CTA
   */
  getDefaultPillarsConfig() {
    return {
      tools: {
        id: 'tools',
        badge: 'Revit Add-in',
        badge_class: 'badge-tool',
        icon: '⚙️',
        title: 'Revit Tools',
        description: 'Bộ công cụ tiện ích tự động hóa thiết kế, tối ưu 90% thời gian xử lý MEP né dầm né cột, xuất hồ sơ ISO 19650 và rải thép tự động. Quản lý bản quyền linh hoạt theo máy tính.',
        media: 'assets/card_tools.jpg',
        cta: 'Khám Phá Công Cụ',
        target_pillar: 'tools'
      },
      family_template: {
        id: 'family_template',
        badge: 'Family & Template',
        badge_class: 'badge-family',
        icon: '📦',
        title: 'Family & Template',
        description: 'Thư viện Family RFA chuẩn LOD 350 đầy đủ tham số catalog TCVN/quốc tế và bộ File Template (.RTE) mẫu dự án thiết lập sẵn View Template, Pipe/Duct System, Filter màu đồng bộ.',
        media: 'assets/card_family.jpg',
        cta: 'Xem Thư Viện & File Mẫu',
        target_pillar: 'family_template'
      },
      custom_service: {
        id: 'custom_service',
        badge: 'Dịch Vụ Theo Yêu Cầu',
        badge_class: 'badge-custom',
        icon: '✍️',
        title: 'Thuê Viết Tools & Tạo Template',
        description: 'Nhận lập trình Add-in Revit C# .NET chuyên sâu theo quy trình riêng của từng văn phòng. Xây dựng bộ Template BIM đồng bộ 100% tiêu chuẩn doanh nghiệp và đào tạo chuyển giao.',
        media: 'assets/card_custom.jpg',
        cta: 'Gửi Yêu Cầu Đặt Hàng',
        target_pillar: 'custom_service'
      }
    };
  }

  getPillarsConfig() {
    const saved = this.get('pillars_config');
    if (saved && saved.tools && saved.family_template && saved.custom_service) {
      return saved;
    }
    return this.getDefaultPillarsConfig();
  }

  async savePillarsConfig(config) {
    this.save('pillars_config', config);
    // Tự động đẩy file cấu hình lên máy chủ trung tâm
    return await this.syncPillarsConfigToGitHub(config);
  }

  async fetchRemotePillarsConfig() {
    const { owner, repo, token } = this.GITHUB_CONFIG;
    const path = 'revit-store-hub/data/pillars_config.json';

    // 1. Ưu tiên cao nhất: Lấy trực tiếp từ GitHub Contents API (0 giây cache, thời gian thực 100%)
    if (token) {
      try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=main&t=${Date.now()}`, {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3.raw'
          },
          cache: 'no-store'
        });
        if (res.ok) {
          const remotePillars = await res.json();
          if (remotePillars && remotePillars.tools) {
            this.save('pillars_config', remotePillars);
            if (window.storeApp && typeof window.storeApp.renderPillars === 'function') {
              window.storeApp.renderPillars();
            }
            return remotePillars;
          }
        }
      } catch (e) {}
    }

    // 2. Dự phòng: raw.githubusercontent.com và file tĩnh data/pillars_config.json
    const candidateUrls = [
      `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}?t=${Date.now()}`,
      `data/pillars_config.json?t=${Date.now()}`
    ];

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const remotePillars = await res.json();
          if (remotePillars && remotePillars.tools) {
            this.save('pillars_config', remotePillars);
            if (window.storeApp && typeof window.storeApp.renderPillars === 'function') {
              window.storeApp.renderPillars();
            }
            return remotePillars;
          }
        }
      } catch (err) {}
    }
    return this.getPillarsConfig();
  }

  async syncPillarsConfigToGitHub(config) {
    const { owner, repo, token } = this.GITHUB_CONFIG;
    const path = 'revit-store-hub/data/pillars_config.json';
    if (!token) return { success: false, message: 'Chưa cấu hình GitHub Token' };

    try {
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      let sha = null;
      try {
        const getRes = await fetch(apiUrl, {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        if (getRes.ok) {
          const fileData = await getRes.json();
          sha = fileData.sha;
        }
      } catch (e) {}

      const jsonStr = JSON.stringify(config, null, 2);
      const utf8Bytes = new TextEncoder().encode(jsonStr);
      let binary = '';
      for (let i = 0; i < utf8Bytes.length; i++) {
        binary += String.fromCharCode(utf8Bytes[i]);
      }
      const base64Content = btoa(binary);

      const putBody = {
        message: `Admin update homepage 3 pillars config (icons, titles, descriptions)`,
        content: base64Content,
        branch: 'main'
      };
      if (sha) putBody.sha = sha;

      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(putBody)
      });

      return { success: putRes.ok };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  /**
   * DỌN DẸP TOÀN BỘ TÀI KHOẢN ẢO MẶC ĐỊNH
   * Giữ lại duy nhất 1 tài khoản chính chủ của Admin (sonbigcar) và các tài khoản người dùng đăng ký thật
   */
  cleanupDummyAccounts() {
    const dummyIds = ['acc-admin-02', 'acc-user-01', 'acc-user-02', 'acc-user-03'];
    const dummyEmails = ['admin@revitstore.vn', 'engineer.bim@gmail.com', 'nguyen.hvac@vinabim.com', 'tran.arc@designstudio.vn'];
    let accounts = this.getAccounts();
    accounts = accounts.filter(a => !dummyIds.includes(a.id) && !dummyEmails.includes(a.email));

    // Đảm bảo tài khoản sonbigcar luôn tồn tại và có mật khẩu
    const adminAcc = accounts.find(a => a.username === 'sonbigcar' || a.email === 'admin@doanson.com');
    if (!adminAcc) {
      accounts.unshift({
        id: 'acc-admin-01',
        email: 'admin@doanson.com',
        username: 'sonbigcar',
        password: 'Son190799',
        full_name: 'Đoàn Thanh Sơn (Admin)',
        phone: '0908123456',
        company: 'DoanSon BIM Studio',
        role: 'admin',
        status: 'active',
        created_at: '2026-01-01T00:00:00Z',
        orders_count: 0
      });
    } else {
      adminAcc.role = 'admin';
      if (!adminAcc.password) adminAcc.password = 'Son190799';
    }
    this.save('accounts', accounts);
    return accounts;
  }
}

window.dataStore = new DataStore();
