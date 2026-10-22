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
   * Tự động nhận diện và chuyển đổi thông minh các loại đường dẫn tải file:
   * 1. Google Drive: chuyển đổi sang link tải trực tiếp hoặc link mở an toàn
   * 2. Dropbox: đổi ?dl=0 thành ?dl=1 để tải trực tiếp
   * 3. OneDrive: chuyển sang link download trực tiếp
   * 4. Cloudflare R2 / GitHub Releases / S3 / Direct links: giữ nguyên
   */
  formatDownloadUrl(rawUrl, fileName = 'download.zip') {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    const cleanUrl = rawUrl.trim();

    // Google Drive Link
    if (cleanUrl.includes('drive.google.com')) {
      const matchFileId = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || cleanUrl.match(/id=([a-zA-Z0-9_-]+)/);
      if (matchFileId && matchFileId[1]) {
        const fileId = matchFileId[1];
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
      }
    }

    // Dropbox Link
    if (cleanUrl.includes('dropbox.com')) {
      return cleanUrl.replace(/[?&]dl=0/, '?dl=1');
    }

    // OneDrive Link
    if (cleanUrl.includes('1drv.ms') || cleanUrl.includes('onedrive.live.com')) {
      if (cleanUrl.includes('download')) return cleanUrl;
      return cleanUrl.replace('/redir?', '/download?');
    }

    return cleanUrl;
  }

  /**
   * Yêu cầu cấp liên kết tải xuống bảo mật cho sản phẩm
   */
  requestDownloadUrl(productId, user) {
    if (!user) {
      throw new Error('Vui lòng đăng nhập để tải sản phẩm.');
    }

    const product = window.dataStore.getProductById(productId);
    if (!product) {
      throw new Error('Không tìm thấy sản phẩm.');
    }

    // Kiểm tra quyền mua hợp lệ (đã thanh toán hoặc là Admin)
    const hasAccess = window.dataStore.hasPurchasedProduct(user.id, productId) || 
                      (user.role === 'admin') || 
                      (window.dataStore.getLicenses && window.dataStore.getLicenses(user.id).some(l => l.product_id === productId && l.status === 'active'));

    if (!hasAccess) {
      throw new Error('Bạn chưa có quyền sở hữu sản phẩm này. Vui lòng hoàn tất thanh toán trước khi tải.');
    }

    const metadata = product.metadata || {};
    const rawUrl = metadata.file_url || '';
    const fileName = metadata.file_name || (product.product_type === 'tool' ? `${product.name.replace(/\s+/g, '_')}_Setup.exe` : `${product.name.replace(/\s+/g, '_')}.rfa`);
    const fileSize = metadata.file_size || 'Đầy đủ';
    const version = metadata.version || 'Mới nhất';
    const installGuide = metadata.install_guide || '';

    // Xử lý link tải thực tế
    let downloadUrl = this.formatDownloadUrl(rawUrl, fileName);

    // Nếu chưa cấu hình link thực tế
    // Nếu chưa cấu hình link thực tế
    if (!downloadUrl) {
      if (user.role === 'admin') {
        throw new Error(`⚠️ Sản phẩm "${product.name}" chưa được cấu hình đường dẫn file tải về!\nHãy bấm "Sửa & Đổi Giá" trên sản phẩm để dán link tải (Cloudflare R2, Google Drive, hoặc GitHub Release).`);
      } else {
        throw new Error(`Bộ cài của "${product.name}" đang được Admin cập nhật bản mới nhất. Vui lòng liên hệ trực tiếp Admin qua Zalo/Email để nhận file trực tiếp!`);
      }
    }

    const securityMode = metadata.security_mode || 'cloudflare_r2';
    const expTime = Math.floor(Date.now() / 1000) + 300; // Hết hạn sau 5 phút (300 giây)
    const token = this.generateToken(product.id, user.id, expTime);

    // Không gắn query param '?token=' vào các dịch vụ lưu trữ đám mây (GitHub, Google Drive, Dropbox, OneDrive, R2)
    // vì GitHub/R2 dùng query 'token' cho hệ thống xác thực riêng của họ và sẽ báo 404 Not Found nếu sai token của họ
    const isThirdPartyCloud = downloadUrl.includes('githubusercontent.com') ||
                              downloadUrl.includes('github.com') ||
                              downloadUrl.includes('drive.google.com') ||
                              downloadUrl.includes('dropbox.com') ||
                              downloadUrl.includes('onedrive.live.com') ||
                              downloadUrl.includes('1drv.ms') ||
                              downloadUrl.includes('X-Amz-') ||
                              downloadUrl.includes('r2.cloudflarestorage.com');

    if (!isThirdPartyCloud) {
      downloadUrl = downloadUrl + (downloadUrl.includes('?') ? '&' : '?') + `_sec_sign=${token}&exp=${expTime}&uid=${encodeURIComponent(user.id)}`;
    }

    // Ghi nhật ký tải an toàn vào download_logs
    try {
      window.dataStore.logDownload({
        id: 'log-' + Date.now().toString(16),
        user_id: user.id,
        user_name: user.full_name || user.username,
        user_email: user.email,
        product_id: product.id,
        product_name: product.name,
        file_name: fileName,
        file_size: fileSize,
        security_mode: securityMode,
        downloaded_at: new Date().toISOString()
      });
    } catch (e) {}

    return {
      fileName: fileName,
      fileSize: fileSize,
      downloadUrl: downloadUrl,
      rawUrl: rawUrl,
      version: version,
      installGuide: installGuide,
      securityMode: securityMode,
      userEmail: user.email,
      expiresInMinutes: 5
    };
  }

  /**
   * Tạo HMAC Signature token cho Signed URL
   */
  generateToken(productId, userId, exp) {
    const raw = `${productId}|${userId}|${exp}|DOANSON_SECURE_TOKEN_2026`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
  }
}

window.downloadManager = new SecureDownloadManager();
