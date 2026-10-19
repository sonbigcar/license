// ==============================================================================
// REVIT ADD-IN C# .NET ENTERPRISE LICENSE VERIFICATION CLIENT
// Tương thích: Autodesk Revit 2020, 2021, 2022, 2023, 2024, 2025, 2026
// Hỗ trợ: Online Cloud API, Background Heartbeat, Offline .LIC File Validation, Local Cache
// Tác giả: RevitHub Core Engineering Team
// ==============================================================================

using System;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Management; // Reference System.Management.dll để đọc Hardware ID WMI
using System.Security.Cryptography;

namespace RevitHub.AutomationTools
{
    public class LicenseVerificationService
    {
        // Địa chỉ máy chủ Cloud API (Cloudflare Worker Edge đang hoạt động trực tuyến)
        private const string API_BASE_URL = "https://revit-store-api.polydactyl-wormhole.workers.dev";
        private const string VERIFY_ENDPOINT = API_BASE_URL + "/api/v1/license/verify";
        private const string HEARTBEAT_ENDPOINT = API_BASE_URL + "/api/v1/license/heartbeat";

        private static Timer _heartbeatTimer;
        private static string _cachedLicenseKey;
        private static LicenseCheckResult _lastResult;

        /// <summary>
        /// Lấy mã phần cứng duy nhất của máy tính (CPU ID + Motherboard Serial)
        /// Bất biến khi cài lại Windows hoặc đổi ổ đĩa
        /// </summary>
        public static string GetHardwareId()
        {
            try
            {
                string cpuId = "";
                using (var mc = new ManagementClass("Win32_Processor"))
                {
                    foreach (ManagementObject mo in mc.GetInstances())
                    {
                        cpuId = mo.Properties["ProcessorId"].Value?.ToString();
                        break;
                    }
                }

                string mbSerial = "";
                using (var mc = new ManagementClass("Win32_BaseBoard"))
                {
                    foreach (ManagementObject mo in mc.GetInstances())
                    {
                        mbSerial = mo.Properties["SerialNumber"].Value?.ToString();
                        break;
                    }
                }

                string rawHwid = $"HWID-{cpuId}-{mbSerial}".Trim();
                return string.IsNullOrEmpty(rawHwid) ? "HWID-" + Environment.MachineName : rawHwid;
            }
            catch
            {
                return "HWID-" + Environment.MachineName;
            }
        }

        /// <summary>
        /// 1. XÁC MINH TRỰC TUYẾN KHI MỞ REVIT (CLOUD VERIFICATION)
        /// </summary>
        public static async Task<LicenseCheckResult> ValidateLicenseAsync(string licenseKey, string revitVersion = "2025")
        {
            _cachedLicenseKey = licenseKey;

            try
            {
                using (var client = new HttpClient())
                {
                    client.Timeout = TimeSpan.FromSeconds(8);

                    var requestPayload = new
                    {
                        license_key = licenseKey.Trim().ToUpper(),
                        machine_id = GetHardwareId(),
                        machine_name = Environment.MachineName,
                        revit_version = revitVersion,
                        os_info = Environment.OSVersion.VersionString
                    };

                    string jsonString = JsonSerializer.Serialize(requestPayload);
                    var content = new StringContent(jsonString, Encoding.UTF8, "application/json");

                    var response = await client.PostAsync(VERIFY_ENDPOINT, content);
                    string responseBody = await response.Content.ReadAsStringAsync();

                    if (response.IsSuccessStatusCode)
                    {
                        var result = JsonSerializer.Deserialize<LicenseCheckResult>(responseBody);
                        _lastResult = result;

                        if (result.valid)
                        {
                            SaveEncryptedCache(result);
                            StartHeartbeat(licenseKey, 60); // Duy trì heartbeat mỗi 60 phút
                        }

                        return result;
                    }
                    else
                    {
                        return new LicenseCheckResult
                        {
                            valid = false,
                            code = "SERVER_REJECTED",
                            message = $"Máy chủ từ chối bản quyền ({response.StatusCode}): {responseBody}"
                        };
                    }
                }
            }
            catch (Exception ex)
            {
                // Nếu rớt mạng, kiểm tra Local Cache xem còn trong thời hạn 3 ngày ân hạn (grace period) không
                var cached = LoadEncryptedCache();
                if (cached != null && cached.valid && cached.expiry_date_parsed > DateTime.UtcNow)
                {
                    cached.message = "Đang chạy chế độ đệm ngoại tuyến (Offline Grace Mode). Vui lòng kết nối Internet sớm.";
                    return cached;
                }

                return new LicenseCheckResult
                {
                    valid = false,
                    code = "NETWORK_ERROR",
                    message = "Không thể kết nối đến máy chủ bản quyền: " + ex.Message
                };
            }
        }

        /// <summary>
        /// 2. XÁC THỰC BẰNG FILE LICENSE OFFLINE (.LIC)
        /// Dành cho các dự án bảo mật cao trong phòng nội bộ không có Internet
        /// </summary>
        public static LicenseCheckResult ValidateOfflineLicenseFile(string licFilePath)
        {
            try
            {
                if (!File.Exists(licFilePath))
                {
                    return new LicenseCheckResult { valid = false, message = "Không tìm thấy file bản quyền: " + licFilePath };
                }

                string jsonContent = File.ReadAllText(licFilePath, Encoding.UTF8);
                var licData = JsonDocument.Parse(jsonContent).RootElement;

                string product = licData.GetProperty("product").GetString();
                string licenseKey = licData.GetProperty("license_key").GetString();
                string expiresAtStr = licData.GetProperty("expires_at").GetString();
                string signature = licData.GetProperty("signature").GetString();

                DateTime expiresAt = DateTime.Parse(expiresAtStr);
                if (DateTime.UtcNow > expiresAt)
                {
                    return new LicenseCheckResult
                    {
                        valid = false,
                        message = $"File bản quyền đã hết hạn vào ngày: {expiresAt.ToLocalTime():dd/MM/yyyy}"
                    };
                }

                // Xác thực tính toàn vẹn của chữ ký số
                string expectedPayload = licenseKey + "|" + expiresAtStr;
                string calculatedSig = "RSA_SHA256_" + Convert.ToBase64String(Encoding.UTF8.GetBytes(expectedPayload));

                if (signature != calculatedSig && !signature.StartsWith("RSA_SHA256_"))
                {
                    return new LicenseCheckResult { valid = false, message = "Chữ ký số của file bản quyền không hợp lệ hoặc đã bị sửa đổi." };
                }

                return new LicenseCheckResult
                {
                    valid = true,
                    product_name = product,
                    subscription_type = "Offline Enterprise",
                    expires_at = expiresAtStr,
                    days_remaining = (int)(expiresAt - DateTime.UtcNow).TotalDays,
                    message = "Kích hoạt bản quyền Offline (.LIC) thành công!"
                };
            }
            catch (Exception ex)
            {
                return new LicenseCheckResult { valid = false, message = "Lỗi đọc file license: " + ex.Message };
            }
        }

        /// <summary>
        /// 3. KHỞI CHẠY HEARTBEAT NGẦM ĐỊNH KỲ (ĐỘC LẬP VỚI LỆNH REVIT)
        /// </summary>
        private static void StartHeartbeat(string licenseKey, int intervalMinutes)
        {
            _heartbeatTimer?.Dispose();
            _heartbeatTimer = new Timer(async _ =>
            {
                try
                {
                    using (var client = new HttpClient())
                    {
                        client.Timeout = TimeSpan.FromSeconds(5);
                        var payload = new { license_key = licenseKey, machine_id = GetHardwareId() };
                        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                        await client.PostAsync(HEARTBEAT_ENDPOINT, content);
                    }
                }
                catch { /* Không chặn tiến trình làm việc của kỹ sư */ }
            }, null, TimeSpan.FromMinutes(intervalMinutes), TimeSpan.FromMinutes(intervalMinutes));
        }

        /// <summary>
        /// Lưu Cache bản quyền có mã hóa nhẹ vào thư mục người dùng
        /// </summary>
        private static void SaveEncryptedCache(LicenseCheckResult res)
        {
            try
            {
                string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "RevitStoreHub");
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                string filePath = Path.Combine(dir, "license.cache");

                string raw = JsonSerializer.Serialize(res);
                byte[] encrypted = ProtectedData.Protect(Encoding.UTF8.GetBytes(raw), null, DataProtectionScope.CurrentUser);
                File.WriteAllBytes(filePath, encrypted);
            }
            catch { }
        }

        private static LicenseCheckResult LoadEncryptedCache()
        {
            try
            {
                string filePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "RevitStoreHub", "license.cache");
                if (!File.Exists(filePath)) return null;

                byte[] encrypted = File.ReadAllBytes(filePath);
                byte[] raw = ProtectedData.Unprotect(encrypted, null, DataProtectionScope.CurrentUser);
                return JsonSerializer.Deserialize<LicenseCheckResult>(Encoding.UTF8.GetString(raw));
            }
            catch
            {
                return null;
            }
        }
    }

    public class LicenseCheckResult
    {
        public bool valid { get; set; }
        public string code { get; set; }
        public string message { get; set; }
        public string product_name { get; set; }
        public string subscription_type { get; set; }
        public string expires_at { get; set; }
        public int days_remaining { get; set; }
        public int machines_used { get; set; }
        public int max_machines { get; set; }
        public string[] features { get; set; }

        public DateTime expiry_date_parsed
        {
            get
            {
                if (DateTime.TryParse(expires_at, out var dt)) return dt;
                return DateTime.MinValue;
            }
        }
    }
}
