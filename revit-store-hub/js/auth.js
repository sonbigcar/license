/**
 * ==============================================================================
 * REVIT BIM STORE - USER AUTH & ACCOUNT MANAGEMENT SERVICE
 * ==============================================================================
 */

class AuthManager {
  constructor() {
    this.STORAGE_KEY = 'revit_hub_current_user';
    this.currentUser = this.loadUser();
    this.subscribers = [];
  }

  loadUser() {
    try {
      const user = localStorage.getItem(this.STORAGE_KEY);
      if (user) return JSON.parse(user);
    } catch (e) {
      console.error('Error reading auth user', e);
    }

    // Mặc định ban đầu chưa đăng nhập để hiển thị nút Đăng Nhập / Đăng Ký trên cùng
    return null;
  }

  saveUser(user) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
      // Đồng bộ vào danh sách accounts
      window.dataStore.saveAccount(user);
    } else {
      localStorage.removeItem(this.STORAGE_KEY);
    }
    this.notifySubscribers();
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isLoggedIn() {
    return !!this.currentUser;
  }

  isAdmin() {
    return this.currentUser && this.currentUser.role === 'admin';
  }

  /**
   * Đăng nhập người dùng (bắt buộc tài khoản đã đăng ký và kiểm tra mật khẩu chính xác)
   */
  async login(identifier, password = '') {
    const input = (identifier || '').trim().toLowerCase();
    const pass = (password || '').trim();

    if (!input) {
      throw new Error('Vui lòng nhập Email hoặc Tên đăng nhập.');
    }
    if (!pass) {
      throw new Error('Vui lòng nhập Mật khẩu.');
    }

    let accounts = window.dataStore.getAccounts();
    let account = accounts.find(a => 
      (a.email && a.email.toLowerCase() === input) || 
      (a.username && a.username.toLowerCase() === input)
    );

    // Nếu trên máy tính mới chưa có tài khoản trong cache, lập tức tải từ GitHub Cloud
    if (!account && window.dataStore && typeof window.dataStore.fetchRemoteAccounts === 'function') {
      try {
        accounts = await window.dataStore.fetchRemoteAccounts();
        account = accounts.find(a => 
          (a.email && a.email.toLowerCase() === input) || 
          (a.username && a.username.toLowerCase() === input)
        );
      } catch (err) {}
    }

    const isOwnerOrAdmin = 
      input === 'sonbigcar' || 
      input === 'son190799' || 
      input === 'admin@doanson.com' ||
      input === 'admin';

    // 1. XỬ LÝ TÀI KHOẢN QUẢN TRỊ VIÊN (ADMIN CHÍNH CHỦ)
    if (isOwnerOrAdmin) {
      const validAdminPass = (pass === 'Son190799' || pass === 'son123456' || (account && account.password && account.password === pass));
      if (!validAdminPass) {
        throw new Error('Mật khẩu quản trị viên không chính xác. Vui lòng kiểm tra lại!');
      }

      // Khởi tạo tài khoản admin nếu chưa có trong DB
      if (!account) {
        account = {
          id: 'acc-admin-01',
          email: 'admin@doanson.com',
          username: 'sonbigcar',
          password: pass,
          full_name: 'Đoàn Thanh Sơn (Admin)',
          phone: '0908123456',
          company: 'DoanSon BIM Studio',
          role: 'admin',
          status: 'active',
          created_at: new Date().toISOString()
        };
        window.dataStore.saveAccount(account);
      } else {
        if (account.role !== 'admin') account.role = 'admin';
        if (!account.password) account.password = pass;
        window.dataStore.saveAccount(account);
      }
    } else {
      // 2. XỬ LÝ TÀI KHOẢN NGƯỜI DÙNG THÔNG THƯỜNG:
      // BẮT BUỘC PHẢI ĐÃ ĐĂNG KÝ TRƯỚC ĐÓ. NẾU CHƯA ĐĂNG KÝ THÌ BÁO LỖI, KHÔNG TỰ TẠO!
      if (!account) {
        throw new Error('Tài khoản chưa được đăng ký trong hệ thống. Vui lòng bấm vào tab "Đăng Ký Mới" bên cạnh để tạo tài khoản!');
      }

      // Kiểm tra trạng thái khóa
      if (account.status === 'suspended') {
        throw new Error('Tài khoản này đã bị tạm khóa. Vui lòng liên hệ ban quản trị.');
      }

      // BẮT BUỘC KIỂM TRA MẬT KHẨU
      if (!account.password || account.password !== pass) {
        throw new Error('Mật khẩu không chính xác. Vui lòng kiểm tra lại!');
      }
    }

    this.saveUser(account);
    return account;
  }

  /**
   * Đăng ký tài khoản mới (bắt buộc có mật khẩu)
   */
  async register(fullName, email, password, phone = '', company = '', role = 'customer') {
    const cleanName = (fullName || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanName) {
      throw new Error('Vui lòng nhập Họ và Tên đầy đủ.');
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Vui lòng nhập địa chỉ Email hợp lệ.');
    }
    if (!cleanPass || cleanPass.length < 6) {
      throw new Error('Mật khẩu phải có độ dài tối thiểu từ 6 ký tự trở lên.');
    }

    const accounts = window.dataStore.getAccounts();
    const emailExists = accounts.some(a => a.email && a.email.toLowerCase() === cleanEmail);
    if (emailExists) {
      throw new Error('Email này đã được đăng ký tài khoản. Vui lòng chuyển sang tab Đăng Nhập!');
    }

    const usernameCandidate = cleanEmail.split('@')[0];
    const usernameExists = accounts.some(a => a.username && a.username.toLowerCase() === usernameCandidate);

    const newAccount = {
      id: 'acc-' + Date.now().toString(16),
      email: cleanEmail,
      username: usernameExists ? `${usernameCandidate}_${Date.now().toString().slice(-4)}` : usernameCandidate,
      password: cleanPass,
      full_name: cleanName,
      phone: (phone || '').trim(),
      company: (company || '').trim() || 'Cá nhân',
      role: role,
      status: 'active',
      created_at: new Date().toISOString()
    };

    await window.dataStore.saveAccount(newAccount);
    this.saveUser(newAccount);
    return newAccount;
  }

  logout() {
    this.saveUser(null);
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    callback(this.currentUser);
  }

  notifySubscribers() {
    this.subscribers.forEach(cb => cb(this.currentUser));
  }
}

window.authManager = new AuthManager();
