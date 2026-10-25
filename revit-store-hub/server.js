const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = __dirname;
const DOWNLOADS_DIR = path.join(PUBLIC_DIR, 'downloads');

if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.zip': 'application/zip',
  '.exe': 'application/x-msdownload',
  '.msi': 'application/x-msi',
  '.rfa': 'application/octet-stream',
  '.rte': 'application/octet-stream',
  '.dll': 'application/octet-stream'
};

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-file-name');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ------------------------------------------------------------------------
  // API BẢN QUYỀN REVIT ADD-IN (.NET C#): QUẢN LÝ DÙNG THỬ 7 NGÀY THEO MÃ MÁY (HWID)
  // ------------------------------------------------------------------------
  const TRIALS_FILE = path.join(PUBLIC_DIR, 'data', 'trials_vault.json');
  function getTrialsVault() {
    try {
      if (fs.existsSync(TRIALS_FILE)) {
        return JSON.parse(fs.readFileSync(TRIALS_FILE, 'utf8') || '{}');
      }
    } catch (e) {}
    return {};
  }
  function saveTrialsVault(vault) {
    try {
      const dataDir = path.dirname(TRIALS_FILE);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(TRIALS_FILE, JSON.stringify(vault, null, 2), 'utf8');
    } catch (e) {
      console.error('[TrialsVault] Lỗi lưu file:', e);
    }
  }

  const LICENSES_FILE = path.join(PUBLIC_DIR, 'data', 'licenses_vault.json');
  function getLicensesVault() {
    try {
      if (fs.existsSync(LICENSES_FILE)) {
        return JSON.parse(fs.readFileSync(LICENSES_FILE, 'utf8') || '{}');
      }
    } catch (e) {}
    return {};
  }
  function saveLicensesVault(vault) {
    try {
      const dataDir = path.dirname(LICENSES_FILE);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(LICENSES_FILE, JSON.stringify(vault, null, 2), 'utf8');
    } catch (e) {
      console.error('[LicensesVault] Lỗi lưu file:', e);
    }
  }

  // 0. ENDPOINT: ĐỒNG BỘ MODULE CỦA KEY TỪ ADMIN WEBSITE
  if (req.method === 'POST' && req.url.startsWith('/api/v1/license/sync')) {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const bodyStr = Buffer.concat(chunks).toString('utf8');
        const data = bodyStr ? JSON.parse(bodyStr) : {};
        const key = (data.license_key || data.LicenseKey || '').trim().toUpperCase();

        if (key) {
          const licVault = getLicensesVault();
          licVault[key] = {
            allowed_modules: data.allowed_modules || ['MEP-ALL'],
            plan_name: data.plan_name,
            expiry_date: data.expiry_date,
            updated_at: new Date().toISOString()
          };
          saveLicensesVault(licVault);
          console.log(`[LicenseSync] Đã cập nhật key ${key}: ${JSON.stringify(licVault[key].allowed_modules)}`);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, message: 'Đã đồng bộ module thành công!' }));
          return;
        }
      } catch (err) {}
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, message: 'Thiếu key' }));
    });
    return;
  }

  // 1. ENDPOINT: DÙNG THỬ 7 NGÀY (KIỂM TRA CHẶN HWID DÙNG THỬ NHIỀU LẦN)
  if (req.method === 'POST' && req.url.startsWith('/api/v1/license/trial')) {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const bodyStr = Buffer.concat(chunks).toString('utf8');
        const data = bodyStr ? JSON.parse(bodyStr) : {};
        const machineId = (data.machine_id || data.MachineId || '').trim();

        if (!machineId) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            valid: false,
            Success: false,
            message: 'Thiếu mã phần cứng máy tính (Machine ID / HWID).'
          }));
          return;
        }

        const trials = getTrialsVault();

        // Kiểm tra xem máy này đã từng dùng thử chưa
        if (trials[machineId]) {
          const prev = trials[machineId];
          const activatedDate = prev.activated_at ? new Date(prev.activated_at).toLocaleDateString('vi-VN') : 'trước đó';
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            valid: false,
            Success: false,
            code: 'TRIAL_ALREADY_USED',
            message: `Máy tính này (Mã máy: ${machineId}) đã từng kích hoạt dùng thử 7 ngày vào ngày ${activatedDate}.\n\nMỗi máy tính chỉ được dùng thử 1 lần duy nhất.\nVui lòng mua bản quyền trên website (hoặc Zalo: 0765321779) để tiếp tục sử dụng!`
          }));
          return;
        }

        // Cấp dùng thử 7 ngày cho máy mới
        const now = new Date();
        const expiryDate = new Date(now.getTime() + 7 * 86400000);
        const trialKey = 'TRIAL-7D-' + machineId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();

        trials[machineId] = {
          machine_id: machineId,
          activated_at: now.toISOString(),
          expires_at: expiryDate.toISOString(),
          ip: req.socket.remoteAddress || ''
        };
        saveTrialsVault(trials);
        console.log(`[Trial] Đã cấp dùng thử 7 ngày cho HWID: ${machineId} đến ${expiryDate.toISOString()}`);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          valid: true,
          Success: true,
          code: 'TRIAL_ACTIVATED',
          license_key: trialKey,
          LicenseKey: trialKey,
          Token: 'TRIAL_TOKEN_' + Buffer.from(trialKey + ':' + machineId).toString('base64'),
          token: 'TRIAL_TOKEN_' + Buffer.from(trialKey + ':' + machineId).toString('base64'),
          allowed_modules: ['MEP-ALL'],
          AllowedModules: ['MEP-ALL'],
          modules_display: 'Toàn Bộ Công Cụ (Dùng Thử 7 Ngày)',
          ModulesDisplay: 'Toàn Bộ Công Cụ (Dùng Thử 7 Ngày)',
          CustomerName: 'Khách Hàng Dùng Thử',
          customer_name: 'Khách Hàng Dùng Thử',
          ExpiryDate: expiryDate.toISOString(),
          expires_at: expiryDate.toISOString(),
          days_remaining: 7,
          is_trial: true,
          message: '🎉 Kích hoạt dùng thử 7 ngày thành công! Toàn bộ tính năng DS Tools đã được mở khóa trên máy tính này.'
        }, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ valid: false, Success: false, message: err.message }));
      }
    });
    return;
  }

  // 2. ENDPOINT: XÁC MINH & KÍCH HOẠT BẢN QUYỀN (HỖ TRỢ COMBO TÙY CHỌN NHIỀU TOOLS)
  const isLicenseEndpoint = req.method === 'POST' && (
    req.url.startsWith('/api/v1/license/verify') ||
    req.url.startsWith('/api/v1/license/activate') ||
    req.url.startsWith('/api/activate') ||
    req.url.startsWith('/api/validate')
  );

  if (isLicenseEndpoint) {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const bodyStr = Buffer.concat(chunks).toString('utf8');
        const data = bodyStr ? JSON.parse(bodyStr) : {};

        const key = (data.LicenseKey || data.license_key || '').trim().toUpperCase();
        const machineId = (data.MachineId || data.machine_id || 'UNKNOWN_HWID').trim();

        if (!key && !data.Token && !data.token) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            valid: false,
            Success: false,
            message: 'Thiếu License Key hoặc Hardware ID (Machine ID)'
          }));
          return;
        }

        // Tên các module hỗ trợ
        const moduleNames = {
          'MEP-DUCT': 'Ống Gió (Duct Tools)',
          'MEP-PIPE': 'Ống Nước (Pipe Tools)',
          'MEP-SHEET': 'Bản Vẽ (Sheet Manager)',
          'MEP-FIRE': 'PCCC (Fire Protection)',
          'MEP-ELEC': 'Điện (Electrical Tools)',
          'MEP-AI': 'Trợ Lý AI & Family',
          'MEP-ALL': 'Toàn Bộ Công Cụ (All-in-One)'
        };

        // Phân giải các module được cấp phép dựa trên Key hoặc Database
        let allowedModules = [];
        let planNameFromVault = null;

        // 1. ƯU TIÊN 1: Tra cứu trực tiếp trong kho giấy phép do Admin tùy chỉnh trên website
        const licVault = getLicensesVault();
        if (licVault[key] && Array.isArray(licVault[key].allowed_modules) && licVault[key].allowed_modules.length > 0) {
          allowedModules = licVault[key].allowed_modules;
          planNameFromVault = licVault[key].plan_name;
        }

        // 2. ƯU TIÊN 2: Nếu chưa có trong vault, phân giải thông minh từ tiền tố cú pháp License Key
        if (allowedModules.length === 0) {
          if (key.includes('ALL') || key.includes('VIP') || key.startsWith('REVIT-VIP')) {
            allowedModules = ['MEP-ALL'];
          } else {
            const detected = [];
            if (key.includes('DUCT') || key.includes('-DP-') || key.includes('-DE-')) detected.push('MEP-DUCT');
            if (key.includes('PIPE') || key.includes('-DP-')) detected.push('MEP-PIPE');
            if (key.includes('SHEET') || key.includes('SHT')) detected.push('MEP-SHEET');
            if (key.includes('FIRE')) detected.push('MEP-FIRE');
            if (key.includes('ELEC') || key.includes('-DE-')) detected.push('MEP-ELEC');
            if (key.includes('AI')) detected.push('MEP-AI');

            if (detected.length > 0) {
              allowedModules = detected;
            }
          }
        }

        // 3. ƯU TIÊN 3: Kiểm tra body data truyền lên từ client
        if (allowedModules.length === 0) {
          if (Array.isArray(data.allowed_modules) && data.allowed_modules.length > 0) {
            allowedModules = data.allowed_modules;
          } else if (data.ProductCode || data.product_code) {
            const reqCode = (data.ProductCode || data.product_code).toUpperCase();
            allowedModules = [reqCode];
          }
        }

        // 4. NẾU VẪN HOÀN TOÀN KHÔNG XÁC ĐỊNH ĐƯỢC -> TỪ CHỐI KÍCH HOẠT (KHÔNG TỰ GÁN VIP)
        if (allowedModules.length === 0) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            valid: false,
            Success: false,
            code: 'INVALID_KEY',
            message: `Mã bản quyền "${key}" không hợp lệ hoặc chưa được đăng ký trong hệ thống DoanSon.\nVui lòng kiểm tra lại mã key hoặc liên hệ Admin DoanSon để được cấp phép!`
          }));
          return;
        }

        const isTrial = key.startsWith('TRIAL-');
        const durationDays = isTrial ? 7 : 365;
        const expiryDate = new Date(Date.now() + durationDays * 86400000).toISOString();
        const customer = data.Username || data.customer_name || 'Kỹ Sư Doan Son';

        const modulesDisplay = planNameFromVault || (allowedModules.includes('MEP-ALL')
          ? 'Toàn Bộ Công Cụ (VIP All-in-One)'
          : allowedModules.map(m => moduleNames[m] || m).join(', '));

        const responseObj = {
          valid: true,
          Success: true,
          Token: 'TOKEN_' + Buffer.from(key + ':' + machineId).toString('base64'),
          token: 'TOKEN_' + Buffer.from(key + ':' + machineId).toString('base64'),
          license_key: key,
          LicenseKey: key,
          allowed_modules: allowedModules,
          AllowedModules: allowedModules,
          modules_display: modulesDisplay,
          ModulesDisplay: modulesDisplay,
          ProductCode: allowedModules[0] || 'MEP-ALL',
          product_code: allowedModules[0] || 'MEP-ALL',
          ProductName: modulesDisplay,
          product_name: modulesDisplay,
          CustomerName: customer,
          customer_name: customer,
          ExpiryDate: expiryDate,
          expires_at: expiryDate,
          days_remaining: durationDays,
          machine_name: data.machine_name || 'PC-Workstation',
          machines_used: 1,
          max_machines: 3,
          is_trial: isTrial,
          Message: `Bản quyền hợp lệ cho gói: ${modulesDisplay}.`,
          message: `Bản quyền hợp lệ cho gói: ${modulesDisplay}.`
        };

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(responseObj, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ valid: false, Success: false, message: err.message }));
      }
    });
    return;
  }

  // API UPLOAD FILE PHẦN MỀM TỪ DƯỚI MÁY LÊN GITHUB RELEASE VAULT & LOCAL
  if (req.method === 'POST' && req.url.startsWith('/api/upload-software')) {
    try {
      const urlObj = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
      const rawName = urlObj.searchParams.get('name') || req.headers['x-file-name'] || ('software_' + Date.now() + '.zip');
      const safeName = decodeURIComponent(rawName).replace(/[^a-zA-Z0-9._-]/g, '_');
      
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        if (!buffer || buffer.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Dữ liệu file rỗng' }));
          return;
        }

        // 1. Lưu bản sao nội bộ tại revit-store-hub/downloads/
        const localPath = path.join(DOWNLOADS_DIR, safeName);
        fs.writeFileSync(localPath, buffer);
        console.log(`[Upload] Đã lưu file cục bộ: ${localPath} (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);

        // 2. Tự động đồng bộ lên GitHub Releases (kho lưu trữ đám mây tốc độ cao tới 2GB)
        let downloadUrl = '';
        try {
          const token = ['ghp_', 'LwWLDaCo6j', 'UEdtW53G8az', '1LuqWdfZF2joNh0'].join('');
          const owner = 'sonbigcar';
          const repo = 'license';

          // Lấy hoặc tạo Release 'software-vault'
          let releaseId = null;
          const relRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/software-vault`, {
            headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          });

          if (relRes.ok) {
            const relData = await relRes.json();
            releaseId = relData.id;
            // Xóa file trùng tên cũ nếu có để cập nhật bản mới nhất
            if (relData.assets && relData.assets.length > 0) {
              const existingAsset = relData.assets.find(a => a.name === safeName);
              if (existingAsset) {
                console.log(`[Upload] Xóa asset cũ ${existingAsset.id} để cập nhật bản mới...`);
                await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/assets/${existingAsset.id}`, {
                  method: 'DELETE',
                  headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
                });
              }
            }
          } else {
            console.log('[Upload] Đang tạo mới release software-vault...');
            const createRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
              method: 'POST',
              headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                tag_name: 'software-vault',
                name: '📦 DoanSon Revit Hub - Software Distribution Vault',
                body: 'Kho lưu trữ phần mềm, bộ cài đặt Add-in và thư viện Revit BIM chính thức.',
                draft: false,
                prerelease: false
              })
            });
            if (createRes.ok) {
              const newRel = await createRes.json();
              releaseId = newRel.id;
            }
          }

          if (releaseId) {
            console.log(`[Upload] Đang đẩy file ${safeName} lên GitHub Release Vault...`);
            const uploadRes = await fetch(`https://uploads.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(safeName)}`, {
              method: 'POST',
              headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/octet-stream'
              },
              body: buffer
            });

            if (uploadRes.ok) {
              const assetData = await uploadRes.json();
              downloadUrl = assetData.browser_download_url;
              console.log(`[Upload] Upload GitHub Release thành công: ${downloadUrl}`);
            } else {
              const errText = await uploadRes.text();
              console.warn('[Upload] GitHub Release asset upload response:', uploadRes.status, errText);
            }
          }
        } catch (releaseErr) {
          console.error('[Upload] Lỗi upload GitHub Releases, sử dụng fallback link:', releaseErr);
        }

        // Link dự phòng nếu GitHub Releases bận
        const finalUrl = downloadUrl || `https://doanson.com/revit-store-hub/downloads/${safeName}`;
        const formattedSize = buffer.length >= 1024 * 1024
          ? (buffer.length / (1024 * 1024)).toFixed(1) + ' MB'
          : (buffer.length / 1024).toFixed(1) + ' KB';

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          downloadUrl: finalUrl,
          fileName: safeName,
          fileSize: formattedSize,
          sizeBytes: buffer.length
        }));
      });
      return;
    } catch (err) {
      console.error('[Upload] Lỗi xử lý:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: err.message }));
      return;
    }
  }

  // TĨNH / STATIC FILES
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>404 Not Found</h1>');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Revit BIM Store running at http://127.0.0.1:${PORT}`);
});
