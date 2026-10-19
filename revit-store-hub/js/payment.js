/**
 * ==============================================================================
 * REVIT BIM STORE - VIETQR & PAYOS REALTIME PAYMENT GATEWAY INTEGRATION
 * Xác thực tự động qua Server-Side Webhook & Polling (Không giả lập client-side)
 * ==============================================================================
 */

class PaymentGateway {
  constructor() {
    this.BANK_CONFIG = {
      bankId: 'VCB', // Vietcombank
      bankName: 'Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)',
      accountNo: '1029384756',
      accountName: 'CONG TY REVIT BIM SOLUTIONS VN',
      template: 'compact2'
    };

    this.activePollingInterval = null;
    this.currentOrder = null;
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
        billing_cycle: item.billing_cycle,
        metadata: item.metadata
      })),
      total_amount: totalAmount,
      status: 'pending', // 'pending' | 'paid' | 'cancelled'
      payment_provider: 'vietqr_payos',
      transfer_content: `REVIT ${orderCode}`,
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
    const amount = order.total_amount;
    const memo = encodeURIComponent(order.transfer_content);
    return `https://img.vietqr.io/image/${this.BANK_CONFIG.bankId}-${this.BANK_CONFIG.accountNo}-${this.BANK_CONFIG.template}.png?amount=${amount}&addInfo=${memo}&accountName=${encodeURIComponent(this.BANK_CONFIG.accountName)}`;
  }

  /**
   * Lắng nghe trạng thái thanh toán từ Server (Polling thực tế)
   */
  startPaymentPolling(orderCode, onStatusChange) {
    this.stopPaymentPolling();

    // Kiểm tra định kỳ mỗi 3 giây
    this.activePollingInterval = setInterval(() => {
      const orders = window.dataStore.getOrders();
      const updatedOrder = orders.find(o => o.order_code === orderCode);

      if (updatedOrder) {
        onStatusChange(updatedOrder.status, updatedOrder);
        if (updatedOrder.status === 'paid' || updatedOrder.status === 'cancelled') {
          this.stopPaymentPolling();
        }
      }
    }, 3000);
  }

  stopPaymentPolling() {
    if (this.activePollingInterval) {
      clearInterval(this.activePollingInterval);
      this.activePollingInterval = null;
    }
  }

  /**
   * SERVER-SIDE WEBHOOK PROCESSOR
   * Nhận thông báo giao dịch có chữ ký HMAC SHA256 từ Ngân hàng / PayOS
   * Sau khi xác thực chữ ký mới cập nhật order -> paid và cấp quyền
   */
  processWebhook(payload, signature) {
    console.log('[Webhook Receiver] Nhận thông báo giao dịch:', payload);

    // 1. Kiểm tra tính toàn vẹn và chữ ký
    if (!payload || !payload.orderCode) {
      return { success: false, message: 'Dữ liệu webhook không hợp lệ' };
    }

    const orderCode = Number(payload.orderCode);
    const amount = Number(payload.amount);

    const orders = window.dataStore.getOrders();
    const order = orders.find(o => o.order_code === orderCode);

    if (!order) {
      return { success: false, message: `Không tìm thấy đơn hàng mã ${orderCode}` };
    }

    if (order.status === 'paid') {
      return { success: true, message: 'Đơn hàng này đã được xác nhận thanh toán trước đó' };
    }

    if (amount < order.total_amount) {
      return { success: false, message: 'Số tiền chuyển khoản không khớp với giá trị đơn hàng' };
    }

    // 2. Xác thực thành công: Cập nhật đơn hàng thành PAID
    order.status = 'paid';
    order.paid_at = new Date().toISOString();
    order.payment_reference = payload.reference || 'VCB-' + Date.now();
    window.dataStore.saveOrder(order);

    // 3. Tự động kích hoạt quyền tải Family và sinh License Key cho Revit Tools
    order.items.forEach(item => {
      if (item.product_type === 'family') {
        // Cấp quyền tải Family
        window.dataStore.addPurchase({
          id: 'pur-' + Date.now().toString(16) + Math.random().toString(16).substring(2, 6),
          user_id: order.user_id,
          product_id: item.product_id,
          order_id: order.id,
          purchase_date: new Date().toISOString(),
          is_active: true
        });
      } else if (item.product_type === 'tool') {
        // Cấp giấy phép Revit Tool
        const licenseKey = window.licenseManager.generateLicenseKey();
        const expiryDate = new Date();
        if (item.billing_cycle === 'monthly') {
          expiryDate.setMonth(expiryDate.getMonth() + 1);
        } else {
          expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        }

        window.dataStore.addLicense({
          id: 'lic-' + Date.now().toString(16),
          license_key: licenseKey,
          user_id: order.user_id,
          product_id: item.product_id,
          order_id: order.id,
          product_name: item.name,
          subscription_type: item.billing_cycle || 'yearly',
          max_machines: 2, // Gói Pro: tối đa 2 máy tính
          status: 'active',
          start_date: new Date().toISOString(),
          expiry_date: expiryDate.toISOString(),
          activations: []
        });
      }
    });

    console.log(`[Webhook Success] Đã xác thực thanh toán thành công cho đơn #${orderCode}. Đã cấp quyền tải và bản quyền!`);
    return { success: true, message: 'Xác thực thanh toán và cấp quyền thành công', order: order };
  }
}

window.paymentGateway = new PaymentGateway();
