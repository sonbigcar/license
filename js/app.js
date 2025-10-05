// Registration Web App - Main JavaScript File
class RegistrationApp {
    constructor() {
        this.registrations = JSON.parse(localStorage.getItem('licenseRegistrations') || '[]');
        this.machineId = this.generateMachineId();
        
        this.initializeApp();
    }

    initializeApp() {
        this.setupEventListeners();
        this.displaySystemInfo();
        this.displayMachineId();
    }

    setupEventListeners() {
        // Form submission
        const form = document.getElementById('licenseForm');
        form.addEventListener('submit', (e) => this.handleFormSubmit(e));

        // Validate button
        const validateBtn = document.getElementById('validateBtn');
        validateBtn.addEventListener('click', () => this.previewRegistration());

        // Generate Machine ID button
        const generateBtn = document.getElementById('generateMachineId');
        generateBtn.addEventListener('click', () => this.regenerateMachineId());

        // Real-time validation
        const phoneInput = document.getElementById('phone');
        phoneInput.addEventListener('input', () => this.validatePhoneFormat());
        
        // Email validation
        const emailInput = document.getElementById('email');
        emailInput.addEventListener('blur', () => this.validateEmail());
        
        // Update transfer content when phone changes
        phoneInput.addEventListener('input', () => this.updateTransferContent());
    }

    generateMachineId() {
        // Generate a unique machine ID based on browser fingerprint
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Machine ID Generator', 2, 2);
        
        const fingerprint = [
            navigator.userAgent,
            navigator.language,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset(),
            canvas.toDataURL()
        ].join('|');
        
        // Simple hash function
        let hash = 0;
        for (let i = 0; i < fingerprint.length; i++) {
            const char = fingerprint.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        // Format as machine ID
        const machineId = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
        return `MACH-${machineId.substring(0, 4)}-${machineId.substring(4, 8)}-${Date.now().toString(16).substring(-4).toUpperCase()}`;
    }

    displayMachineId() {
        document.getElementById('machineId').textContent = this.machineId;
    }

    regenerateMachineId() {
        this.machineId = this.generateMachineId();
        this.displayMachineId();
        this.showMessage('Thông báo', 'Machine ID đã được tạo mới!');
    }

    displaySystemInfo() {
        // Browser info
        const browserInfo = this.getBrowserInfo();
        document.getElementById('browserInfo').textContent = browserInfo;
        
        // OS info
        const osInfo = this.getOSInfo();
        document.getElementById('osInfo').textContent = osInfo;
    }

    getBrowserInfo() {
        const ua = navigator.userAgent;
        let browserName = 'Unknown';
        let browserVersion = 'Unknown';

        if (ua.indexOf('Chrome') > -1) {
            browserName = 'Google Chrome';
            browserVersion = ua.match(/Chrome\/([0-9\.]+)/)[1];
        } else if (ua.indexOf('Firefox') > -1) {
            browserName = 'Mozilla Firefox';
            browserVersion = ua.match(/Firefox\/([0-9\.]+)/)[1];
        } else if (ua.indexOf('Safari') > -1) {
            browserName = 'Safari';
            browserVersion = ua.match(/Safari\/([0-9\.]+)/)[1];
        } else if (ua.indexOf('Edge') > -1) {
            browserName = 'Microsoft Edge';
            browserVersion = ua.match(/Edge\/([0-9\.]+)/)[1];
        }

        return `${browserName} ${browserVersion}`;
    }

    getOSInfo() {
        const platform = navigator.platform;
        const userAgent = navigator.userAgent;

        if (platform.indexOf('Win') !== -1) {
            if (userAgent.indexOf('Windows NT 10.0') !== -1) return 'Windows 10/11';
            if (userAgent.indexOf('Windows NT 6.3') !== -1) return 'Windows 8.1';
            if (userAgent.indexOf('Windows NT 6.2') !== -1) return 'Windows 8';
            if (userAgent.indexOf('Windows NT 6.1') !== -1) return 'Windows 7';
            return 'Windows';
        }
        
        if (platform.indexOf('Mac') !== -1) return 'macOS';
        if (platform.indexOf('Linux') !== -1) return 'Linux';
        
        return platform || 'Unknown';
    }

    validatePhoneFormat() {
        const phoneInput = document.getElementById('phone');
        const phone = phoneInput.value.trim();
        const group = phoneInput.closest('.form-group');
        
        // Remove existing validation classes and messages
        group.classList.remove('success', 'error');
        this.removeValidationMessage(group);
        
        if (!phone) return;
        
        // Check Vietnamese phone format
        const phoneRegex = /^(0[3|5|7|8|9])+([0-9]{8})$/;
        
        if (phoneRegex.test(phone)) {
            group.classList.add('success');
            this.showValidationMessage(group, 'Số điện thoại hợp lệ', 'success');
        } else {
            group.classList.add('error');
            this.showValidationMessage(group, 'Số điện thoại không hợp lệ. Ví dụ: 0901234567', 'error');
        }
    }

    updateTransferContent() {
        const phone = document.getElementById('phone').value.trim();
        const transferContentElement = document.querySelector('.info-row .value');
        
        if (phone && transferContentElement) {
            const contentElements = document.querySelectorAll('.info-row .value');
            contentElements.forEach((el, index) => {
                if (index === 4) { // Transfer content row
                    el.textContent = `LICENSE ${phone}`;
                }
            });
        }
    }

    validateEmail() {
        const emailInput = document.getElementById('email');
        const email = emailInput.value.trim();
        const group = emailInput.closest('.form-group');
        
        // Remove existing validation classes and messages
        group.classList.remove('success', 'error');
        this.removeValidationMessage(group);
        
        if (!email) return;
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (emailRegex.test(email)) {
            group.classList.add('success');
            this.showValidationMessage(group, 'Email hợp lệ', 'success');
        } else {
            group.classList.add('error');
            this.showValidationMessage(group, 'Email không hợp lệ', 'error');
        }
    }

    showValidationMessage(group, message, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `${type}-message`;
        messageDiv.textContent = message;
        group.appendChild(messageDiv);
    }

    removeValidationMessage(group) {
        const messages = group.querySelectorAll('.error-message, .success-message');
        messages.forEach(msg => msg.remove());
    }

    previewRegistration() {
        const formData = this.getFormData();
        
        if (!this.validateFormData(formData)) {
            return;
        }

        this.displayRegistrationPreview(formData);
    }

    generateLicenseInfo(key) {
        const now = new Date();
        const expiry = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year
        
        return {
            key: key,
            type: 'TEST LICENSE',
            status: 'Valid',
            issued: now.toLocaleDateString('vi-VN'),
            expires: expiry.toLocaleDateString('vi-VN'),
            features: ['Revit Integration', 'HVAC Tools', 'Export Functions', 'Premium Support'],
            maxActivations: 3,
            currentActivations: 1
        };
    }

    displayValidationResult(isValid, licenseInfo, key) {
        const resultSection = document.getElementById('result');
        const resultMessage = document.getElementById('resultMessage');
        const licenseDetails = document.getElementById('licenseDetails');
        
        resultSection.classList.remove('error');
        
        if (isValid) {
            resultMessage.innerHTML = `
                <strong>✅ License key hợp lệ!</strong><br>
                License này có thể được kích hoạt.
            `;
            
            licenseDetails.innerHTML = `
                <h4>Chi tiết License:</h4>
                <div class="detail-item">
                    <span><strong>Mã License:</strong></span>
                    <span>${licenseInfo.key}</span>
                </div>
                <div class="detail-item">
                    <span><strong>Loại:</strong></span>
                    <span>${licenseInfo.type}</span>
                </div>
                <div class="detail-item">
                    <span><strong>Trạng thái:</strong></span>
                    <span>${licenseInfo.status}</span>
                </div>
                <div class="detail-item">
                    <span><strong>Ngày phát hành:</strong></span>
                    <span>${licenseInfo.issued}</span>
                </div>
                <div class="detail-item">
                    <span><strong>Ngày hết hạn:</strong></span>
                    <span>${licenseInfo.expires}</span>
                </div>
                <div class="detail-item">
                    <span><strong>Tính năng:</strong></span>
                    <span>${licenseInfo.features.join(', ')}</span>
                </div>
                <div class="detail-item">
                    <span><strong>Kích hoạt tối đa:</strong></span>
                    <span>${licenseInfo.currentActivations}/${licenseInfo.maxActivations}</span>
                </div>
            `;
        } else {
            resultSection.classList.add('error');
            resultMessage.innerHTML = `
                <strong>❌ License key không hợp lệ!</strong><br>
                Vui lòng kiểm tra lại mã license key.
            `;
            
            licenseDetails.innerHTML = `
                <h4>Gợi ý:</h4>
                <ul>
                    <li>Kiểm tra lại định dạng license key</li>
                    <li>Đảm bảo không có khoảng trắng thừa</li>
                    <li>Sử dụng một trong các test key có sẵn</li>
                    <li>Liên hệ support nếu bạn có license key hợp lệ</li>
                </ul>
            `;
        }
        
        resultSection.style.display = 'block';
        resultSection.scrollIntoView({ behavior: 'smooth' });
    }

    handleFormSubmit(event) {
        event.preventDefault();
        
        const formData = this.getFormData();
        
        if (!this.validateFormData(formData)) {
            return;
        }
        
        this.submitRegistration(formData);
    }

    getFormData() {
        return {
            userName: document.getElementById('userName').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            company: document.getElementById('company').value.trim(),
            machineId: this.machineId
        };
    }

    validateFormData(formData) {
        // Validate required fields
        if (!formData.userName || !formData.email || !formData.phone) {
            this.showMessage('Lỗi', 'Vui lòng điền đầy đủ các trường bắt buộc!');
            return false;
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            this.showMessage('Lỗi', 'Email không hợp lệ!');
            return false;
        }
        
        // Validate phone format
        const phoneRegex = /^(0[3|5|7|8|9])+([0-9]{8})$/;
        if (!phoneRegex.test(formData.phone)) {
            this.showMessage('Lỗi', 'Số điện thoại không hợp lệ!');
            return false;
        }
        
        return true;
    }

    submitRegistration(formData) {
        this.showLoading(true);
        
        // Simulate API call
        setTimeout(() => {
            this.showLoading(false);
            
            // Create registration data
            const registrationData = {
                ...formData,
                registeredAt: new Date().toISOString(),
                status: 'Pending', // Pending, Approved, Rejected
                registrationId: this.generateRegistrationId(),
                paymentAmount: 2500000, // 2.5M VND
                paymentStatus: 'Pending' // Pending, Paid, Failed
            };
            
            // Save to local storage
            this.registrations.push(registrationData);
            localStorage.setItem('licenseRegistrations', JSON.stringify(this.registrations));
            
            this.showRegistrationSuccess(registrationData);
        }, 2000);
    }

    generateRegistrationId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `REG-${timestamp}-${random}`.toUpperCase();
    }

    displayRegistrationPreview(formData) {
        const resultSection = document.getElementById('result');
        const resultMessage = document.getElementById('resultMessage');
        const registrationDetails = document.getElementById('registrationDetails');
        
        resultSection.classList.remove('error');
        
        resultMessage.innerHTML = `
            <strong>📋 Xem trước thông tin đăng ký</strong><br>
            Vui lòng kiểm tra lại thông tin trước khi đăng ký.
        `;
        
        registrationDetails.innerHTML = `
            <h4>Thông tin đăng ký:</h4>
            <div class="detail-item">
                <span><strong>Họ tên:</strong></span>
                <span>${formData.userName}</span>
            </div>
            <div class="detail-item">
                <span><strong>Email:</strong></span>
                <span>${formData.email}</span>
            </div>
            <div class="detail-item">
                <span><strong>Số điện thoại:</strong></span>
                <span>${formData.phone}</span>
            </div>
            <div class="detail-item">
                <span><strong>Công ty:</strong></span>
                <span>${formData.company || 'Không có'}</span>
            </div>
            <div class="detail-item">
                <span><strong>Machine ID:</strong></span>
                <span>${formData.machineId}</span>
            </div>
            <div class="detail-item">
                <span><strong>Số tiền:</strong></span>
                <span style="color: #dc3545; font-weight: bold;">2,500,000 VNĐ</span>
            </div>
            <div class="detail-item">
                <span><strong>Nội dung CK:</strong></span>
                <span>LICENSE ${formData.phone}</span>
            </div>
        `;
        
        resultSection.style.display = 'block';
        resultSection.scrollIntoView({ behavior: 'smooth' });
    }

    showRegistrationSuccess(registrationData) {
        const resultSection = document.getElementById('result');
        const resultMessage = document.getElementById('resultMessage');
        const registrationDetails = document.getElementById('registrationDetails');
        
        resultSection.classList.remove('error');
        
        resultMessage.innerHTML = `
            <strong>🎉 Đăng ký thành công!</strong><br>
            Đơn đăng ký của bạn đã được gửi. Vui lòng chuyển khoản và chờ admin duyệt.
        `;
        
        registrationDetails.innerHTML = `
            <h4>Thông tin đăng ký:</h4>
            <div class="detail-item">
                <span><strong>Mã đăng ký:</strong></span>
                <span style="font-family: monospace; color: #4facfe;">${registrationData.registrationId}</span>
            </div>
            <div class="detail-item">
                <span><strong>Họ tên:</strong></span>
                <span>${registrationData.userName}</span>
            </div>
            <div class="detail-item">
                <span><strong>Email:</strong></span>
                <span>${registrationData.email}</span>
            </div>
            <div class="detail-item">
                <span><strong>Số điện thoại:</strong></span>
                <span>${registrationData.phone}</span>
            </div>
            <div class="detail-item">
                <span><strong>Ngày đăng ký:</strong></span>
                <span>${new Date(registrationData.registeredAt).toLocaleString('vi-VN')}</span>
            </div>
            <div class="detail-item">
                <span><strong>Trạng thái:</strong></span>
                <span style="color: #ffc107; font-weight: bold;">Đang chờ duyệt</span>
            </div>
            <div class="detail-item">
                <span><strong>Hướng dẫn tiếp theo:</strong></span>
                <span>
                    1. Chuyển khoản theo thông tin trên<br>
                    2. Chờ admin xác nhận thanh toán<br>
                    3. License key sẽ được gửi qua email
                </span>
            </div>
        `;
        
        resultSection.style.display = 'block';
        resultSection.scrollIntoView({ behavior: 'smooth' });
        
        // Reset form
        document.getElementById('licenseForm').reset();
        this.displayMachineId(); // Restore machine ID display
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        overlay.style.display = show ? 'flex' : 'none';
    }

    showMessage(title, message) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalMessage').textContent = message;
        document.getElementById('messageModal').style.display = 'flex';
    }
}

// Modal functions
function closeModal() {
    document.getElementById('messageModal').style.display = 'none';
}

function showAbout() {
    const message = `
MyRevitAddin License System v1.0

Hệ thống quản lý license cho Revit Add-in.

Tính năng:
- Kiểm tra và kích hoạt license
- Quản lý thông tin người dùng
- Theo dõi trạng thái kích hoạt
- Hỗ trợ test mode

© 2024 MyRevitAddin. All rights reserved.
    `;
    
    const app = new LicenseApp();
    app.showMessage('Về MyRevitAddin', message);
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.registrationApp = new RegistrationApp();
});

// Handle modal clicks
document.addEventListener('click', (e) => {
    const modal = document.getElementById('messageModal');
    if (e.target === modal) {
        closeModal();
    }
});

// Handle escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});