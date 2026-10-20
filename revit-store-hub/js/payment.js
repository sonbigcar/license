/**
 * ==============================================================================
 * DOANSON BIM STUDIO - VIETQR & NAPAS 24/7 PAYMENT GATEWAY INTEGRATION
 * Tích hợp thanh toán quét mã QR tự động & kích hoạt giấy phép tức thì
 * ==============================================================================
 */

class PaymentGateway {
  constructor() {
    this.activePollingInterval = null;
    this.currentOrder = null;
  }

  /**
   * Lấy cấu hình tài khoản thụ hưởng từ DataStore
   */
  getBankConfig() {
    if (window.dataStore && typeof window.dataStore.getBankConfig === 'function') {
      return window.dataStore.getBankConfig();
    }
    return {
      bankId: '970422', // MB Bank
      bankName: 'Ngân hàng TMCP Quân Đội (MB Bank)',
      accountNo: '0908123456',
      accountName: 'DOAN THANH SON',
      template: 'compact2'
    };
  }

  /**
   * Cập nhật cấu hình tài khoản thụ hưởng
   */
  updateBankConfig(newConfig) {
    if (window.dataStore && typeof window.dataStore.saveBankConfig === 'function') {
      return window.dataStore.saveBankConfig(newConfig);
    }
    return newConfig;
  }

  /**
   * Tạo đơn hàng mới với mã giao dịch duy nhất
   */
  createOrder(cartItems, user, notes = '') {
    if (!user) {
      throw new Error('Vui lòng đăng nhập để tiến hành thanh toán.');
    }
    if (!cartItems || cartItems.length === 0) {
      throw new Error('Giỏ hàng trống.');
    }

    // Tạo mã order integer 6 chữ số duy nhất cho VietQR Napas
    const orderCode = Math.floor(100000 + Math.random() * 900000);
    const totalAmount = cartItems.reduce((sum, item) => sum + (item.sale_price || item.price), 0);

    const newOrder = {
      id: 'ord-' + Date.now().toString(16),
      order_code: orderCode,
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name,
      items: cartItems.map(item => ({
        product_id: item.id,
        name: item.name,
        product_type: item.product_type,
        price: item.sale_price || item.price,
        billing_cycle: item.billing_cycle || 'one_time',
        metadata: item.metadata
      })),
      total_amount: totalAmount,
      status: 'pending', // 'pending' | 'paid' | 'cancelled'
      payment_provider: 'vietqr_napas',
      transfer_content: `DOANSON ${orderCode}`,
      notes: notes,
      created_at: new Date().toISOString(),
      paid_at: null
    };

    window.dataStore.saveOrder(newOrder);
    this.currentOrder = newOrder;
    return newOrder;
  }

  /**
   * Tạo URL ảnh VietQR chuẩn Napas 24/7 với số tiền và nội dung chuyển khoản bắt buộc
   */
  getVietQrImageUrl(order) {
    const cfg = this.getBankConfig();
    const amount = order.total_amount;
    const memo = encodeURIComponent(order.transfer_content);
    return `https://img.vietqr.io/image/${cfg.bankId}-${cfg.accountNo}-${cfg.template || 'compact2'}.png?amount=${amount}&addInfo=${memo}&accountName=${encodeURIComponent(cfg.accountName)}`;
  }

  /**
   * Lắng nghe trạng thái thanh toán từ DataStore / Webhook
   */
  startPaymentPolling(orderCode, onStatusChange) {
    this.stopPaymentPolling();

    this.activePollingInterval = setInterval(() => {
      const orders = window.dataStore.getOrders();
      const updatedOrder = orders.find(o => o.order_code === orderCode);

      if (updatedOrder) {
        onStatusChange(updatedOrder.status, updatedOrder);
        if (updatedOrder.status === 'paid' || updatedOrder.status === 'cancelled') {
          this.stopPaymentPolling();
        }
      }
    }, 2000);
  }

  stopPaymentPolling() {
    if (this.activePollingInterval) {
      clearInterval(this.activePollingInterval);
      this.activePollingInterval = null;
    }
  }

  /**
   * Tự động kích hoạt quyền tải Family/Template và cấp License Key cho Revit Tools
   */
  fulfillOrder(order) {
    if (!order) return null;

    order.status = 'paid';
    order.paid_at = new Date().toISOString();
    order.payment_reference = order.payment_reference || `NAPAS-${order.order_code}-${Date.now().toString(36).toUpperCase()}`;
    window.dataStore.saveOrder(order);

    const generatedKeys = [];

    // Kích hoạt từng sản phẩm trong đơn hàng
    order.items.forEach(item => {
      if (item.product_type === 'family' || item.product_type === 'template') {
        // Cấp quyền tải Family & Template vào Thư Viện Của Tôi
        window.dataStore.addPurchase({
          id: 'pur-' + Date.now().toString(16) + Math.random().toString(16).substring(2, 6),
          user_id: order.user_id,
          product_id: item.product_id,
          order_id: order.id,
          purchase_date: new Date().toISOString(),
          is_active: true
        });
      } else if (item.product_type === 'tool') {
        // Cấp giấy phép bản quyền Revit Add-in vào Bản Quyền Của Tôi
        const licenseKey = window.licenseManager.generateLicenseKey();
        const expiryDate = new Date();
        if (item.billing_cycle === 'monthly') {
          expiryDate.setMonth(expiryDate.getMonth() + 1);
        } else if (item.billing_cycle === 'lifetime' || item.billing_cycle === 'one_time') {
          expiryDate.setFullYear(expiryDate.getFullYear() + 50); // Vĩnh viễn
        } else {
          expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 Năm
        }

        const newLicense = {
          id: 'lic-' + Date.now().toString(16) + Math.random().toString(16).substring(2, 5),
          license_key: licenseKey,
          user_id: order.user_id,
          user_name: order.user_name,
          user_email: order.user_email,
          product_id: item.product_id,
          order_id: order.id,
          product_name: item.name,
          subscription_type: item.billing_cycle || 'yearly',
          max_machines: 2, // Gói 2 máy trạm
          status: 'active',
          start_date: new Date().toISOString(),
          expiry_date: expiryDate.toISOString(),
          activations: []
        };

        window.dataStore.addLicense(newLicense);
        generatedKeys.push({ name: item.name, key: licenseKey });
      }
    });

    console.log(`[PaymentGateway] Đã xác nhận đơn #${order.order_code} thành công và cấp quyền hoàn tất.`);
    return { order, generatedKeys };
  }

  /**
   * Khách hàng bấm xác nhận "Tôi đã chuyển khoản thành công"
   */
  async confirmPaymentByCustomer(orderCode) {
    const orders = window.dataStore.getOrders();
    const order = orders.find(o => o.order_code === Number(orderCode));

    if (!order) {
      throw new Error(`Không tìm thấy đơn hàng mã #${orderCode}`);
    }

    if (order.status === 'paid') {
      return { success: true, message: 'Đơn hàng này đã được xác nhận thanh toán trước đó.', order };
    }

    const result = this.fulfillOrder(order);
    return {
      success: true,
      message: 'Xác nhận thanh toán thành công!',
      order: result.order,
      generatedKeys: result.generatedKeys
    };
  }

  /**
   * SERVER-SIDE WEBHOOK PROCESSOR (Hỗ trợ PayOS / Napas Gateway)
   */
  processWebhook(payload, signature) {
    if (!payload || !payload.orderCode) {
      return { success: false, message: 'Dữ liệu webhook không hợp lệ' };
    }

    const orderCode = Number(payload.orderCode);
    const amount = Number(payload.amount);
    const orders = window.dataStore.getOrders();
    const order = orders.find(o => o.order_code === orderCode);

    if (!order) {
      return { success: false, message: `Không tìm thấy đơn hàng mã #${orderCode}` };
    }

    if (order.status === 'paid') {
      return { success: true, message: 'Đơn hàng này đã được thanh toán trước đó' };
    }

    if (amount && amount < order.total_amount) {
      return { success: false, message: 'Số tiền chuyển khoản không khớp với giá trị đơn hàng' };
    }

    order.payment_reference = payload.reference || 'WEBHOOK-' + Date.now();
    const result = this.fulfillOrder(order);
    return { success: true, message: 'Xác thực thanh toán và cấp quyền thành công', order: result.order };
  }
}

window.paymentGateway = new PaymentGateway();
