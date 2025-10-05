// Admin Panel JavaScript
class AdminPanel {
    constructor() {
        this.registrations = JSON.parse(localStorage.getItem('registrations') || '[]');
        this.filteredRegistrations = [...this.registrations];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.selectedRegistrations = new Set();
        this.pendingSuspendIndex = null;
        
        this.initializeAdmin();
    }

    initializeAdmin() {
        this.setupEventListeners();
        this.updateStatistics();
        this.renderRegistrationsTable();
        this.updatePagination();
    }

    setupEventListeners() {
        // Search and filter
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterRegistrations();
        });

        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.filterRegistrations();
        });

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshData();
        });

        // Export button
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportToCSV();
        });

        // Select all checkbox
        document.getElementById('selectAll').addEventListener('change', (e) => {
            this.selectAllRegistrations(e.target.checked);
        });

        // Bulk actions
        document.getElementById('approveSelectedBtn').addEventListener('click', () => {
            this.bulkApproveSelected();
        });

        document.getElementById('rejectSelectedBtn').addEventListener('click', () => {
            this.bulkRejectSelected();
        });

        document.getElementById('suspendSelectedBtn').addEventListener('click', () => {
            this.bulkSuspendSelected();
        });

        // Pagination
        document.getElementById('prevPage').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderRegistrationsTable();
                this.updatePagination();
            }
        });

        document.getElementById('nextPage').addEventListener('click', () => {
            const maxPage = Math.ceil(this.filteredRegistrations.length / this.itemsPerPage);
            if (this.currentPage < maxPage) {
                this.currentPage++;
                this.renderRegistrationsTable();
                this.updatePagination();
            }
        });
    }

    refreshData() {
        this.registrations = JSON.parse(localStorage.getItem('registrations') || '[]');
        this.selectedRegistrations.clear();
        this.filterRegistrations();
        this.updateStatistics();
        this.renderRegistrationsTable();
        this.updatePagination();
    }

    filterRegistrations() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const statusFilter = document.getElementById('statusFilter').value;

        this.filteredRegistrations = this.registrations.filter(registration => {
            const matchesSearch = searchTerm === '' || 
                registration.userName.toLowerCase().includes(searchTerm) ||
                registration.email.toLowerCase().includes(searchTerm) ||
                registration.phone.includes(searchTerm) ||
                registration.registrationId.toLowerCase().includes(searchTerm);

            const matchesStatus = statusFilter === '' || registration.status === statusFilter;

            return matchesSearch && matchesStatus;
        });

        this.currentPage = 1;
        this.renderRegistrationsTable();
        this.updatePagination();
    }

    updateStatistics() {
        const stats = {
            total: this.registrations.length,
            pending: this.registrations.filter(r => r.status === 'Pending').length,
            approved: this.registrations.filter(r => r.status === 'Approved').length,
            rejected: this.registrations.filter(r => r.status === 'Rejected').length,
            suspended: this.registrations.filter(r => r.status === 'Suspended').length
        };

        // S᫾ element with null check
        const setElementText = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            } else {
                console.warn(`Element with id '${id}' not found`);
            }
        };

        setElementText('totalRegistrations', stats.total);
        setElementText('pendingRegistrations', stats.pending);
        setElementText('approvedRegistrations', stats.approved);
        setElementText('rejectedRegistrations', stats.rejected);
        setElementText('suspendedRegistrations', stats.suspended);
    }

    renderRegistrationsTable() {
        const tbody = document.getElementById('registrationsTableBody');
        if (!tbody) {
            console.error('registrationsTableBody element not found');
            return;
        }
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = this.filteredRegistrations.slice(startIndex, endIndex);

        tbody.innerHTML = pageData.map((registration, index) => {
            const actualIndex = startIndex + index;
            const originalIndex = this.registrations.findIndex(r => r.registrationId === registration.registrationId);
            const isSelected = this.selectedRegistrations.has(originalIndex);
            const status = registration.status;
            const machineCount = registration.machineCount || 1;
            const maxMachines = 3; // Giới hạn máy tối đa
            
            return `
                <tr class="${isSelected ? 'selected' : ''}">
                    <td>
                        <input type="checkbox" ${isSelected ? 'checked' : ''} 
                               onchange="adminPanel.toggleRegistrationSelection(${originalIndex}, this.checked)">
                    </td>
                    <td class="license-key">${registration.registrationId}</td>
                    <td>${registration.userName}</td>
                    <td>${registration.email}</td>
                    <td>${registration.phone}</td>
                    <td>${registration.company || '-'}</td>
                    <td class="license-key">${registration.licenseKey || 'Chưa cấp'}</td>
                    <td class="${machineCount > maxMachines ? 'machine-count-warning' : 'machine-count-normal'}">
                        ${machineCount}/${maxMachines}
                        ${machineCount > maxMachines ? ' ⚠️' : ''}
                    </td>
                    <td>${this.formatDate(registration.registeredAt)}</td>
                    <td><span class="status ${status.toLowerCase()}">${this.getStatusText(status)}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-icon btn-view" onclick="adminPanel.viewRegistration(${originalIndex})" title="Xem chi tiết">
                                👁️
                            </button>
                            ${status === 'Pending' ? `
                            <button class="btn btn-icon btn-approve" onclick="adminPanel.approveRegistration(${originalIndex})" title="Duyệt">
                                ✅
                            </button>
                            <button class="btn btn-icon btn-reject" onclick="adminPanel.rejectRegistration(${originalIndex})" title="Từ chối">
                                ❌
                            </button>
                            ` : ''}
                            ${status === 'Approved' ? `
                            <button class="btn btn-icon btn-suspend" onclick="adminPanel.suspendLicense(${originalIndex})" title="Tạm dừng">
                                ⏸️
                            </button>
                            ` : ''}
                            ${status === 'Suspended' ? `
                            <button class="btn btn-icon btn-approve" onclick="adminPanel.reactivateLicense(${originalIndex})" title="Kích hoạt lại">
                                ▶️
                            </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Update select all checkbox after rendering
        this.updateSelectAllCheckbox();
    }

    updatePagination() {
        const totalItems = this.filteredRegistrations.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        
        const currentPageEl = document.getElementById('currentPage');
        const totalPagesEl = document.getElementById('totalPages');
        const prevPageEl = document.getElementById('prevPage');
        const nextPageEl = document.getElementById('nextPage');
        
        if (currentPageEl) currentPageEl.textContent = this.currentPage;
        if (totalPagesEl) totalPagesEl.textContent = totalPages;
        if (prevPageEl) prevPageEl.disabled = this.currentPage === 1;
        if (nextPageEl) nextPageEl.disabled = this.currentPage === totalPages;
    }

    toggleRegistrationSelection(index, checked) {
        if (checked) {
            this.selectedRegistrations.add(index);
        } else {
            this.selectedRegistrations.delete(index);
        }
        this.updateSelectAllCheckbox();
    }

    selectAllRegistrations(selectAll) {
        this.selectedRegistrations.clear();
        
        if (selectAll) {
            const startIndex = (this.currentPage - 1) * this.itemsPerPage;
            const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredRegistrations.length);
            
            for (let i = startIndex; i < endIndex; i++) {
                const registration = this.filteredRegistrations[i];
                const originalIndex = this.registrations.findIndex(r => r.registrationId === registration.registrationId);
                if (originalIndex !== -1) {
                    this.selectedRegistrations.add(originalIndex);
                }
            }
        }
        
        this.renderRegistrationsTable();
    }

    updateSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById('selectAll');
        if (!selectAllCheckbox) {
            console.warn('selectAll checkbox not found');
            return;
        }
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredRegistrations.length);
        
        let allSelected = true;
        for (let i = startIndex; i < endIndex; i++) {
            const registration = this.filteredRegistrations[i];
            const originalIndex = this.registrations.findIndex(r => r.registrationId === registration.registrationId);
            if (!this.selectedRegistrations.has(originalIndex)) {
                allSelected = false;
                break;
            }
        }
        
        selectAllCheckbox.checked = allSelected && endIndex > startIndex;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN');
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    }

    getStatusText(status) {
        const statusMap = {
            'Pending': 'Chờ duyệt',
            'Approved': 'Đã duyệt',
            'Rejected': 'Đã từ chối',
            'Suspended': 'Tạm dừng'
        };
        return statusMap[status] || status;
    }

    saveRegistrations() {
        localStorage.setItem('registrations', JSON.stringify(this.registrations));
    }

    // Generate random license key
    generateLicenseKey() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const segments = [];
        
        for (let i = 0; i < 4; i++) {
            let segment = '';
            for (let j = 0; j < 4; j++) {
                segment += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            segments.push(segment);
        }
        
        return segments.join('-');
    }

    // Approve registration
    approveRegistration(index) {
        const registration = this.registrations[index];
        
        if (!registration || registration.status !== 'Pending') {
            alert('Không thể duyệt đăng ký này!');
            return;
        }
        
        if (confirm(`Bạn có chắc chắn muốn duyệt đăng ký của ${registration.userName}?`)) {
            // Generate license key
            const licenseKey = this.generateLicenseKey();
            
            // Update registration
            registration.status = 'Approved';
            registration.licenseKey = licenseKey;
            registration.approvedAt = new Date().toISOString();
            registration.machineCount = 1;
            
            this.saveRegistrations();
            this.renderRegistrationsTable();
            this.updateStatistics();
            
            alert(`Đã duyệt đăng ký thành công!\nLicense Key: ${licenseKey}`);
        }
    }

    // Reject registration
    rejectRegistration(index) {
        const registration = this.registrations[index];
        
        if (!registration || registration.status !== 'Pending') {
            alert('Không thể từ chối đăng ký này!');
            return;
        }
        
        if (confirm(`Bạn có chắc chắn muốn từ chối đăng ký của ${registration.userName}?`)) {
            registration.status = 'Rejected';
            registration.rejectedAt = new Date().toISOString();
            
            this.saveRegistrations();
            this.renderRegistrationsTable();
            this.updateStatistics();
            
            alert('Đã từ chối đăng ký thành công!');
        }
    }

    // Bulk approve selected registrations
    bulkApproveSelected() {
        console.log('bulkApproveSelected called');
        console.log('Selected registrations:', Array.from(this.selectedRegistrations));
        
        if (this.selectedRegistrations.size === 0) {
            alert('Vui lòng chọn ít nhất một đăng ký để duyệt.');
            return;
        }

        let approvedCount = 0;
        Array.from(this.selectedRegistrations).forEach(index => {
            const registration = this.registrations[index];
            if (registration && registration.status === 'Pending') {
                const licenseKey = this.generateLicenseKey();
                registration.status = 'Approved';
                registration.licenseKey = licenseKey;
                registration.approvedAt = new Date().toISOString();
                registration.machineCount = 1;
                approvedCount++;
            }
        });

        if (approvedCount > 0) {
            this.saveRegistrations();
            this.renderRegistrationsTable();
            this.updateStatistics();
            this.selectedRegistrations.clear();
            alert(`Đã duyệt ${approvedCount} đăng ký thành công!`);
        }
    }

    // Bulk reject selected registrations
    bulkRejectSelected() {
        if (this.selectedRegistrations.size === 0) {
            alert('Vui lòng chọn ít nhất một đăng ký để từ chối.');
            return;
        }

        let rejectedCount = 0;
        Array.from(this.selectedRegistrations).forEach(index => {
            const registration = this.registrations[index];
            if (registration && registration.status === 'Pending') {
                registration.status = 'Rejected';
                registration.rejectedAt = new Date().toISOString();
                rejectedCount++;
            }
        });

        if (rejectedCount > 0) {
            this.saveRegistrations();
            this.renderRegistrationsTable();
            this.updateStatistics();
            this.selectedRegistrations.clear();
            alert(`Đã từ chối ${rejectedCount} đăng ký thành công!`);
        }
    }

    exportToCSV() {
        if (this.registrations.length === 0) {
            alert('Không có dữ liệu để xuất.');
            return;
        }
        
        const headers = [
            'Mã đăng ký',
            'Tên người dùng',
            'Email',
            'Số điện thoại',
            'Công ty',
            'License Key',
            'Machine ID',
            'Ngày đăng ký',
            'Số tiền',
            'Trạng thái'
        ];
        
        const csvData = [
            headers.join(','),
            ...this.registrations.map(registration => [
                registration.registrationId,
                registration.userName,
                registration.email,
                registration.phone,
                registration.company || '',
                registration.licenseKey || '',
                registration.machineId,
                this.formatDate(registration.registeredAt),
                registration.paymentAmount,
                this.getStatusText(registration.status)
            ].map(field => `"${field}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `registrations_export_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        
        alert('Đã xuất dữ liệu thành công!');
    }

    viewRegistration(index) {
        console.log('viewRegistration called with index:', index);
        const registration = this.registrations[index];
        console.log('Registration found:', registration);
        if (!registration) {
            console.error('Registration not found at index:', index);
            return;
        }

        // Populate modal with registration details using safe element setter
        const setModalElement = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            } else {
                console.warn(`Modal element '${id}' not found`);
            }
        };

        setModalElement('viewRegistrationId', registration.registrationId);
        setModalElement('viewUserName', registration.userName);
        setModalElement('viewEmail', registration.email);
        setModalElement('viewPhone', registration.phone);
        setModalElement('viewCompany', registration.company || 'Không có');
        setModalElement('viewMachineId', registration.machineId);
        setModalElement('viewRegisteredAt', this.formatDate(registration.registeredAt));
        setModalElement('viewPaymentAmount', this.formatCurrency(registration.paymentAmount));
        setModalElement('viewStatus', this.getStatusText(registration.status));

        // Show license key if approved
        const licenseKeyRow = document.getElementById('viewLicenseKeyRow');
        const licenseKeyValue = document.getElementById('viewLicenseKey');
        if (licenseKeyRow && licenseKeyValue) {
            if (registration.licenseKey) {
                licenseKeyValue.textContent = registration.licenseKey;
                licenseKeyRow.style.display = 'table-row';
            } else {
                licenseKeyRow.style.display = 'none';
            }
        }

        const modal = document.getElementById('viewRegistrationModal');
        if (modal) {
            modal.style.display = 'flex';
        } else {
            console.error('viewRegistrationModal not found');
            alert('Không thể mở modal xem chi tiết. Vui lòng thử lại.');
        }
    }

    // Suspend license functionality
    suspendLicense(index) {
        const registration = this.registrations[index];
        if (!registration || registration.status !== 'Approved') {
            alert('Không thể tạm dừng license này!');
            return;
        }

        // Hiển thị modal tạm dừng
        const modal = document.getElementById('suspendModal');
        modal.style.display = 'block';

        // Lưu index để sử dụng khi xác nhận
        this.pendingSuspendIndex = index;
    }

    reactivateLicense(index) {
        const registration = this.registrations[index];
        if (!registration || registration.status !== 'Suspended') {
            alert('Không thể kích hoạt lại license này!');
            return;
        }

        if (confirm(`Bạn có chắc chắn muốn kích hoạt lại license cho ${registration.userName}?`)) {
            registration.status = 'Approved';
            registration.suspendedAt = null;
            registration.suspendReason = null;
            registration.reactivatedAt = new Date().toISOString();
            
            this.saveRegistrations();
            this.renderRegistrationsTable();
            this.updateStatistics();
            
            alert('License đã được kích hoạt lại thành công!');
        }
    }

    confirmSuspendLicense() {
        const reason = document.getElementById('suspendReason').value;
        const index = this.pendingSuspendIndex;
        
        if (!reason) {
            alert('Vui lòng chọn lý do tạm dừng!');
            return;
        }

        const registration = this.registrations[index];
        registration.status = 'Suspended';
        registration.suspendedAt = new Date().toISOString();
        registration.suspendReason = reason;
        
        this.saveRegistrations();
        this.renderRegistrationsTable();
        this.updateStatistics();
        
        // Đóng modal
        document.getElementById('suspendModal').style.display = 'none';
        
        alert(`License của ${registration.userName} đã được tạm dừng!`);
    }

    bulkSuspendSelected() {
        if (this.selectedRegistrations.size === 0) {
            alert('Vui lòng chọn ít nhất một đăng ký để tạm dừng.');
            return;
        }

        const reason = prompt('Nhập lý do tạm dừng hàng loạt:');
        if (!reason) return;

        let suspendedCount = 0;
        Array.from(this.selectedRegistrations).forEach(index => {
            const registration = this.registrations[index];
            if (registration && registration.status === 'Approved') {
                registration.status = 'Suspended';
                registration.suspendedAt = new Date().toISOString();
                registration.suspendReason = reason;
                suspendedCount++;
            }
        });

        if (suspendedCount > 0) {
            this.saveRegistrations();
            this.renderRegistrationsTable();
            this.updateStatistics();
            this.selectedRegistrations.clear();
            alert(`Đã tạm dừng ${suspendedCount} license thành công!`);
        }
    }

    // Modal management methods
    closeViewRegistrationModal() {
        document.getElementById('viewRegistrationModal').style.display = 'none';
    }
}

// Global functions for modal management
function closeViewRegistrationModal() {
    adminPanel.closeViewRegistrationModal();
}

function closeSuspendModal() {
    document.getElementById('suspendModal').style.display = 'none';
}

function confirmSuspendLicense() {
    adminPanel.confirmSuspendLicense();
}

// Admin Authentication
class AdminAuth {
    constructor() {
        this.defaultCredentials = {
            username: 'doanthanhson102@gmail.com',
            password: '17021351'
        };
        this.sessionKey = 'adminLoggedIn';
        this.init();
    }

    init() {
        // Check if already logged in
        if (this.isLoggedIn()) {
            this.showAdminContent();
        } else {
            this.showLoginScreen();
        }

        // Setup login form
        this.setupLoginForm();
    }

    setupLoginForm() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Setup password toggle
        const passwordInput = document.getElementById('adminPassword');
        if (passwordInput) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleLogin();
                }
            });
        }
    }

    handleLogin() {
        const username = document.getElementById('adminUsername').value.trim();
        const password = document.getElementById('adminPassword').value.trim();
        const errorDiv = document.getElementById('loginError');

        // Hide previous error
        errorDiv.style.display = 'none';

        // Validate credentials
        if (this.validateCredentials(username, password)) {
            // Login successful
            this.setLoggedIn(true);
            this.showAdminContent();
            
            // Clear form
            document.getElementById('loginForm').reset();
        } else {
            // Login failed
            errorDiv.style.display = 'block';
            
            // Shake animation for error
            errorDiv.style.animation = 'shake 0.5s ease-in-out';
            setTimeout(() => {
                errorDiv.style.animation = '';
            }, 500);

            // Focus back to username
            document.getElementById('adminUsername').focus();
        }
    }

    validateCredentials(username, password) {
        // You can modify this to use database, API, or other authentication methods
        return username === this.defaultCredentials.username && 
               password === this.defaultCredentials.password;
    }

    isLoggedIn() {
        return sessionStorage.getItem(this.sessionKey) === 'true';
    }

    setLoggedIn(status) {
        sessionStorage.setItem(this.sessionKey, status.toString());
    }

    showLoginScreen() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('adminContent').style.display = 'none';
        
        // Focus on username field
        setTimeout(() => {
            document.getElementById('adminUsername').focus();
        }, 100);
    }

    showAdminContent() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminContent').style.display = 'block';
        
        // Initialize admin panel
        if (!window.adminPanel) {
            window.adminPanel = new AdminPanel();
        }
    }

    logout() {
        this.setLoggedIn(false);
        this.showLoginScreen();
        
        // Clear admin panel data
        if (window.adminPanel) {
            window.adminPanel = null;
        }
    }
}

// Global functions
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('adminPassword');
    const toggleIcon = document.getElementById('toggleIcon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.textContent = '🙈';
    } else {
        passwordInput.type = 'password';
        toggleIcon.textContent = '👁️';
    }
}

function adminLogout() {
    if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
        window.adminAuth.logout();
    }
}

// Initialize admin authentication when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.adminAuth = new AdminAuth();
});

// Handle modal clicks
document.addEventListener('click', (e) => {
    const modals = ['viewRegistrationModal', 'suspendModal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// Handle escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modals = ['viewRegistrationModal', 'suspendModal'];
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal.style.display === 'flex' || modal.style.display === 'block') {
                modal.style.display = 'none';
            }
        });
    }
});