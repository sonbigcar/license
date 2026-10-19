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
   * Đăng nhập người dùng
   */
  login(email, password = '') {
    const accounts = window.dataStore.getAccounts();
    let account = accounts.find(a => a.email.toLowerCase() === email.toLowerCase());

    if (!account) {
      // Nếu chưa có tài khoản, tự động tạo mới dạng customer
      account = {
        id: 'acc-' + Date.now().toString(16),
        email: email,
        full_name: email.split('@')[0].toUpperCase(),
        phone: '0901234567',
        company: 'BIM Contractor JSC',
        role: email.includes('admin') ? 'admin' : 'customer',
        status: 'active',
        created_at: new Date().toISOString()
      };
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

  /**
   * Chuyển nhanh giữa Kỹ sư thường và Admin để trải nghiệm
   */
  switchRole(role) {
    if (!this.currentUser) {
      // Đăng nhập demo theo role
      if (role === 'admin') {
        this.login('admin@revitstore.vn');
      } else {
        this.login('engineer.bim@gmail.com');
      }
      return;
    }

    this.currentUser.role = role;
    this.saveUser(this.currentUser);
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
