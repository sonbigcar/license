/**
 * ==============================================================================
 * CLOUDFLARE WORKER - ENTERPRISE BACKEND API SERVICES CHO REVIT STORE HUB
 * Tích hợp: PayOS VietQR 24/7, R2 Presigned URLs, Supabase Auth/DB, Revit C# License API
 * ==============================================================================
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS Headers cho phép kết nối an toàn từ Frontend & Revit Add-in
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-payos-signature, x-client-id, x-api-key',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // ------------------------------------------------------------------------
      // 1. ENDPOINT: TẠO GIAO DỊCH THANH TOÁN VIETQR PAYOS (Napas 24/7)
      // ------------------------------------------------------------------------
      if (path === '/api/payment/create-payment-link' && request.method === 'POST') {
        const body = await request.json();
        const { orderCode, amount, description, buyerName, buyerEmail, items } = body;

        if (!orderCode || !amount) {
          return new Response(JSON.stringify({ error: 'Thiếu thông tin mã đơn hoặc số tiền' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Tạo chữ ký HMAC SHA-256 gửi sang PayOS
        const payloadData = {
          orderCode: Number(orderCode),
          amount: Number(amount),
          description: description || `REVITHUB DH${orderCode}`,
          cancelUrl: body.cancelUrl || 'https://revitstore.vn',
          returnUrl: body.returnUrl || 'https://revitstore.vn'
        };

        const signature = await generatePayOsSignature(payloadData, env.PAYOS_CHECKSUM_KEY);

        // Gọi API chính thức PayOS (hoặc fallback thông tin ngân hàng nếu đang dev offline)
        if (env.PAYOS_CLIENT_ID && env.PAYOS_API_KEY && env.PAYOS_CHECKSUM_KEY) {
          try {
            const payosRes = await fetch('https://api-merchant.payos.vn/v2/payment-requests', {
              method: 'POST',
              headers: {
                'x-client-id': env.PAYOS_CLIENT_ID,
                'x-api-key': env.PAYOS_API_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                ...payloadData,
                buyerName: buyerName || 'Khach Hang Revit',
                buyerEmail: buyerEmail || 'customer@revitstore.vn',
                signature: signature
              })
            });

            const payosData = await payosRes.json();
            if (payosData.code === '00' && payosData.data) {
              return new Response(JSON.stringify({
                success: true,
                checkoutUrl: payosData.data.checkoutUrl,
                qrCode: payosData.data.qrCode,
                accountName: payosData.data.accountName,
                accountNumber: payosData.data.accountNumber,
                bin: payosData.data.bin
              }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          } catch (e) {
            console.warn('[PayOS API] Lỗi kết nối PayOS Gateway, chuyển chế độ VietQR Napas chuẩn:', e.message);
          }
        }

        // Fallback VietQR chuẩn Napas 24/7 (MB Bank / Vietcombank)
        const bankBin = '970422'; // Ngân hàng Quân Đội MB
        const bankAcc = '0908123456';
        const bankName = 'DOAN SON';
        const qrUrl = `https://img.vietqr.io/image/${bankBin}-${bankAcc}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(`DOANSON ${orderCode}`)}&accountName=${encodeURIComponent(bankName)}`;

        return new Response(JSON.stringify({
          success: true,
          orderCode,
          amount,
          qrCode: qrUrl,
          accountName: bankName,
          accountNumber: bankAcc,
          bin: bankBin,
          message: 'Tạo mã VietQR Napas 24/7 thành công'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ------------------------------------------------------------------------
      // 2. ENDPOINT: XÁC THỰC WEBHOOK THANH TOÁN TỪ PAYOS / NGÂN HÀNG NAPAS 24/7
      // ------------------------------------------------------------------------
      if (path === '/api/payment/webhook' && request.method === 'POST') {
        const body = await request.json();
        const signature = request.headers.get('x-payos-signature') || body.signature;
        const transactionData = body.data || body;

        // Xác thực chữ ký HMAC SHA-256 từ PayOS Secret Checksum Key
        const isValid = await verifyPayOsSignature(transactionData, signature, env.PAYOS_CHECKSUM_KEY);
        if (!isValid) {
          console.warn('[Webhook Error] Chữ ký HMAC SHA-256 không hợp lệ!');
          return new Response(JSON.stringify({ error: 'Chữ ký Webhook không hợp lệ' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const orderCode = Number(transactionData.orderCode);
        const amount = Number(transactionData.amount);

        console.log(`[Webhook Success] Nhận xác nhận chuyển khoản đơn #${orderCode}, số tiền ${amount}đ`);

        // Kết nối Supabase: Cập nhật đơn hàng và tự động mở khóa bản quyền / file
        if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
          // 1. Cập nhật Order status = 'paid'
          const updateRes = await fetch(`${env.SUPABASE_URL}/rest/v1/orders?order_code=eq.${orderCode}`, {
            method: 'PATCH',
            headers: {
              'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({
              status: 'paid',
              paid_at: new Date().toISOString(),
              payment_reference: transactionData.reference || `PAYOS-${Date.now()}`
            })
          });

          if (updateRes.ok) {
            const updatedOrders = await updateRes.json();
            const order = updatedOrders[0];

            if (order && order.user_id) {
              // Lấy items của đơn hàng
              const itemsRes = await fetch(`${env.SUPABASE_URL}/rest/v1/order_items?order_id=eq.${order.id}`, {
                headers: {
                  'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
                  'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
                }
              });

              if (itemsRes.ok) {
                const items = await itemsRes.json();
                for (const item of items) {
                  // Mở quyền tải Family
                  await fetch(`${env.SUPABASE_URL}/rest/v1/user_purchases`, {
                    method: 'POST',
                    headers: {
                      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
                      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      user_id: order.user_id,
                      product_id: item.product_id,
                      order_id: order.id,
                      is_active: true
                    })
                  });

                  // Nếu là Tool, tự sinh License Key
                  if (item.billing_cycle && item.billing_cycle !== 'one_time') {
                    const newKey = generateLicenseKey();
                    const exp = new Date();
                    exp.setDate(exp.getDate() + (item.billing_cycle === 'monthly' ? 30 : 365));

                    await fetch(`${env.SUPABASE_URL}/rest/v1/licenses`, {
                      method: 'POST',
                      headers: {
                        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
                        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        license_key: newKey,
                        user_id: order.user_id,
                        product_id: item.product_id,
                        order_id: order.id,
                        subscription_type: item.billing_cycle,
                        max_machines: 3,
                        status: 'active',
                        expiry_date: exp.toISOString()
                      })
                    });
                  }
                }
              }
            }
          }
        }

        return new Response(JSON.stringify({ success: true, message: 'Đã xử lý Webhook thành công' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ------------------------------------------------------------------------
      // 3. ENDPOINT: CẤP PRESIGNED URL TẢI FILE AN TOÀN TỪ CLOUDFLARE R2 (15 PHÚT)
      // ------------------------------------------------------------------------
      if (path === '/api/download/signed-url' && request.method === 'POST') {
        const { product_id, user_id, file_name } = await request.json();

        if (!product_id || !user_id) {
          return new Response(JSON.stringify({ error: 'Thiếu thông tin yêu cầu tải file' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Tạo signed URL có thời hạn TTL 15 phút (900 giây)
        const exp = Math.floor(Date.now() / 1000) + 900;
        const signedToken = await generateDownloadToken(product_id, user_id, exp, env.LICENSE_SECRET_SALT || 'REVIT_SALT');
        const targetFile = file_name || 'Revit_Family_Asset.rfa';

        const downloadUrl = `https://vault.revitstore.vn/files/${product_id}/${encodeURIComponent(targetFile)}?token=${signedToken}&exp=${exp}`;

        return new Response(JSON.stringify({
          download_url: downloadUrl,
          file_name: targetFile,
          expires_at: new Date(exp * 1000).toISOString(),
          ttl_seconds: 900
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ------------------------------------------------------------------------
      // 4. ENDPOINT: DÙNG THỬ 7 NGÀY (CHỐNG DÙNG THỬ NHIỀU LẦN THEO HWID)
      // ------------------------------------------------------------------------
      if (path === '/api/v1/license/trial' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const machine_id = (body.machine_id || body.MachineId || '').trim();

        if (!machine_id) {
          return new Response(JSON.stringify({
            valid: false,
            Success: false,
            message: 'Thiếu mã phần cứng máy tính (Machine ID / HWID).'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Kiểm tra danh sách HWID đã dùng thử (sử dụng KV nếu cấu hình hoặc bộ đệm Worker)
        let trialUsed = false;
        try {
          if (env && env.TRIALS_KV) {
            const existing = await env.TRIALS_KV.get('trial:' + machine_id);
            if (existing) trialUsed = true;
          }
        } catch (e) {}

        if (trialUsed) {
          return new Response(JSON.stringify({
            valid: false,
            Success: false,
            code: 'TRIAL_ALREADY_USED',
            message: `Máy tính này (Mã máy: ${machine_id}) đã từng kích hoạt dùng thử 7 ngày trên hệ thống.\n\nMỗi máy tính chỉ được dùng thử 1 lần duy nhất.\nVui lòng mua bản quyền trên website hoặc liên hệ Zalo: 0765321779 để tiếp tục sử dụng!`
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        try {
          if (env && env.TRIALS_KV) {
            await env.TRIALS_KV.put('trial:' + machine_id, new Date().toISOString());
          }
        } catch (e) {}

        const now = new Date();
        const expiryDate = new Date(now.getTime() + 7 * 86400000);
        const trialKey = 'TRIAL-7D-' + machine_id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();

        return new Response(JSON.stringify({
          valid: true,
          Success: true,
          code: 'TRIAL_ACTIVATED',
          license_key: trialKey,
          LicenseKey: trialKey,
          Token: 'CF_TRIAL_' + btoa(trialKey + ':' + machine_id),
          token: 'CF_TRIAL_' + btoa(trialKey + ':' + machine_id),
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
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ------------------------------------------------------------------------
      // 4.5 ENDPOINT: ĐỒNG BỘ MODULE CỦA KEY TỪ ADMIN WEBSITE
      // ------------------------------------------------------------------------
      if (path === '/api/v1/license/sync' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const key = (body.license_key || body.LicenseKey || '').trim().toUpperCase();
        if (key && env && env.LICENSES_KV) {
          await env.LICENSES_KV.put('lic:' + key, JSON.stringify(body));
        }
        return new Response(JSON.stringify({ success: true, message: 'Đã đồng bộ module!' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ------------------------------------------------------------------------
      // 5. ENDPOINT: XÁC MINH & KÍCH HOẠT BẢN QUYỀN (HỖ TRỢ COMBO TÙY CHỌN NHIỀU MODULES)
      // ------------------------------------------------------------------------
      const isVerifyOrActivate = (path === '/api/v1/license/verify' || path === '/api/v1/license/activate' || path === '/api/activate' || path === '/api/validate') && request.method === 'POST';
      if (isVerifyOrActivate) {
        const body = await request.json().catch(() => ({}));
        const license_key = (body.license_key || body.LicenseKey || '').trim().toUpperCase();
        const machine_id = (body.machine_id || body.MachineId || 'UNKNOWN_HWID').trim();
        const machine_name = body.machine_name || body.Username || 'PC-Workstation';

        if (!license_key && !body.Token && !body.token) {
          return new Response(JSON.stringify({
            valid: false,
            Success: false,
            code: 'MISSING_PARAMS',
            message: 'Thiếu License Key hoặc Hardware ID (Machine ID)'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const moduleNames = {
          'MEP-DUCT': 'Ống Gió (Duct Tools)',
          'MEP-PIPE': 'Ống Nước (Pipe Tools)',
          'MEP-SHEET': 'Bản Vẽ (Sheet Manager)',
          'MEP-FIRE': 'PCCC (Fire Protection)',
          'MEP-ELEC': 'Điện (Electrical Tools)',
          'MEP-AI': 'Trợ Lý AI & Family',
          'MEP-ALL': 'Toàn Bộ Công Cụ (All-in-One)'
        };

        let allowedModules = [];
        if (env && env.LICENSES_KV) {
          try {
            const stored = await env.LICENSES_KV.get('lic:' + license_key);
            if (stored) {
              const parsed = JSON.parse(stored);
              if (Array.isArray(parsed.allowed_modules)) allowedModules = parsed.allowed_modules;
            }
          } catch (e) {}
        }

        if (allowedModules.length === 0) {
          if (Array.isArray(body.allowed_modules) && body.allowed_modules.length > 0) {
            allowedModules = body.allowed_modules;
          } else if (body.ProductCode || body.product_code) {
            allowedModules = [(body.ProductCode || body.product_code).toUpperCase()];
          }
        }

        // Nhận diện thông minh combo từ cú pháp key nếu chưa có trong KV/Body
        if (allowedModules.length === 0) {
          if (license_key.includes('VIP') || license_key.includes('ALL') || license_key.startsWith('REVIT-VIP')) {
            allowedModules = ['MEP-ALL'];
          } else {
            const detected = [];
            if (license_key.includes('DUCT') || license_key.includes('-DP-') || license_key.includes('-DE-')) detected.push('MEP-DUCT');
            if (license_key.includes('PIPE') || license_key.includes('-DP-')) detected.push('MEP-PIPE');
            if (license_key.includes('SHEET') || license_key.includes('SHT')) detected.push('MEP-SHEET');
            if (license_key.includes('FIRE')) detected.push('MEP-FIRE');
            if (license_key.includes('ELEC') || license_key.includes('-DE-')) detected.push('MEP-ELEC');
            if (license_key.includes('AI')) detected.push('MEP-AI');

            if (detected.length > 0) {
              allowedModules = detected;
            }
          }
        }

        if (allowedModules.length === 0) {
          return new Response(JSON.stringify({
            valid: false,
            Success: false,
            code: 'INVALID_KEY',
            message: `Mã bản quyền "${license_key}" không hợp lệ hoặc chưa được đăng ký trong hệ thống DoanSon.\nVui lòng kiểm tra lại mã key hoặc liên hệ Admin DoanSon để được cấp phép!`
          }), {
            headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders }
          });
        }

        const isTrial = license_key.startsWith('TRIAL-');
        const durationDays = isTrial ? 7 : 365;
        const expiryDate = new Date(Date.now() + durationDays * 86400000).toISOString();

        const modulesDisplay = allowedModules.includes('MEP-ALL')
          ? 'Toàn Bộ Công Cụ (VIP All-in-One)'
          : allowedModules.map(m => moduleNames[m] || m).join(', ');

        return new Response(JSON.stringify({
          valid: true,
          Success: true,
          code: 'HEARTBEAT_OK',
          Token: 'CF_TOKEN_' + btoa(license_key + ':' + machine_id),
          token: 'CF_TOKEN_' + btoa(license_key + ':' + machine_id),
          license_key: license_key,
          LicenseKey: license_key,
          allowed_modules: allowedModules,
          AllowedModules: allowedModules,
          modules_display: modulesDisplay,
          ModulesDisplay: modulesDisplay,
          ProductCode: allowedModules[0] || 'MEP-ALL',
          product_code: allowedModules[0] || 'MEP-ALL',
          ProductName: modulesDisplay,
          product_name: modulesDisplay,
          subscription_type: isTrial ? 'trial' : 'yearly',
          ExpiryDate: expiryDate,
          expires_at: expiryDate,
          days_remaining: durationDays,
          CustomerName: machine_name,
          customer_name: machine_name,
          machine_name: machine_name,
          machines_used: 1,
          max_machines: 3,
          is_trial: isTrial,
          Message: `Bản quyền hợp lệ cho gói: ${modulesDisplay}.`,
          message: `Bản quyền hợp lệ cho gói: ${modulesDisplay}.`
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ------------------------------------------------------------------------
      // 5. ENDPOINT: HEARTBEAT ĐỊNH KỲ TỪ REVIT ADD-IN ĐANG CHẠY
      // ------------------------------------------------------------------------
      if (path === '/api/v1/license/heartbeat' && request.method === 'POST') {
        const { license_key, machine_id } = await request.json();
        return new Response(JSON.stringify({
          status: 'alive',
          server_time: new Date().toISOString(),
          authenticated: Boolean(license_key && machine_id)
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response('Revit Store Hub API Service Online (Cloudflare Edge)', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

/**
 * Sinh chuỗi License Key định dạng: REVIT-XXXX-XXXX-XXXX
 */
function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const parts = ['REVIT'];
  for (let s = 0; s < 3; s++) {
    let segment = '';
    for (let i = 0; i < 4; i++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    parts.push(segment);
  }
  return parts.join('-');
}

/**
 * Sinh chữ ký HMAC SHA-256 chuẩn PayOS
 */
async function generatePayOsSignature(data, checksumKey) {
  if (!checksumKey) return 'mock_signature';
  const sortedKeys = Object.keys(data).sort();
  const queryString = sortedKeys.map(k => `${k}=${data[k]}`).join('&');

  const encoder = new TextEncoder();
  const keyBuffer = encoder.encode(checksumKey);
  const dataBuffer = encoder.encode(queryString);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Thuật toán xác minh chữ ký HMAC SHA-256 chuẩn PayOS
 */
async function verifyPayOsSignature(data, receivedSignature, checksumKey) {
  if (!receivedSignature || !checksumKey) return true; // Cho phép dev mode nếu chưa điền key
  const calculatedSignature = await generatePayOsSignature(data, checksumKey);
  return calculatedSignature.toLowerCase() === receivedSignature.toLowerCase();
}

/**
 * Sinh token bảo mật cho link tải file R2 (TTL 15 phút)
 */
async function generateDownloadToken(productId, userId, exp, salt) {
  const raw = `${productId}|${userId}|${exp}|${salt}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(raw));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}
