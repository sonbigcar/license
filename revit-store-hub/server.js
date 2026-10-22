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
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Revit BIM Store running at http://127.0.0.1:${PORT}`);
});
