/**
 * ==============================================================================
 * REVIT BIM STORE - SECURE DOWNLOAD CONTROLLER & SIGNED URL SERVICE
 * Bảo vệ file RFA/EXE/ZIP trong Private Storage (Không lộ đường dẫn công khai)
 * ==============================================================================
 */

class SecureDownloadManager {
  constructor() {
    this.DEFAULT_TTL_MINUTES = 15; // Link hết hạn sau 15 phút
  }

  /**
   * Yêu cầu cấp liên kết tải xuống bảo mật có thời hạn
   */
  requestDownloadUrl(productId, user) {
    if (!user) {
      throw new Error('Vui lòng đăng nhập để tải sản phẩm.');
    }

    const product = window.dataStore.getProductById(productId);
    if (!product) {
      throw new Error('Không tìm thấy sản phẩm.');
    }

    // Kiểm tra quyền mua hợp lệ
    const hasAccess = window.dataStore.hasPurchasedProduct(user.id, productId) || user.role === 'admin';
    if (!hasAccess) {
      throw new Error('Bạn chưa có quyền sở hữu sản phẩm này. Vui lòng hoàn tất thanh toán trước khi tải.');
    }

    // Tạo token chữ ký bảo mật mô phỏng cơ chế Cloudflare R2 / S3 Presigned URL
    const expiresAt = new Date(Date.now() + this.DEFAULT_TTL_MINUTES * 60 * 1000);
    const signatureToken = this.generateToken(product.id, user.id, expiresAt.getTime());

    // Đường dẫn bảo mật có thời hạn
    const signedUrl = `https://vault.revitstore.vn/secure-download/${product.metadata.file_name}?token=${signatureToken}&exp=${expiresAt.getTime()}`;

    // Ghi nhật ký tải vào download_logs
    window.dataStore.logDownload({
      id: 'log-' + Date.now().toString(16),
      user_id: user.id,
      product_id: product.id,
      product_name: product.name,
      file_name: product.metadata.file_name,
      ip_address: '118.70.182.45', // Mô phỏng IP client
      user_agent: navigator.userAgent,
      downloaded_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString()
    });

    return {
      fileName: product.metadata.file_name,
      fileSize: product.metadata.file_size,
      signedUrl: signedUrl,
      expiresAt: expiresAt,
      ttlMinutes: this.DEFAULT_TTL_MINUTES
    };
  }

  /**
   * Tạo HMAC Signature token cho Signed URL
   */
  generateToken(productId, userId, exp) {
    const raw = `${productId}|${userId}|${exp}|REVIT_VAULT_SECRET_2026`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
  }
}

window.downloadManager = new SecureDownloadManager();
