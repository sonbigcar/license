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
   * Đăng nhập người dùng (bắt buộc kiểm tra mật khẩu)
   */
  login(identifier, password = '') {
    const input = (identifier || '').trim().toLowerCase();
    const pass = (password || '').trim();

    if (!input) {
      throw new Error('Vui lòng nhập Email hoặc Tên đăng nhập.');
    }
    if (!pass) {
      throw new Error('Vui lòng nhập Mật khẩu.');
    }

    const accounts = window.dataStore.getAccounts();
    let account = accounts.find(a => 
      a.email.toLowerCase() === input || 
      (a.username && a.username.toLowerCase() === input)
    );

    const isOwnerOrAdmin = 
      input === 'sonbigcar' || 
      input === 'son190799' || 
      input === 'admin@doanson.com' ||
      input === 'admin';

    // Kiểm tra mật khẩu cho tài khoản quản trị
    if (isOwnerOrAdmin) {
      if (pass !== 'Son190799' && (account && account.password && account.password !== pass)) {
        throw new Error('Mật khẩu quản trị viên không chính xác. Vui lòng kiểm tra lại!');
      }
    } else if (account && account.password) {
      if (account.password !== pass) {
        throw new Error('Mật khẩu không chính xác. Vui lòng thử lại!');
      }
    }

    if (!account) {
      account = {
        id: 'acc-' + Date.now().toString(16),
        email: input.includes('@') ? input : `${input}@doanson.com`,
        username: input.includes('@') ? input.split('@')[0] : input,
        password: pass,
        full_name: isOwnerOrAdmin ? 'Đoàn Thanh Sơn (Admin)' : (input.includes('@') ? input.split('@')[0].toUpperCase() : input.toUpperCase()),
        phone: '0908123456',
        company: isOwnerOrAdmin ? 'DoanSon BIM Studio' : 'BIM Engineering Corp',
        role: isOwnerOrAdmin ? 'admin' : 'customer',
        status: 'active',
        created_at: new Date().toISOString()
      };
      window.dataStore.saveAccount(account);
    } else {
      if (isOwnerOrAdmin && account.role !== 'admin') {
        account.role = 'admin';
      }
      if (!account.password) {
        account.password = pass;
      }
      window.dataStore.saveAccount(account);
    }

    if (account.status === 'suspended') {
      throw new Error('Tài khoản này đã bị tạm khóa. Vui lòng liên hệ ban quản trị.');
    }

    this.saveUser(account);
    return account;
  }

  /**
   * Đăng ký tài khoản mới
   */
  register(fullName, email, phone, company, role = 'customer') {
    const accounts = window.dataStore.getAccounts();
    if (accounts.some(a => a.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('Email này đã được đăng ký. Vui lòng đăng nhập.');
    }

    const newAccount = {
      id: 'acc-' + Date.now().toString(16),
      email: email,
      username: email.split('@')[0],
      full_name: fullName,
      phone: phone || '',
      company: company || '',
      role: role,
      status: 'active',
      created_at: new Date().toISOString()
    };

    window.dataStore.saveAccount(newAccount);
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
