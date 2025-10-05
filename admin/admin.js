// Admin Panel JavaScript
class AdminPanel {
    constructor() {
        this.registrations = JSON.parse(localStorage.getItem('licenseRegistrations') || '[]');
        this.approvedLicenses = JSON.parse(localStorage.getItem('approvedLicenses') || '[]');
        this.filteredRegistrations = [...this.registrations];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.selectedRegistrations = new Set();
        
        // EmailJS configuration
        this.emailjsConfig = {
            serviceId: 'service_demo123', // Bạn cần thay thế bằng service ID thực
            templateId: 'template_demo123', // Bạn cần thay thế bằng template ID thực  
            publicKey: 'your_public_key_here' // Bạn cần thay thế bằng public key thực
        };
        
        this.initializeAdmin();
    }

    initializeAdmin() {
        this.initializeEmailJS();
        this.setupEventListeners();
        this.updateStatistics();
        this.renderRegistrationsTable();
        this.updatePagination();
    }

    initializeEmailJS() {
        // Initialize EmailJS with public key
        try {
            emailjs.init(this.emailjsConfig.publicKey);
            console.log('✅ EmailJS initialized successfully');
        } catch (error) {
            console.log('⚠️ EmailJS initialization failed (using demo mode):', error);
        }
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

        // Test email button
        document.getElementById('testEmailBtn').addEventListener('click', () => {
            this.testEmail();
        });

        // Select all checkbox
        document.getElementById('selectAll').addEventListener('change', (e) => {
            this.selectAllRegistrations(e.target.checked);
        });

        // Bulk approve/reject/suspend
        document.getElementById('approveSelectedBtn').addEventListener('click', () => {
            this.approveSelectedRegistrations();
        });

        document.getElementById('rejectSelectedBtn').addEventListener('click', () => {
            this.rejectSelectedRegistrations();
        });

        document.getElementById('suspendSelectedBtn').addEventListener('click', () => {
            this.suspendSelectedRegistrations();
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
            const maxPage = Math.ceil(this.filteredLicenses.length / this.itemsPerPage);
            if (this.currentPage < maxPage) {
                this.currentPage++;
                this.renderRegistrationsTable();
                this.updatePagination();
            }
        });
    }

    refreshData() {
        this.registrations = JSON.parse(localStorage.getItem('licenseRegistrations') || '[]');
        this.approvedLicenses = JSON.parse(localStorage.getItem('approvedLicenses') || '[]');
        this.filteredRegistrations = [...this.registrations];
        this.selectedRegistrations.clear();
        this.currentPage = 1;
        this.updateStatistics();
        this.renderRegistrationsTable();
        this.updatePagination();
        
        // Show refresh animation
        document.querySelector('.admin-container').classList.add('fade-in-up');
        setTimeout(() => {
            document.querySelector('.admin-container').classList.remove('fade-in-up');
        }, 500);
    }

    updateStatistics() {
        const total = this.registrations.length;
        const pending = this.registrations.filter(r => r.status === 'Pending').length;
        const approved = this.registrations.filter(r => r.status === 'Approved').length;
        const suspended = this.registrations.filter(r => r.status === 'Suspended').length;
        const todayRegistrations = this.getTodayRegistrationsCount();

        document.getElementById('totalCount').textContent = total;
        document.getElementById('pendingCount').textContent = pending;
        document.getElementById('approvedCount').textContent = approved;
        document.getElementById('suspendedCount').textContent = suspended;
        document.getElementById('todayRegistrations').textContent = todayRegistrations;

        // Update nav stats
        document.getElementById('totalRegistrations').textContent = `${total} đăng ký`;
        document.getElementById('pendingRegistrations').textContent = `${pending} chờ duyệt`;
    }

    getTodayRegistrationsCount() {
        const today = new Date().toDateString();
        return this.registrations.filter(registration => {
            const registrationDate = new Date(registration.registeredAt).toDateString();
            return registrationDate === today;
        }).length;
    }

    filterRegistrations() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const statusFilter = document.getElementById('statusFilter').value;

        this.filteredRegistrations = this.registrations.filter(registration => {
            const matchesSearch = !searchTerm || 
                registration.registrationId.toLowerCase().includes(searchTerm) ||
                registration.userName.toLowerCase().includes(searchTerm) ||
                registration.email.toLowerCase().includes(searchTerm) ||
                registration.phone.toLowerCase().includes(searchTerm) ||
                (registration.company && registration.company.toLowerCase().includes(searchTerm));

            const matchesStatus = !statusFilter || registration.status === statusFilter;

            return matchesSearch && matchesStatus;
        });

        this.currentPage = 1;
        this.renderRegistrationsTable();
        this.updatePagination();
    }

    renderRegistrationsTable() {
        const tbody = document.getElementById('registrationsTableBody');
        const emptyState = document.getElementById('emptyState');
        const table = document.querySelector('.table-wrapper');
        
        if (this.filteredRegistrations.length === 0) {
            tbody.innerHTML = '';
            table.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        table.style.display = 'block';
        emptyState.style.display = 'none';

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = this.filteredRegistrations.slice(startIndex, endIndex);

        tbody.innerHTML = pageData.map((registration, index) => {
            const actualIndex = startIndex + index;
            const isSelected = this.selectedRegistrations.has(actualIndex);
            const status = registration.status;
            const machineCount = registration.machineCount || 1;
            const maxMachines = 3; // Giới hạn máy tối đa
            
            return `
                <tr class="${isSelected ? 'selected' : ''}">
                    <td>
                        <input type="checkbox" ${isSelected ? 'checked' : ''} 
                               onchange="adminPanel.toggleRegistrationSelection(${actualIndex}, this.checked)">
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
                            <button class="btn btn-icon btn-view" onclick="adminPanel.viewRegistration(${actualIndex})" title="Xem chi tiết">
                                👁️
                            </button>
                            ${status === 'Pending' ? `
                            <button class="btn btn-icon btn-approve" onclick="adminPanel.approveRegistration(${actualIndex})" title="Duyệt">
                                ✅
                            </button>
                            <button class="btn btn-icon btn-reject" onclick="adminPanel.rejectRegistration(${actualIndex})" title="Từ chối">
                                ❌
                            </button>
                            ` : ''}
                            ${status === 'Approved' ? `
                            <button class="btn btn-icon btn-suspend" onclick="adminPanel.suspendLicense(${actualIndex})" title="Tạm dừng">
                                ⏸️
                            </button>
                            ` : ''}
                            ${status === 'Suspended' ? `
                            <button class="btn btn-icon btn-approve" onclick="adminPanel.reactivateLicense(${actualIndex})" title="Kích hoạt lại">
                                ▶️
                            </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    getStatusText(status) {
        const statusMap = {
            'Pending': 'Chờ duyệt',
            'Approved': 'Đã duyệt',
            'Rejected': 'Từ chối'
        };
        return statusMap[status] || status;
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    }

    getLicenseStatus(license) {
        const now = new Date();
        const expiryDate = new Date(license.expiresAt);
        
        if (license.status === 'Suspended') {
            return 'Suspended';
        }
        
        if (expiryDate < now) {
            return 'Expired';
        }
        
        return 'Active';
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    toggleRegistrationSelection(index, selected) {
        if (selected) {
            this.selectedRegistrations.add(index);
        } else {
            this.selectedRegistrations.delete(index);
        }
        
        this.updateSelectAllCheckbox();
    }

    selectAllRegistrations(selectAll) {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredRegistrations.length);
        
        for (let i = startIndex; i < endIndex; i++) {
            if (selectAll) {
                this.selectedRegistrations.add(i);
            } else {
                this.selectedRegistrations.delete(i);
            }
        }
        
        this.renderRegistrationsTable();
    }

    updateSelectAllCheckbox() {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredRegistrations.length);
        const pageIndices = Array.from({length: endIndex - startIndex}, (_, i) => startIndex + i);
        
        const allSelected = pageIndices.every(i => this.selectedRegistrations.has(i));
        const someSelected = pageIndices.some(i => this.selectedRegistrations.has(i));
        
        const selectAllCheckbox = document.getElementById('selectAll');
        selectAllCheckbox.checked = allSelected;
        selectAllCheckbox.indeterminate = someSelected && !allSelected;
    }

    updatePagination() {
        const pagination = document.getElementById('pagination');
        const maxPage = Math.ceil(this.filteredRegistrations.length / this.itemsPerPage);
        
        if (maxPage <= 1) {
            pagination.style.display = 'none';
            return;
        }
        
        pagination.style.display = 'flex';
        document.getElementById('pageInfo').textContent = `Trang ${this.currentPage} / ${maxPage}`;
        document.getElementById('prevPage').disabled = this.currentPage === 1;
        document.getElementById('nextPage').disabled = this.currentPage === maxPage;
    }

    viewLicense(index) {
        const license = this.filteredLicenses[index];
        const status = this.getLicenseStatus(license);
        
        const content = `
            <div class="license-detail-grid">
                <div class="detail-section">
                    <h4>Thông tin cơ bản</h4>
                    <div class="detail-item">
                        <strong>License Key:</strong>
                        <span class="license-key">${license.licenseKey}</span>
                    </div>
                    <div class="detail-item">
                        <strong>Trạng thái:</strong>
                        <span class="status ${status.toLowerCase()}">${status}</span>
                    </div>
                    <div class="detail-item">
                        <strong>Loại License:</strong>
                        <span>TEST LICENSE</span>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Thông tin người dùng</h4>
                    <div class="detail-item">
                        <strong>Tên:</strong>
                        <span>${license.userName}</span>
                    </div>
                    <div class="detail-item">
                        <strong>Email:</strong>
                        <span>${license.email}</span>
                    </div>
                    <div class="detail-item">
                        <strong>Công ty:</strong>
                        <span>${license.company || 'Không có'}</span>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Thông tin kỹ thuật</h4>
                    <div class="detail-item">
                        <strong>Machine ID:</strong>
                        <span class="license-key">${license.machineId}</span>
                    </div>
                    <div class="detail-item">
                        <strong>Ngày kích hoạt:</strong>
                        <span>${new Date(license.activatedAt).toLocaleString('vi-VN')}</span>
                    </div>
                    <div class="detail-item">
                        <strong>Ngày hết hạn:</strong>
                        <span>${new Date(license.expiresAt).toLocaleString('vi-VN')}</span>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('licenseDetailContent').innerHTML = content;
        document.getElementById('licenseDetailModal').style.display = 'flex';
        
        // Store current license for editing
        this.currentEditingLicense = {index: index, data: license};
    }

    editLicense(index) {
        this.currentEditingLicense = {index: index, data: this.filteredLicenses[index]};
        const license = this.currentEditingLicense.data;
        
        document.getElementById('editLicenseIndex').value = index;
        document.getElementById('editUserName').value = license.userName;
        document.getElementById('editEmail').value = license.email;
        document.getElementById('editCompany').value = license.company || '';
        document.getElementById('editStatus').value = license.status || 'Active';
        
        document.getElementById('editLicenseModal').style.display = 'flex';
    }

    saveLicenseChanges() {
        const index = this.currentEditingLicense.index;
        const originalIndex = this.licenses.findIndex(l => l.licenseKey === this.currentEditingLicense.data.licenseKey);
        
        const updatedLicense = {
            ...this.licenses[originalIndex],
            userName: document.getElementById('editUserName').value,
            email: document.getElementById('editEmail').value,
            company: document.getElementById('editCompany').value,
            status: document.getElementById('editStatus').value
        };
        
        this.licenses[originalIndex] = updatedLicense;
        localStorage.setItem('activatedLicenses', JSON.stringify(this.licenses));
        
        this.refreshData();
        this.closeEditLicenseModal();
        
        this.showMessage('Thành công', 'License đã được cập nhật thành công!');
    }

    deleteLicense(index) {
        const license = this.filteredLicenses[index];
        this.showConfirmation(
            'Xác nhận xóa',
            `Bạn có chắc chắn muốn xóa license "${license.licenseKey}"?\nHành động này không thể hoàn tác.`,
            () => {
                const originalIndex = this.licenses.findIndex(l => l.licenseKey === license.licenseKey);
                this.licenses.splice(originalIndex, 1);
                localStorage.setItem('activatedLicenses', JSON.stringify(this.licenses));
                this.refreshData();
                this.showMessage('Thành công', 'License đã được xóa thành công!');
            }
        );
    }

    deleteSelectedLicenses() {
        if (this.selectedLicenses.size === 0) {
            this.showMessage('Thông báo', 'Vui lòng chọn ít nhất một license để xóa.');
            return;
        }
        
        this.showConfirmation(
            'Xác nhận xóa',
            `Bạn có chắc chắn muốn xóa ${this.selectedLicenses.size} license đã chọn?\nHành động này không thể hoàn tác.`,
            () => {
                // Get license keys to delete
                const licensesToDelete = Array.from(this.selectedLicenses).map(i => this.filteredLicenses[i].licenseKey);
                
                // Remove from main array
                this.licenses = this.licenses.filter(l => !licensesToDelete.includes(l.licenseKey));
                localStorage.setItem('activatedLicenses', JSON.stringify(this.licenses));
                
                this.selectedLicenses.clear();
                this.refreshData();
                this.showMessage('Thành công', `Đã xóa ${licensesToDelete.length} license thành công!`);
            }
        );
    }

    exportToCSV() {
        if (this.registrations.length === 0) {
            this.showMessage('Thông báo', 'Không có dữ liệu để xuất.');
            return;
        }
        
        const headers = [
            'Mã đăng ký',
            'Tên người dùng',
            'Email',
            'Số điện thoại',
            'Công ty',
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
        
        this.showMessage('Thành công', 'Đã xuất dữ liệu thành công!');
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
        const registration = this.filteredRegistrations[index];
        
        // Generate license key
        const licenseKey = this.generateLicenseKey();
        
        // Set up approve modal
        document.getElementById('approveRegistrationId').value = registration.registrationId;
        document.getElementById('approveEmail').value = registration.email;
        document.getElementById('approveLicenseKey').value = licenseKey;
        
        // Set default email content
        const emailContent = `Chào ${registration.userName},

Chúng tôi vui mừng thông báo đơn đăng ký license MyRevitAddin của bạn đã được duyệt!

Thông tin license:
- License Key: ${licenseKey}
- Người dùng: ${registration.userName}
- Email: ${registration.email}
- Machine ID: ${registration.machineId}

Hướng dẫn cài đặt:
1. Tải và cài đặt MyRevitAddin
2. Nhập License Key: ${licenseKey}
3. License có hiệu lực trong 1 năm

Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!

Trân trọng,
MyRevitAddin Team`;

        document.getElementById('approveEmailContent').value = emailContent;
        document.getElementById('approveModal').style.display = 'flex';
        
        // Store current registration
        this.currentProcessingRegistration = {index: index, data: registration};
    }

    // Reject registration
    rejectRegistration(index) {
        const registration = this.filteredRegistrations[index];
        
        // Set up reject modal
        document.getElementById('rejectRegistrationId').value = registration.registrationId;
        document.getElementById('rejectEmail').value = registration.email;
        
        // Set default email content
        const emailContent = `Chào ${registration.userName},

Chúng tôi rất tiếc phải thông báo đơn đăng ký license MyRevitAddin của bạn không được chấp thuận.

Thông tin đơn đăng ký:
- Mã đăng ký: ${registration.registrationId}
- Email: ${registration.email}

Nếu bạn có bất kỳ thắc mắc nào, vui lòng liên hệ với chúng tôi để được hỗ trợ.

Trân trọng,
MyRevitAddin Team`;

        document.getElementById('rejectEmailContent').value = emailContent;
        document.getElementById('rejectModal').style.display = 'flex';
        
        // Store current registration
        this.currentProcessingRegistration = {index: index, data: registration};
    }

    // Confirm approve registration
    async confirmApproveRegistration() {
        const registration = this.currentProcessingRegistration.data;
        const licenseKey = document.getElementById('approveLicenseKey').value;
        const emailContent = document.getElementById('approveEmailContent').value;
        
        // Show loading
        const approveBtn = document.querySelector('#approveModal .btn-success');
        const originalText = approveBtn.textContent;
        approveBtn.textContent = 'Đang gửi email...';
        approveBtn.disabled = true;
        
        try {
            // Send email first
            const emailResult = await this.sendEmail(
                registration.email,
                'MyRevitAddin - License Key đã được cấp phát',
                emailContent,
                licenseKey
            );
            
            if (emailResult.success) {
                // Update registration status only if email sent successfully
                const originalIndex = this.registrations.findIndex(r => r.registrationId === registration.registrationId);
                this.registrations[originalIndex].status = 'Approved';
                this.registrations[originalIndex].approvedAt = new Date().toISOString();
                this.registrations[originalIndex].licenseKey = licenseKey;
                this.registrations[originalIndex].emailSent = true;
                this.registrations[originalIndex].emailMethod = emailResult.method;
                
                // Create approved license record
                const approvedLicense = {
                    licenseKey: licenseKey,
                    registrationId: registration.registrationId,
                    userName: registration.userName,
                    email: registration.email,
                    phone: registration.phone,
                    company: registration.company,
                    machineId: registration.machineId,
                    approvedAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString(), // 1 year
                    status: 'Active'
                };
                
                this.approvedLicenses.push(approvedLicense);
                
                // Save to localStorage
                localStorage.setItem('licenseRegistrations', JSON.stringify(this.registrations));
                localStorage.setItem('approvedLicenses', JSON.stringify(this.approvedLicenses));
                
                this.closeApproveModal();
                this.refreshData();
                
                const message = emailResult.method === 'EmailJS' 
                    ? `✅ Đã duyệt và gửi license key tới ${registration.email} thành công!`
                    : `✅ Đã duyệt đăng ký. Email đã được mở trong ứng dụng email của bạn.`;
                    
                this.showMessage('Thành công', message);
            }
        } catch (error) {
            console.error('Error approving registration:', error);
            this.showMessage('Lỗi', 'Có lỗi xảy ra khi gửi email. Vui lòng thử lại.');
        } finally {
            // Reset button
            approveBtn.textContent = originalText;
            approveBtn.disabled = false;
        }
    }

    // Confirm reject registration
    async confirmRejectRegistration() {
        const registration = this.currentProcessingRegistration.data;
        const reason = document.getElementById('rejectReason').value;
        const emailContent = document.getElementById('rejectEmailContent').value;
        
        if (!reason.trim()) {
            this.showMessage('Lỗi', 'Vui lòng nhập lý do từ chối.');
            return;
        }
        
        // Show loading
        const rejectBtn = document.querySelector('#rejectModal .btn-danger');
        const originalText = rejectBtn.textContent;
        rejectBtn.textContent = 'Đang gửi email...';
        rejectBtn.disabled = true;
        
        try {
            // Send email first
            const emailResult = await this.sendEmail(
                registration.email,
                'MyRevitAddin - Thông báo từ chối đăng ký',
                emailContent
            );
            
            if (emailResult.success) {
                // Update registration status only if email sent successfully
                const originalIndex = this.registrations.findIndex(r => r.registrationId === registration.registrationId);
                this.registrations[originalIndex].status = 'Rejected';
                this.registrations[originalIndex].rejectedAt = new Date().toISOString();
                this.registrations[originalIndex].rejectReason = reason;
                this.registrations[originalIndex].emailSent = true;
                this.registrations[originalIndex].emailMethod = emailResult.method;
                
                // Save to localStorage
                localStorage.setItem('licenseRegistrations', JSON.stringify(this.registrations));
                
                this.closeRejectModal();
                this.refreshData();
                
                const message = emailResult.method === 'EmailJS' 
                    ? `✅ Đã từ chối và gửi thông báo tới ${registration.email} thành công!`
                    : `✅ Đã từ chối đăng ký. Email đã được mở trong ứng dụng email của bạn.`;
                    
                this.showMessage('Thành công', message);
            }
        } catch (error) {
            console.error('Error rejecting registration:', error);
            this.showMessage('Lỗi', 'Có lỗi xảy ra khi gửi email. Vui lòng thử lại.');
        } finally {
            // Reset button
            rejectBtn.textContent = originalText;
            rejectBtn.disabled = false;
        }
    }

    // Send email using EmailJS
    async sendEmail(toEmail, subject, content, licenseKey = null) {
        const templateParams = {
            to_email: toEmail,
            subject: subject,
            message: content,
            license_key: licenseKey || 'N/A',
            from_name: 'MyRevitAddin Team',
            reply_to: 'noreply@myrevitaddin.com'
        };

        try {
            console.log(`📧 Attempting to send email to: ${toEmail}`);
            
            // Try to send with EmailJS first
            if (typeof emailjs !== 'undefined') {
                const response = await emailjs.send(
                    this.emailjsConfig.serviceId,
                    this.emailjsConfig.templateId,
                    templateParams
                );
                
                console.log('✅ Email sent successfully via EmailJS:', response);
                return { success: true, method: 'EmailJS', response };
            } else {
                throw new Error('EmailJS not available');
            }
        } catch (error) {
            console.log('⚠️ EmailJS failed, using mailto fallback:', error);
            
            // Fallback: Open default email client
            this.openEmailClient(toEmail, subject, content);
            return { success: true, method: 'mailto', response: 'Opened email client' };
        }
    }

    // Fallback: Open email client with pre-filled content
    openEmailClient(toEmail, subject, content) {
        const mailtoUrl = `mailto:${toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(content)}`;
        
        try {
            window.open(mailtoUrl);
            console.log(`📧 Opened email client for: ${toEmail}`);
        } catch (error) {
            console.log('❌ Failed to open email client:', error);
            
            // Last resort: Copy content to clipboard
            this.copyToClipboard(`To: ${toEmail}\nSubject: ${subject}\n\n${content}`);
            alert(`Không thể gửi email tự động. Nội dung email đã được copy vào clipboard.\n\nGửi tới: ${toEmail}\nTiêu đề: ${subject}`);
        }
    }

    // Copy text to clipboard
    copyToClipboard(text) {
        try {
            navigator.clipboard.writeText(text);
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    }

    // Test email function
    async testEmail() {
        const testEmail = prompt('Nhập email để test (để trống sẽ dùng email demo):') || 'test@example.com';
        
        const testContent = `Đây là email test từ MyRevitAddin Admin Panel.

Thời gian: ${new Date().toLocaleString('vi-VN')}
License Key test: ${this.generateLicenseKey()}

Nếu bạn nhận được email này, chức năng gửi email đang hoạt động tốt!

Trân trọng,
MyRevitAddin Team`;

        try {
            const result = await this.sendEmail(
                testEmail,
                'Test Email từ MyRevitAddin Admin',
                testContent,
                'TEST-' + this.generateLicenseKey()
            );
            
            if (result.success) {
                const message = result.method === 'EmailJS' 
                    ? `✅ Test email đã được gửi thành công tới ${testEmail} qua EmailJS!`
                    : `✅ Test email đã được mở trong ứng dụng email. Kiểm tra và gửi tới ${testEmail}`;
                    
                this.showMessage('Test Email Thành Công', message);
            }
        } catch (error) {
            this.showMessage('Test Email Thất Bại', `Có lỗi xảy ra: ${error.message}`);
        }
    }

    // View registration details
    viewRegistration(index) {
        const registration = this.filteredRegistrations[index];
        
        const content = `
            <div class="license-detail-grid">
                <div class="detail-section">
                    <h4>Thông tin đăng ký</h4>
                    <div class="detail-item">
                        <strong>Mã đăng ký:</strong>
                        <span class="license-key">${registration.registrationId}</span>
                    </div>
                    <div class="detail-item">
                        <strong>Trạng thái:</strong>
                        <span class="status ${registration.status.toLowerCase()}">${this.getStatusText(registration.status)}</span>
                    </div>
                    <div class="detail-item">
                        <strong>Ngày đăng ký:</strong>
                        <span>${new Date(registration.registeredAt).toLocaleString('vi-VN')}</span>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Thông tin khách hàng</h4>
                    <div class="detail-item">
                        <strong>Tên:</strong>
                        <span>${registration.userName}</span>
                    </div>
                    <div class="detail-item">
                        <strong>Email:</strong>
                        <span>${registration.email}</span>
                    </div>
                    <div class="detail-item">
                        <strong>Số điện thoại:</strong>
                        <span>${registration.phone}</span>
                    </div>
                    <div class="detail-item">
                        <strong>Công ty:</strong>
                        <span>${registration.company || 'Không có'}</span>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Thông tin thanh toán</h4>
                    <div class="detail-item">
                        <strong>Số tiền:</strong>
                        <span>${this.formatCurrency(registration.paymentAmount)}</span>
                    </div>
                    <div class="detail-item">
                        <strong>Machine ID:</strong>
                        <span class="license-key">${registration.machineId}</span>
                    </div>
                    ${registration.licenseKey ? `
                    <div class="detail-item">
                        <strong>License Key:</strong>
                        <span class="license-key">${registration.licenseKey}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        document.getElementById('licenseDetailContent').innerHTML = content;
        document.getElementById('licenseDetailModal').style.display = 'flex';
    }

    // Bulk approve selected registrations
    approveSelectedRegistrations() {
        if (this.selectedRegistrations.size === 0) {
            this.showMessage('Thông báo', 'Vui lòng chọn ít nhất một đăng ký để duyệt.');
            return;
        }

        const pendingSelected = Array.from(this.selectedRegistrations).filter(i => 
            this.filteredRegistrations[i].status === 'Pending'
        );

        if (pendingSelected.length === 0) {
            this.showMessage('Thông báo', 'Không có đăng ký nào có thể duyệt trong các mục đã chọn.');
            return;
        }
        
        this.showConfirmation(
            'Xác nhận duyệt',
            `Bạn có chắc chắn muốn duyệt ${pendingSelected.length} đăng ký đã chọn?`,
            () => {
                pendingSelected.forEach(index => {
                    const registration = this.filteredRegistrations[index];
                    const originalIndex = this.registrations.findIndex(r => r.registrationId === registration.registrationId);
                    
                    // Generate license key and approve
                    const licenseKey = this.generateLicenseKey();
                    this.registrations[originalIndex].status = 'Approved';
                    this.registrations[originalIndex].approvedAt = new Date().toISOString();
                    this.registrations[originalIndex].licenseKey = licenseKey;
                    
                    // Create approved license record
                    const approvedLicense = {
                        licenseKey: licenseKey,
                        registrationId: registration.registrationId,
                        userName: registration.userName,
                        email: registration.email,
                        phone: registration.phone,
                        company: registration.company,
                        machineId: registration.machineId,
                        approvedAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString(),
                        status: 'Active'
                    };
                    
                    this.approvedLicenses.push(approvedLicense);
                    
                    // Note: Bulk operations use mailto fallback for simplicity
                    this.openEmailClient(registration.email, 'License Approved', `Your license key: ${licenseKey}`);
                });
                
                // Save to localStorage
                localStorage.setItem('licenseRegistrations', JSON.stringify(this.registrations));
                localStorage.setItem('approvedLicenses', JSON.stringify(this.approvedLicenses));
                
                this.selectedRegistrations.clear();
                this.refreshData();
                this.showMessage('Thành công', `Đã duyệt ${pendingSelected.length} đăng ký. Vui lòng kiểm tra email client để gửi thông báo.`);
            }
        );
    }

    // Bulk reject selected registrations
    rejectSelectedRegistrations() {
        if (this.selectedRegistrations.size === 0) {
            this.showMessage('Thông báo', 'Vui lòng chọn ít nhất một đăng ký để từ chối.');
            return;
        }

        const pendingSelected = Array.from(this.selectedRegistrations).filter(i => 
            this.filteredRegistrations[i].status === 'Pending'
        );

        if (pendingSelected.length === 0) {
            this.showMessage('Thông báo', 'Không có đăng ký nào có thể từ chối trong các mục đã chọn.');
            return;
        }
        
        this.showConfirmation(
            'Xác nhận từ chối',
            `Bạn có chắc chắn muốn từ chối ${pendingSelected.length} đăng ký đã chọn?`,
            () => {
                pendingSelected.forEach(index => {
                    const registration = this.filteredRegistrations[index];
                    const originalIndex = this.registrations.findIndex(r => r.registrationId === registration.registrationId);
                    
                    this.registrations[originalIndex].status = 'Rejected';
                    this.registrations[originalIndex].rejectedAt = new Date().toISOString();
                    this.registrations[originalIndex].rejectReason = 'Bulk rejection';
                    
                    // Note: Bulk operations use mailto fallback for simplicity
                    this.openEmailClient(registration.email, 'Registration Rejected', 'Your registration has been rejected.');
                });
                
                localStorage.setItem('licenseRegistrations', JSON.stringify(this.registrations));
                
                this.selectedRegistrations.clear();
                this.refreshData();
                this.showMessage('Thành công', `Đã từ chối ${pendingSelected.length} đăng ký. Vui lòng kiểm tra email client để gửi thông báo.`);
            }
        );
    }

    showMessage(title, message) {
        // Create a simple message modal for admin
        alert(`${title}\n\n${message}`);
    }

    showConfirmation(title, message, callback) {
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        document.getElementById('confirmModal').style.display = 'flex';
        
        // Set up callback
        document.getElementById('confirmActionBtn').onclick = () => {
            callback();
            this.closeConfirmModal();
        };
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

    suspendRegistration(registrationId, reason) {
        const registration = this.registrations.find(r => r.registrationId === registrationId);
        if (registration && registration.status === 'Approved') {
            registration.status = 'Suspended';
            registration.suspendedAt = new Date().toISOString();
            registration.suspendReason = reason;
            
            this.saveRegistrations();
            return true;
        }
        return false;
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
    closeLicenseDetailModal() {
        document.getElementById('licenseDetailModal').style.display = 'none';
    }

    closeEditLicenseModal() {
        document.getElementById('editLicenseModal').style.display = 'none';
    }

    closeConfirmModal() {
        document.getElementById('confirmModal').style.display = 'none';
    }
}

// Global functions for modal management
function closeLicenseDetailModal() {
    adminPanel.closeLicenseDetailModal();
}

function closeEditLicenseModal() {
    adminPanel.closeEditLicenseModal();
}

function closeConfirmModal() {
    adminPanel.closeConfirmModal();
}

function closeApproveModal() {
    document.getElementById('approveModal').style.display = 'none';
}

function closeRejectModal() {
    document.getElementById('rejectModal').style.display = 'none';
}

function generateNewLicenseKey() {
    const newKey = adminPanel.generateLicenseKey();
    document.getElementById('approveLicenseKey').value = newKey;
}

function confirmApproveRegistration() {
    adminPanel.confirmApproveRegistration();
}

function confirmRejectRegistration() {
    adminPanel.confirmRejectRegistration();
}

function saveLicenseChanges() {
    adminPanel.saveLicenseChanges();
}

function closeSuspendModal() {
    document.getElementById('suspendModal').style.display = 'none';
}

function confirmSuspendLicense() {
    adminPanel.confirmSuspendLicense();
}

// Initialize admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.adminPanel = new AdminPanel();
});

// Handle modal clicks
document.addEventListener('click', (e) => {
    const modals = ['licenseDetailModal', 'editLicenseModal', 'confirmModal', 'approveModal', 'rejectModal', 'suspendModal'];
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
        const modals = ['licenseDetailModal', 'editLicenseModal', 'confirmModal', 'approveModal', 'rejectModal', 'suspendModal'];
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal.style.display === 'flex' || modal.style.display === 'block') {
                modal.style.display = 'none';
            }
        });
    }
});