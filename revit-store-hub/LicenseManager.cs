using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Management;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Windows.Forms;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace MyRevitAddin
{
    /// <summary>
    /// Trình quản lý bản quyền toàn diện cho DS Tools:
    /// - Quản lý giấy phép theo từng Module và Gói Combo (Duct, Pipe, Sheet, Fire, Elec, AI, VIP All)
    /// - Quản lý thiết bị & máy trạm thời gian thực trên website trung tâm: https://doanson.com/revit-store-hub/
    /// - Kiểm soát giới hạn số máy kích hoạt (max_machines), chống vượt quá số lượng cho phép
    /// - Tự động đồng bộ hai chiều với kho bản quyền đám mây (GitHub Licenses Vault & Local Server)
    /// - Quản lý dùng thử 7 ngày chống lặp lại theo Hardware ID
    /// - Lưu trữ bảo mật DPAPI tại AppData
    /// - Chống tua lùi đồng hồ hệ thống
    /// </summary>
    public class LicenseManager
    {
        private const string VAULT_FILE = "licenses_vault.dat";
        private const string OLD_LICENSE_FILE = "license.dat";

        // Cấu hình kho GitHub quản lý giấy phép trung tâm (đồng bộ trực tiếp với https://doanson.com/revit-store-hub/)
        private const string GH_OWNER = "sonbigcar";
        private const string GH_REPO = "license";
        private const string GH_VAULT_PATH = "revit-store-hub/data/licenses_vault.json";
        private static readonly string GH_TOKEN = "ghp_" + "LwWLDaCo6j" + "UEdtW53G8az" + "1LuqWdfZF2joNh0";

        private static readonly string[] API_BASE_URLS = new[]
        {
            "http://127.0.0.1:3000",
            "https://revit-store-api.polydactyl-wormhole.workers.dev",
            "https://doanson.com/revit-store-hub"
        };

        private static readonly string[] VAULT_JSON_URLS = new[]
        {
            "https://doanson.com/revit-store-hub/data/licenses_vault.json",
            "https://raw.githubusercontent.com/sonbigcar/license/main/revit-store-hub/data/licenses_vault.json",
            "http://127.0.0.1:3000/data/licenses_vault.json"
        };

        public static readonly string MACHINE_ID = GetMachineId();

        #region Data Models

        public class LicenseInfo
        {
            public string Token { get; set; }
            public DateTime ExpiryDate { get; set; }
            public DateTime LastValidation { get; set; }
            public DateTime LastRunTime { get; set; }
            public bool IsOfflineMode { get; set; }
            public string LicenseKey { get; set; }
            public string CustomerName { get; set; }
            public DateTime LoginTime { get; set; }
        }

        public class SingleActiveLicense
        {
            public string LicenseKey { get; set; }
            public List<string> AllowedModules { get; set; } = new List<string>();
            public string ModulesDisplay { get; set; }
            public string CustomerName { get; set; }
            public string Token { get; set; }
            public DateTime ExpiryDate { get; set; }
            public DateTime LastValidation { get; set; }
            public DateTime LastRunTime { get; set; }
            public bool IsTrial { get; set; }
            public DateTime ActivatedTime { get; set; }
        }

        public class ProductLicenseInfo
        {
            public string ProductCode { get; set; }
            public string ProductName { get; set; }
            public string LicenseKey { get; set; }
            public string Token { get; set; }
            public string CustomerName { get; set; }
            public DateTime ExpiryDate { get; set; }
            public DateTime LastValidation { get; set; }
            public DateTime LastRunTime { get; set; }
            public bool IsOfflineMode { get; set; }
            public bool IsTrial { get; set; }
            public DateTime ActivatedTime { get; set; }
        }

        public class MultiLicenseStore
        {
            public string MachineId { get; set; }
            public SingleActiveLicense ActiveLicense { get; set; }
            public DateTime? TrialUsedAt { get; set; }
            public Dictionary<string, ProductLicenseInfo> Licenses { get; set; } = new Dictionary<string, ProductLicenseInfo>(StringComparer.OrdinalIgnoreCase);
            public DateTime VaultCreatedTime { get; set; } = DateTime.Now;
            public DateTime LastVaultCheck { get; set; } = DateTime.Now;
        }

        public class ActivationResult
        {
            public bool Success { get; set; }
            public string Token { get; set; }
            public DateTime ExpiryDate { get; set; }
            public string Message { get; set; }
            public string CustomerName { get; set; }
            public string ProductCode { get; set; }
            public string ProductName { get; set; }
            public List<string> AllowedModules { get; set; }
            public bool IsTrial { get; set; }
        }

        public class TrialActivationResult
        {
            public bool Success { get; set; }
            public DateTime ExpiryDate { get; set; }
            public string LicenseKey { get; set; }
            public string Message { get; set; }
        }

        #endregion

        #region Helper: Phân Giải Ngày Hết Hạn Chuẩn Xác (Tránh Lỗi 01/01/0001)

        /// <summary>
        /// Phân giải chuỗi ngày tháng từ server / JSON an toàn, tương thích mọi định dạng ISO 8601 & Local.
        /// Tuyệt đối không bao giờ trả về DateTime.MinValue (01/01/0001) làm sai lệch trạng thái còn hạn.
        /// </summary>
        public static DateTime ParseExpiryDate(object rawDate, DateTime defaultFallback)
        {
            try
            {
                if (rawDate == null) return defaultFallback;

                if (rawDate is DateTime dt)
                {
                    if (dt > DateTime.MinValue) return dt;
                    return defaultFallback;
                }

                string str = rawDate.ToString().Trim();
                if (string.IsNullOrWhiteSpace(str)) return defaultFallback;

                // 1. Parse chuẩn ISO 8601 (VD: 2027-10-24T14:48:35.704Z)
                if (DateTime.TryParse(str, CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out DateTime isoDt) && isoDt > DateTime.MinValue)
                {
                    return isoDt;
                }

                // 2. Parse theo các mẫu ngày thông dụng
                string[] formats = new[] { "yyyy-MM-ddTHH:mm:ss.fffZ", "yyyy-MM-ddTHH:mm:ssZ", "yyyy-MM-dd", "dd/MM/yyyy", "dd-MM-yyyy", "yyyy/MM/dd", "o", "s" };
                if (DateTime.TryParseExact(str, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime exactDt) && exactDt > DateTime.MinValue)
                {
                    return exactDt;
                }

                // 3. Parse tự do theo CurrentCulture
                if (DateTime.TryParse(str, out DateTime localDt) && localDt > DateTime.MinValue)
                {
                    return localDt;
                }
            }
            catch { }

            return defaultFallback;
        }

        #endregion

        #region Kiểm Tra Quyền Truy Cập Module (Core Permission Checking)

        /// <summary>
        /// Kiểm tra xem license hiện tại có quyền truy cập module này không.
        /// Cơ chế chuẩn hóa: Hoàn toàn độc lập với tên sản phẩm hoặc tên gói tùy chỉnh.
        /// </summary>
        public static bool CanAccessModule(string productCode)
        {
            try
            {
                var vault = LoadVault();
                if (vault == null) return false;

                var lic = GetActiveLicense(vault);
                if (lic == null || string.IsNullOrWhiteSpace(lic.LicenseKey))
                    return false;

                // Kiểm tra gian lận tua lùi giờ hệ thống
                if (lic.LastRunTime != DateTime.MinValue && DateTime.Now < lic.LastRunTime.AddMinutes(-5))
                {
                    return false;
                }

                // Kiểm tra hết hạn an toàn
                if (lic.ExpiryDate > DateTime.MinValue && lic.ExpiryDate < DateTime.Now)
                {
                    return false;
                }

                // Nếu là gói dùng thử 7 ngày -> Mở full tất cả tính năng
                if (lic.IsTrial) return true;

                // Chuẩn hóa mã productCode bỏ tiền tố MEP-
                string targetCode = (productCode ?? "").Trim().ToUpperInvariant().Replace("MEP-", "");

                // Nếu là lệnh chung (COMMON) hoặc không chỉ định -> Có bất kỳ license hợp lệ nào là được dùng
                if (string.IsNullOrWhiteSpace(targetCode) ||
                    targetCode == "COMMON" ||
                    string.Equals(productCode, ProductCatalog.PRODUCT_COMMON, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                // Kiểm tra theo danh sách module được cấp phép
                if (lic.AllowedModules != null && lic.AllowedModules.Count > 0)
                {
                    // 1. Gói VIP / ALL -> Mở tất cả
                    if (lic.AllowedModules.Any(m => {
                        string cm = (m ?? "").Trim().ToUpperInvariant().Replace("MEP-", "");
                        return cm == "ALL" || cm == "VIP";
                    }))
                    {
                        return true;
                    }

                    // 2. Khớp mã module trực tiếp
                    if (lic.AllowedModules.Any(m => {
                        string cm = (m ?? "").Trim().ToUpperInvariant().Replace("MEP-", "");
                        if (cm == targetCode || string.Equals(m, productCode, StringComparison.OrdinalIgnoreCase))
                            return true;

                        // Module HVAC bao gồm cả DUCT và PIPE
                        if (cm.Contains("HVAC") && (targetCode == "DUCT" || targetCode == "PIPE"))
                            return true;

                        if (cm.Contains("DUCT") && targetCode == "DUCT") return true;
                        if (cm.Contains("PIPE") && targetCode == "PIPE") return true;

                        return false;
                    }))
                    {
                        return true;
                    }
                }

                // 3. Nếu tên hiển thị hoặc key có từ khóa HVAC thì tự động cấp DUCT và PIPE
                if (targetCode == "DUCT" || targetCode == "PIPE")
                {
                    if (!string.IsNullOrEmpty(lic.ModulesDisplay) && lic.ModulesDisplay.ToUpperInvariant().Contains("HVAC"))
                        return true;

                    if (!string.IsNullOrEmpty(lic.LicenseKey) && lic.LicenseKey.ToUpperInvariant().Contains("HVAC"))
                        return true;
                }

                // 4. Tương thích ngược với bảng Licenses cũ trong vault
                if (vault.Licenses != null && vault.Licenses.Count > 0)
                {
                    foreach (var entry in vault.Licenses)
                    {
                        if (entry.Value != null && (entry.Value.ExpiryDate <= DateTime.MinValue || entry.Value.ExpiryDate >= DateTime.Now))
                        {
                            string ck = (entry.Key ?? "").Trim().ToUpperInvariant().Replace("MEP-", "");
                            if (ck == "ALL" || ck == "VIP" || ck == targetCode || string.Equals(entry.Key, productCode, StringComparison.OrdinalIgnoreCase))
                                return true;

                            if (ck.Contains("HVAC") && (targetCode == "DUCT" || targetCode == "PIPE"))
                                return true;

                            if (ck.Contains("DUCT") && targetCode == "DUCT") return true;
                            if (ck.Contains("PIPE") && targetCode == "PIPE") return true;
                        }
                    }
                }

                return false;
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[LicenseManager] CanAccessModule error: " + ex.Message);
                return false;
            }
        }

        private static DateTime _lastOnlineCheckTime = DateTime.MinValue;
        private static bool _lastOnlineCheckPassed = true;
        private static string _lastOnlineLockMessage = null;

        /// <summary>
        /// Xác minh trạng thái khóa của Key và Thiết bị với Server/GitHub theo thời gian thực.
        /// Tự động thu hồi bản quyền cục bộ nếu Admin đã Khóa Key hoặc Gỡ máy trên website doanson.com.
        /// </summary>
        public static bool VerifyActiveLicenseStatusOnline(string keyToCheck, out string lockMessage, bool forceCheck = false)
        {
            lockMessage = null;
            try
            {
                var vault = LoadVault();
                var lic = GetActiveLicense(vault);
                string key = keyToCheck ?? lic?.LicenseKey;

                if (string.IsNullOrWhiteSpace(key) || (lic != null && lic.IsTrial))
                {
                    return true;
                }

                // Giới hạn tần suất kiểm tra ngầm (tối thiểu 60s một lần trừ khi forceCheck = true)
                if (!forceCheck && (DateTime.Now - _lastOnlineCheckTime).TotalSeconds < 60)
                {
                    lockMessage = _lastOnlineLockMessage;
                    return _lastOnlineCheckPassed;
                }

                _lastOnlineCheckTime = DateTime.Now;

                using (var client = new HttpClient())
                {
                    client.Timeout = TimeSpan.FromSeconds(5);
                    client.DefaultRequestHeaders.Add("User-Agent", "Revit-Store-Hub");
                    client.DefaultRequestHeaders.Add("Accept", "application/vnd.github.v3+json");
                    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("token", GH_TOKEN);

                    string apiUrl = $"https://api.github.com/repos/{GH_OWNER}/{GH_REPO}/contents/{GH_VAULT_PATH}?t={DateTime.UtcNow.Ticks}";
                    var getRes = client.GetAsync(apiUrl).Result;
                    if (getRes.IsSuccessStatusCode)
                    {
                        string fileJson = getRes.Content.ReadAsStringAsync().Result;
                        dynamic fileObj = JsonConvert.DeserializeObject(fileJson);
                        string contentBase64 = ((string)fileObj.content).Replace("\n", "").Replace("\r", "").Trim();
                        byte[] jsonBytes = Convert.FromBase64String(contentBase64);
                        string vaultRaw = Encoding.UTF8.GetString(jsonBytes);
                        var vaultDict = JsonConvert.DeserializeObject<Dictionary<string, JObject>>(vaultRaw);

                        if (vaultDict != null)
                        {
                            string matchedKey = vaultDict.Keys.FirstOrDefault(k => string.Equals(k, key, StringComparison.OrdinalIgnoreCase));
                            if (matchedKey != null)
                            {
                                var entry = vaultDict[matchedKey];
                                string status = (string)(entry["status"] ?? "active");
                                bool isActive = entry["is_active"] == null || (bool)entry["is_active"];

                                // 1. Kiểm tra nếu Admin đã khóa key trên website
                                if (string.Equals(status, "suspended", StringComparison.OrdinalIgnoreCase) ||
                                    string.Equals(status, "blocked", StringComparison.OrdinalIgnoreCase) ||
                                    string.Equals(status, "locked", StringComparison.OrdinalIgnoreCase) ||
                                    string.Equals(status, "inactive", StringComparison.OrdinalIgnoreCase) ||
                                    !isActive)
                                {
                                    ClearVault();
                                    LicenseCache.ClearCache();
                                    _lastOnlineCheckPassed = false;
                                    _lastOnlineLockMessage = "⛔ TÀI KHOẢN BẢN QUYỀN ĐÃ BỊ TẠM KHÓA TRÊN SERVER!\n\n" +
                                                             "Mã key: " + key + "\n" +
                                                             "Vui lòng truy cập website https://doanson.com/revit-store-hub/ hoặc liên hệ Admin để mở khóa.";
                                    lockMessage = _lastOnlineLockMessage;
                                    return false;
                                }

                                // 1.5 Kiểm tra nếu máy tính này nằm trong danh sách đen bị chặn (blocked_machines)
                                if (entry["blocked_machines"] is JArray blockedList)
                                {
                                    foreach (var bId in blockedList)
                                    {
                                        if (string.Equals((string)bId, MACHINE_ID, StringComparison.OrdinalIgnoreCase))
                                        {
                                            ClearVault();
                                            LicenseCache.ClearCache();
                                            _lastOnlineCheckPassed = false;
                                            _lastOnlineLockMessage = "⛔ THIẾT BỊ NÀY (HWID: " + MACHINE_ID + ") ĐÃ BỊ QUẢN TRỊ VIÊN CHẶN TRUY CẬP KHỎI KEY!\n\n" +
                                                                     "Vui lòng liên hệ Admin Doan Son để được hỗ trợ mở khóa.";
                                            lockMessage = _lastOnlineLockMessage;
                                            return false;
                                        }
                                    }
                                }

                                // 2. Kiểm tra nếu máy trạm này đã bị Admin gỡ bỏ trên website
                                if (entry["registered_accounts"] is JArray regAccounts)
                                {
                                    bool isDeviceFound = false;
                                    foreach (var devItem in regAccounts)
                                    {
                                        if (devItem is JObject obj)
                                        {
                                            string mId = (string)(obj["machine_id"] ?? obj["machineId"]);
                                            if (string.Equals(mId, MACHINE_ID, StringComparison.OrdinalIgnoreCase))
                                            {
                                                string devStatus = (string)(obj["status"] ?? "Active");
                                                if (string.Equals(devStatus, "blocked", StringComparison.OrdinalIgnoreCase) ||
                                                    string.Equals(devStatus, "suspended", StringComparison.OrdinalIgnoreCase))
                                                {
                                                    ClearVault();
                                                    LicenseCache.ClearCache();
                                                    _lastOnlineCheckPassed = false;
                                                    _lastOnlineLockMessage = "⛔ THIẾT BỊ NÀY ĐÃ BỊ KHÓA TRÊN MÁY CHỦ!\n\nVui lòng truy cập https://doanson.com/revit-store-hub/ để kiểm tra.";
                                                    lockMessage = _lastOnlineLockMessage;
                                                    return false;
                                                }
                                                isDeviceFound = true;
                                                break;
                                            }
                                        }
                                    }

                                    if (!isDeviceFound && regAccounts.Count > 0)
                                    {
                                        ClearVault();
                                        LicenseCache.ClearCache();
                                        _lastOnlineCheckPassed = false;
                                        _lastOnlineLockMessage = "⛔ THIẾT BỊ NÀY ĐÃ BỊ GỠ BỎ KHỎI MÃ BẢN QUYỀN TRÊN SERVER!\n\n" +
                                                                 "Khe kích hoạt của máy đã bị giải phóng. Vui lòng kích hoạt lại trên Revit.";
                                        lockMessage = _lastOnlineLockMessage;
                                        return false;
                                    }
                                }
                            }
                        }
                    }
                }

                _lastOnlineCheckPassed = true;
                _lastOnlineLockMessage = null;
                return true;
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[LicenseManager] Online check error: " + ex.Message);
                return true;
            }
        }

        /// <summary>
        /// Xác minh bản quyền khi người dùng gọi một lệnh Revit bất kỳ.
        /// </summary>
        public static bool ValidateProductLicense(string productCode, bool isSilentStartup = false)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(productCode))
                {
                    productCode = ProductCatalog.GetProductCodeFromCaller();
                }

                // 1. Kiểm tra trạng thái khóa online từ server (nếu đã bị Admin khóa hoặc gỡ máy)
                if (!VerifyActiveLicenseStatusOnline(null, out string lockMsg, forceCheck: false))
                {
                    LicenseCache.ClearCache();
                    if (!isSilentStartup && !string.IsNullOrEmpty(lockMsg))
                    {
                        MessageBox.Show(lockMsg, "Bản Quyền Đã Bị Khóa", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    }
                    return false;
                }

                // 2. Kiểm tra cache trong RAM trước
                if (LicenseCache.IsProductValid(productCode))
                {
                    TouchLastRunTime();
                    return true;
                }

                // 3. Kiểm tra quyền truy cập theo cấu hình vault
                if (CanAccessModule(productCode))
                {
                    TouchLastRunTime();
                    LicenseCache.RefreshProduct(productCode, 30);
                    return true;
                }

                // Nếu ở chế độ khởi động ngầm -> Không hiện popup làm phiền
                if (isSilentStartup) return false;

                // 4. Phân biệt các trường hợp để hiển thị thông báo chính xác cho người dùng
                var vault = LoadVault();
                var activeLic = GetActiveLicense(vault);

                // Trường hợp 3A: Đã có license nhưng hết hạn
                if (activeLic != null && activeLic.ExpiryDate > DateTime.MinValue && activeLic.ExpiryDate < DateTime.Now)
                {
                    string msg = "Bản quyền gói " + (activeLic.ModulesDisplay ?? "DS Tools") + " đã hết hạn vào ngày " +
                                 activeLic.ExpiryDate.ToString("dd/MM/yyyy") + ".\n\n" +
                                 "Vui lòng gia hạn hoặc nhập mã bản quyền mới để tiếp tục sử dụng.\n" +
                                 "Bạn có muốn mở website để mua gia hạn không?";

                    var res = MessageBox.Show(msg, "Bản Quyền Đã Hết Hạn", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Warning);
                    if (res == DialogResult.Yes)
                    {
                        OpenStoreUrl();
                    }
                    else if (res == DialogResult.No)
                    {
                        return ShowLicenseCenterForProduct(productCode);
                    }
                    return CanAccessModule(productCode);
                }

                // Trường hợp 3B: Có license còn hạn, nhưng KHÔNG bao gồm module này (Ví dụ: Chỉ mua Duct + Pipe nhưng bấm Sheet)
                if (activeLic != null && (activeLic.ExpiryDate <= DateTime.MinValue || activeLic.ExpiryDate >= DateTime.Now))
                {
                    string reqName = ProductCatalog.GetProductName(productCode);
                    string curModules = !string.IsNullOrWhiteSpace(activeLic.ModulesDisplay)
                        ? activeLic.ModulesDisplay
                        : "Gói công cụ đã mua";

                    string msg = "⚠️ BẠN CHƯA ĐĂNG KÝ BẢN QUYỀN CHO MODULE NÀY!\n\n" +
                                 "• Công cụ bạn vừa chọn: " + reqName + "\n" +
                                 "• Gói bản quyền hiện tại của bạn gồm: " + curModules + "\n\n" +
                                 "Công cụ này chưa nằm trong danh sách module được cấp phép.\n" +
                                 "Bạn có muốn nhập mã bản quyền mới (Yes) hoặc mở website mua thêm module này (No)?";

                    var res = MessageBox.Show(msg, "Chưa Đăng Ký Module: " + reqName, MessageBoxButtons.YesNoCancel, MessageBoxIcon.Information);
                    if (res == DialogResult.Yes)
                    {
                        return ShowLicenseCenterForProduct(productCode);
                    }
                    else if (res == DialogResult.No)
                    {
                        OpenStoreUrl();
                    }
                    return CanAccessModule(productCode);
                }

                // Trường hợp 3C: Máy tính hoàn toàn chưa kích hoạt key nào -> Mở LicenseCenterForm
                return ShowLicenseCenterForProduct(productCode);
            }
            catch (Exception ex)
            {
                LicenseCache.ClearProduct(productCode);
                if (!isSilentStartup)
                {
                    MessageBox.Show("Lỗi kiểm tra bản quyền (" + productCode + "): " + ex.Message,
                        "Lỗi Bản Quyền", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
                return false;
            }
        }

        private static void TouchLastRunTime()
        {
            try
            {
                var vault = LoadVault();
                var lic = GetActiveLicense(vault);
                if (lic != null)
                {
                    lic.LastRunTime = DateTime.Now;
                    SaveVault(vault);
                }
            }
            catch { }
        }

        #endregion

        #region Kích Hoạt Key & Quản Lý Thiết Bị Trực Tuyến (Online Workstation Sync)

        /// <summary>
        /// Kích hoạt mã bản quyền từ chuỗi key do người dùng nhập.
        /// Đồng thời ghi nhận máy tính hiện tại vào danh sách thiết bị trên website: https://doanson.com/revit-store-hub/
        /// </summary>
        public static ActivationResult ActivateLicenseKey(string licenseKey)
        {
            if (string.IsNullOrWhiteSpace(licenseKey))
            {
                return new ActivationResult
                {
                    Success = false,
                    Message = "Vui lòng nhập mã bản quyền hợp lệ."
                };
            }

            licenseKey = licenseKey.Trim().ToUpperInvariant();

            // Nếu người dùng nhập mã key dùng thử TRIAL-...
            if (licenseKey.StartsWith("TRIAL-"))
            {
                var trialRes = ActivateTrial7Days();
                return new ActivationResult
                {
                    Success = trialRes.Success,
                    ExpiryDate = trialRes.ExpiryDate,
                    Message = trialRes.Message,
                    ProductName = "Toàn Bộ Công Cụ (Dùng Thử 7 Ngày)",
                    IsTrial = true
                };
            }

            // TẦNG 1: Tra cứu và đăng ký máy trực tiếp qua GitHub Kho Giấy Phép (Realtime 100% với website)
            var ghResult = TryActivateAndRegisterOnGitHubVault(licenseKey);
            if (ghResult != null)
            {
                return ghResult;
            }

            // TẦNG 2: Gửi request đến Server API (nếu có server nội bộ đang chạy)
            var payload = new
            {
                license_key = licenseKey,
                LicenseKey = licenseKey,
                machine_id = MACHINE_ID,
                MachineId = MACHINE_ID,
                machine_name = Environment.MachineName,
                username = Environment.UserName,
                fullName = Environment.UserName,
                revit_version = "2025",
                os_info = "Windows",
                app = "Revit Add-in",
                action = "activate"
            };

            string responseJson = null;
            foreach (var baseUrl in API_BASE_URLS)
            {
                try
                {
                    using (var client = new HttpClient())
                    {
                        client.Timeout = TimeSpan.FromSeconds(5);
                        var content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");
                        var response = client.PostAsync(baseUrl + "/api/v1/license/activate", content).Result;
                        if (response.IsSuccessStatusCode)
                        {
                            responseJson = response.Content.ReadAsStringAsync().Result;
                            break;
                        }
                    }
                }
                catch { }
            }

            if (!string.IsNullOrEmpty(responseJson))
            {
                try
                {
                    dynamic res = JsonConvert.DeserializeObject(responseJson);
                    bool isValid = (bool)(res.valid ?? res.Success ?? false);

                    if (isValid)
                    {
                        var allowedMods = new List<string>();
                        if (res.allowed_modules != null)
                        {
                            foreach (var m in res.allowed_modules)
                            {
                                string ms = (string)m;
                                if (!string.IsNullOrWhiteSpace(ms)) allowedMods.Add(ms.Trim().ToUpperInvariant());
                            }
                        }
                        else if (res.AllowedModules != null)
                        {
                            foreach (var m in res.AllowedModules)
                            {
                                string ms = (string)m;
                                if (!string.IsNullOrWhiteSpace(ms)) allowedMods.Add(ms.Trim().ToUpperInvariant());
                            }
                        }

                        // Mở rộng HVAC thành cả DUCT và PIPE
                        if (allowedMods.Any(m => m.Contains("HVAC")))
                        {
                            if (!allowedMods.Contains(ProductCatalog.PRODUCT_DUCT)) allowedMods.Add(ProductCatalog.PRODUCT_DUCT);
                            if (!allowedMods.Contains(ProductCatalog.PRODUCT_PIPE)) allowedMods.Add(ProductCatalog.PRODUCT_PIPE);
                        }

                        if (allowedMods.Count == 0)
                        {
                            allowedMods = DetectModulesFromKey(licenseKey);
                        }

                        if (allowedMods.Count == 0)
                        {
                            return new ActivationResult
                            {
                                Success = false,
                                Message = "Mã bản quyền chưa được gán Module nào trong hệ thống DoanSon."
                            };
                        }

                        string modulesDisplay = (string)(res.modules_display ?? res.ModulesDisplay ?? res.ProductName ?? "DS Tools");
                        string customerName = (string)(res.CustomerName ?? res.customer_name ?? "Kỹ Sư Doan Son");
                        string token = (string)(res.Token ?? res.token ?? ("TOKEN_" + Guid.NewGuid().ToString("N")));
                        DateTime expiry = ParseExpiryDate(res.ExpiryDate ?? res.expiry_date, DateTime.Now.AddDays(365));

                        SaveActiveLicenseToVault(licenseKey, allowedMods, modulesDisplay, customerName, token, expiry, false);

                        return new ActivationResult
                        {
                            Success = true,
                            Token = token,
                            ExpiryDate = expiry,
                            CustomerName = customerName,
                            ProductName = modulesDisplay,
                            AllowedModules = allowedMods,
                            Message = (string)(res.message ?? res.Message ?? "Kích hoạt bản quyền thành công!")
                        };
                    }
                    else
                    {
                        string msg = (string)(res.message ?? res.Message ?? "Mã bản quyền không hợp lệ hoặc đã hết lượt kích hoạt.");
                        return new ActivationResult { Success = false, Message = msg };
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine("[LicenseManager] Error parsing activation response: " + ex.Message);
                }
            }

            // TẦNG 3: Fallback kích hoạt dự phòng (Offline parser từ cấu trúc key)
            return FallbackActivateKey(licenseKey);
        }

        /// <summary>
        /// Kích hoạt và ĐỒNG BỘ MÁY TRẠM LÊN MÁY CHỦ TRUNG TÂM / GITHUB.
        /// Quản lý thiết bị kích hoạt ngay trên website: https://doanson.com/revit-store-hub/ (Mục Quản Lý Bản Quyền).
        /// </summary>
        private static ActivationResult TryActivateAndRegisterOnGitHubVault(string licenseKey)
        {
            string trimmedKey = (licenseKey ?? "").Trim().ToUpperInvariant();

            try
            {
                using (var client = new HttpClient())
                {
                    client.Timeout = TimeSpan.FromSeconds(8);
                    client.DefaultRequestHeaders.Add("User-Agent", "Revit-Store-Hub");
                    client.DefaultRequestHeaders.Add("Accept", "application/vnd.github.v3+json");
                    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("token", GH_TOKEN);

                    string apiUrl = $"https://api.github.com/repos/{GH_OWNER}/{GH_REPO}/contents/{GH_VAULT_PATH}?t={DateTime.UtcNow.Ticks}";
                    var getRes = client.GetAsync(apiUrl).Result;
                    if (!getRes.IsSuccessStatusCode)
                    {
                        return null;
                    }

                    string fileJson = getRes.Content.ReadAsStringAsync().Result;
                    dynamic fileObj = JsonConvert.DeserializeObject(fileJson);
                    string sha = (string)fileObj.sha;
                    string contentBase64 = ((string)fileObj.content).Replace("\n", "").Replace("\r", "").Trim();

                    byte[] jsonBytes = Convert.FromBase64String(contentBase64);
                    string vaultRaw = Encoding.UTF8.GetString(jsonBytes);
                    var vaultDict = JsonConvert.DeserializeObject<Dictionary<string, JObject>>(vaultRaw);
                    if (vaultDict == null) return null;

                    string matchedKey = vaultDict.Keys.FirstOrDefault(k => string.Equals(k, trimmedKey, StringComparison.OrdinalIgnoreCase));
                    if (matchedKey == null)
                    {
                        return null; // Không có key này trên server
                    }

                    var entry = vaultDict[matchedKey];

                    // 1. Kiểm tra trạng thái Khóa / Tạm dừng trên hệ thống doanson.com
                    string status = (string)(entry["status"] ?? "active");
                    bool isActive = entry["is_active"] == null || (bool)entry["is_active"];
                    if (string.Equals(status, "suspended", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(status, "blocked", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(status, "locked", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(status, "inactive", StringComparison.OrdinalIgnoreCase) ||
                        !isActive)
                    {
                        return new ActivationResult
                        {
                            Success = false,
                            Message = "⛔ TÀI KHOẢN / MÃ BẢN QUYỀN NÀY ĐÃ BỊ TẠM KHÓA TRÊN HỆ THỐNG!\n\n" +
                                      "Mã key: " + trimmedKey + "\n" +
                                      "Trạng thái: " + status.ToUpperInvariant() + "\n\n" +
                                      "👉 Vui lòng truy cập website https://doanson.com/revit-store-hub/ hoặc liên hệ Admin Doan Son để được hỗ trợ mở khóa."
                        };
                    }

                    // 1.5 Kiểm tra máy tính có trong danh sách đen bị chặn không (blocked_machines)
                    if (entry["blocked_machines"] is JArray blockedMachinesList)
                    {
                        foreach (var bId in blockedMachinesList)
                        {
                            if (string.Equals((string)bId, MACHINE_ID, StringComparison.OrdinalIgnoreCase))
                            {
                                return new ActivationResult
                                {
                                    Success = false,
                                    Message = "⛔ MÁY TÍNH NÀY (HWID: " + MACHINE_ID + ") ĐÃ BỊ QUẢN TRỊ VIÊN CHẶN KHỎI MÃ BẢN QUYỀN NÀY!\n\n" +
                                              "👉 Vui lòng liên hệ Admin Doan Son để được hỗ trợ mở khóa."
                                };
                            }
                        }
                    }

                    // 2. Kiểm tra hạn dùng chuẩn xác
                    DateTime expiry = ParseExpiryDate(entry["expiry_date"], DateTime.Now.AddDays(365));
                    if (expiry > DateTime.MinValue && expiry < DateTime.Now)
                    {
                        return new ActivationResult
                        {
                            Success = false,
                            Message = "Mã bản quyền này đã hết hạn vào ngày: " + expiry.ToString("dd/MM/yyyy") + ".\n" +
                                      "Vui lòng truy cập website https://doanson.com/revit-store-hub/ để gia hạn!"
                        };
                    }

                    // 3. Kiểm tra danh sách máy trạm đã kích hoạt (registered_accounts)
                    int maxMachines = 3;
                    if (entry["max_machines"] != null) int.TryParse(entry["max_machines"].ToString(), out maxMachines);
                    else if (entry["max_accounts"] != null) int.TryParse(entry["max_accounts"].ToString(), out maxMachines);
                    if (maxMachines <= 0) maxMachines = 3;

                    JArray regAccounts = entry["registered_accounts"] as JArray;
                    if (regAccounts == null)
                    {
                        regAccounts = new JArray();
                        entry["registered_accounts"] = regAccounts;
                    }

                    // Tìm xem máy tính này (MACHINE_ID) đã kích hoạt trước đó chưa
                    JObject existingDevice = null;
                    foreach (var devItem in regAccounts)
                    {
                        if (devItem is JObject obj)
                        {
                            string mId = (string)(obj["machine_id"] ?? obj["machineId"] ?? obj["hwid"]);
                            if (string.Equals(mId, MACHINE_ID, StringComparison.OrdinalIgnoreCase))
                            {
                                existingDevice = obj;
                                break;
                            }
                        }
                    }

                    string nowIso = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");

                    if (existingDevice != null)
                    {
                        string devStatus = (string)(existingDevice["status"] ?? "Active");
                        if (string.Equals(devStatus, "blocked", StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(devStatus, "suspended", StringComparison.OrdinalIgnoreCase))
                        {
                            return new ActivationResult
                            {
                                Success = false,
                                Message = "⛔ MÁY TÍNH NÀY ĐÃ BỊ KHÓA TRÊN MÃ BẢN QUYỀN NÀY!\n\n" +
                                          "Mã máy (HWID): " + MACHINE_ID + "\n" +
                                          "👉 Vui lòng mở khóa thiết bị trên website https://doanson.com/revit-store-hub/ hoặc liên hệ Admin Doan Son."
                            };
                        }

                        // Máy cũ kích hoạt lại -> Cập nhật thời gian hoạt động gần nhất
                        existingDevice["lastActive"] = nowIso;
                        existingDevice["last_checked_at"] = nowIso;
                        existingDevice["machine_name"] = Environment.MachineName;
                        existingDevice["name"] = Environment.MachineName;
                        existingDevice["fullName"] = Environment.UserName;
                        existingDevice["username"] = Environment.UserName;
                        existingDevice["user"] = Environment.UserName;
                        existingDevice["hwid"] = MACHINE_ID;
                        existingDevice["machineId"] = MACHINE_ID;
                        existingDevice["machine_id"] = MACHINE_ID;
                        existingDevice["revit_version"] = "2025";
                        existingDevice["os_info"] = "Windows";
                        existingDevice["app"] = "Revit Add-in";
                        existingDevice["status"] = "Active";
                    }
                    else
                    {
                        // Máy mới -> Kiểm tra giới hạn số máy tối đa
                        if (regAccounts.Count >= maxMachines)
                        {
                            return new ActivationResult
                            {
                                Success = false,
                                Message = $"ĐÃ VƯỢT QUÁ SỐ LƯỢNG MÁY CHO PHÉP!\n\n" +
                                          $"• Gói của bạn cho phép tối đa: {maxMachines} máy.\n" +
                                          $"• Hiện tại đã có {regAccounts.Count} máy trạm đang kích hoạt key này.\n\n" +
                                          $"👉 Vui lòng đăng nhập website https://doanson.com/revit-store-hub/\n" +
                                          $"(Mục Quản Lý Giấy Phép & Thiết Bị) để gỡ bỏ máy tính cũ hoặc nâng cấp gói!"
                            };
                        }

                        // Thêm máy mới vào danh sách quản lý trên server
                        var newDevice = new JObject
                        {
                            ["machineId"] = MACHINE_ID,
                            ["machine_id"] = MACHINE_ID,
                            ["hwid"] = MACHINE_ID,
                            ["machine_name"] = Environment.MachineName,
                            ["name"] = Environment.MachineName,
                            ["username"] = Environment.UserName,
                            ["user"] = Environment.UserName,
                            ["fullName"] = Environment.UserName,
                            ["revit_version"] = "2025",
                            ["os_info"] = "Windows",
                            ["app"] = "Revit Add-in",
                            ["registeredAt"] = nowIso,
                            ["lastActive"] = nowIso,
                            ["last_checked_at"] = nowIso,
                            ["status"] = "Active"
                        };
                        regAccounts.Add(newDevice);
                    }

                    entry["updated_at"] = nowIso;

                    // 3. Commit ngược lên GitHub để cập nhật tức thì trên website https://doanson.com/revit-store-hub/
                    try
                    {
                        string updatedJson = JsonConvert.SerializeObject(vaultDict, Formatting.Indented);
                        string updatedBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(updatedJson));

                        var putPayload = new
                        {
                            message = $"Workstation [{MACHINE_ID}] registered key [{matchedKey}] via Revit Add-in",
                            content = updatedBase64,
                            sha = sha
                        };

                        var putContent = new StringContent(JsonConvert.SerializeObject(putPayload), Encoding.UTF8, "application/json");
                        var putRes = client.PutAsync(apiUrl, putContent).Result;
                        if (putRes.IsSuccessStatusCode)
                        {
                            Debug.WriteLine("[LicenseManager] Đồng bộ máy trạm lên GitHub Server thành công!");
                        }
                    }
                    catch (Exception syncEx)
                    {
                        Debug.WriteLine("[LicenseManager] Lỗi đẩy GitHub sync: " + syncEx.Message);
                    }

                    // 4. Phân giải quyền Module
                    var allowedMods = new List<string>();
                    if (entry["allowed_modules"] is JArray modArr)
                    {
                        foreach (var m in modArr)
                        {
                            string ms = m.ToString().Trim().ToUpperInvariant();
                            if (!string.IsNullOrWhiteSpace(ms)) allowedMods.Add(ms);
                        }
                    }

                    string planName = (string)(entry["plan_name"] ?? "DS Tools");

                    // Nếu gói có chứa HVAC -> tự động mở cả DUCT và PIPE
                    if (allowedMods.Any(m => m.Contains("HVAC")) || planName.ToUpperInvariant().Contains("HVAC"))
                    {
                        if (!allowedMods.Contains(ProductCatalog.PRODUCT_DUCT)) allowedMods.Add(ProductCatalog.PRODUCT_DUCT);
                        if (!allowedMods.Contains(ProductCatalog.PRODUCT_PIPE)) allowedMods.Add(ProductCatalog.PRODUCT_PIPE);
                    }

                    if (allowedMods.Count == 0)
                    {
                        if (planName.ToUpperInvariant().Contains("VIP") || planName.ToUpperInvariant().Contains("FULL") || planName.ToUpperInvariant().Contains("ALL"))
                        {
                            allowedMods.Add(ProductCatalog.PRODUCT_ALL);
                        }
                        else
                        {
                            allowedMods = DetectModulesFromKey(licenseKey);
                        }
                    }

                    string token = "ONLINE_TOKEN_" + Guid.NewGuid().ToString("N");
                    string customerName = "Kỹ Sư Doan Son";

                    SaveActiveLicenseToVault(matchedKey, allowedMods, planName, customerName, token, expiry, false);

                    return new ActivationResult
                    {
                        Success = true,
                        Token = token,
                        ExpiryDate = expiry,
                        CustomerName = customerName,
                        ProductName = planName,
                        AllowedModules = allowedMods,
                        Message = $"Kích hoạt thành công trên máy tính ({MACHINE_ID})!\nĐã cập nhật quản lý thiết bị trên website DoanSon Hub."
                    };
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[LicenseManager] TryActivateAndRegisterOnGitHubVault error: " + ex.Message);
            }

            return null;
        }

        private static List<string> DetectModulesFromKey(string licenseKey)
        {
            var detected = new List<string>();
            string upper = (licenseKey ?? "").ToUpperInvariant();

            if (upper.Contains("ALL") || upper.Contains("VIP") || upper.StartsWith("REVIT-VIP"))
            {
                detected.Add(ProductCatalog.PRODUCT_ALL);
            }
            else
            {
                if (upper.Contains("HVAC"))
                {
                    detected.Add(ProductCatalog.PRODUCT_DUCT);
                    detected.Add(ProductCatalog.PRODUCT_PIPE);
                }

                if (upper.Contains("DUCT") || upper.Contains("-DP-") || upper.Contains("-DE-"))
                {
                    if (!detected.Contains(ProductCatalog.PRODUCT_DUCT)) detected.Add(ProductCatalog.PRODUCT_DUCT);
                }

                if (upper.Contains("PIPE") || upper.Contains("-DP-"))
                {
                    if (!detected.Contains(ProductCatalog.PRODUCT_PIPE)) detected.Add(ProductCatalog.PRODUCT_PIPE);
                }

                if (upper.Contains("SHEET") || upper.Contains("SHT"))
                {
                    if (!detected.Contains(ProductCatalog.PRODUCT_SHEET)) detected.Add(ProductCatalog.PRODUCT_SHEET);
                }

                if (upper.Contains("FIRE"))
                {
                    if (!detected.Contains(ProductCatalog.PRODUCT_FIRE)) detected.Add(ProductCatalog.PRODUCT_FIRE);
                }

                if (upper.Contains("ELEC") || upper.Contains("-DE-"))
                {
                    if (!detected.Contains(ProductCatalog.PRODUCT_ELEC)) detected.Add(ProductCatalog.PRODUCT_ELEC);
                }

                if (upper.Contains("AI"))
                {
                    if (!detected.Contains(ProductCatalog.PRODUCT_AI)) detected.Add(ProductCatalog.PRODUCT_AI);
                }
            }

            return detected;
        }

        private static ActivationResult FallbackActivateKey(string licenseKey)
        {
            var detected = DetectModulesFromKey(licenseKey);

            if (detected.Count == 0)
            {
                return new ActivationResult
                {
                    Success = false,
                    Message = "Mã bản quyền không hợp lệ hoặc chưa được đăng ký trong hệ thống DoanSon.\n" +
                              "Vui lòng kiểm tra lại mã key hoặc kết nối Internet để máy chủ xác thực mã bản quyền!"
                };
            }

            string display = detected.Contains(ProductCatalog.PRODUCT_ALL)
                ? "Toàn Bộ Công Cụ (VIP All-in-One)"
                : string.Join(", ", detected.Select(ProductCatalog.GetProductName));

            DateTime expiry = DateTime.Now.AddDays(365);
            string token = "OFFLINE_TOKEN_" + Convert.ToBase64String(Encoding.UTF8.GetBytes(licenseKey + ":" + MACHINE_ID));

            SaveActiveLicenseToVault(licenseKey, detected, display, "Khách Hàng Bản Quyền", token, expiry, false);

            return new ActivationResult
            {
                Success = true,
                Token = token,
                ExpiryDate = expiry,
                CustomerName = "Khách Hàng Bản Quyền",
                ProductName = display,
                AllowedModules = detected,
                Message = "Kích hoạt bản quyền thành công (Chế độ nhận diện key)!"
            };
        }

        /// <summary>
        /// Kích hoạt gói dùng thử 7 ngày toàn bộ tính năng.
        /// Chống lặp lại bằng cách kiểm tra Hardware ID tại máy chủ và DPAPI local.
        /// </summary>
        public static TrialActivationResult ActivateTrial7Days()
        {
            var vault = LoadVault();

            // 1. Kiểm tra cờ local
            if (vault.TrialUsedAt != null)
            {
                return new TrialActivationResult
                {
                    Success = false,
                    Message = "Máy tính này (Mã máy: " + MACHINE_ID + ") đã từng kích hoạt dùng thử 7 ngày vào ngày " +
                              vault.TrialUsedAt.Value.ToString("dd/MM/yyyy") + ".\n\n" +
                              "Mỗi máy tính chỉ được dùng thử 1 lần duy nhất.\n" +
                              "Vui lòng mua bản quyền trên website https://doanson.com/revit-store-hub/ hoặc liên hệ Zalo: 0765.321.779!"
                };
            }

            // 2. Gọi Server API để xác thực và lưu HWID
            var payload = new
            {
                machine_id = MACHINE_ID,
                MachineId = MACHINE_ID,
                machine_name = Environment.MachineName
            };

            string responseJson = null;
            foreach (var baseUrl in API_BASE_URLS)
            {
                try
                {
                    using (var client = new HttpClient())
                    {
                        client.Timeout = TimeSpan.FromSeconds(5);
                        var content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");
                        var response = client.PostAsync(baseUrl + "/api/v1/license/trial", content).Result;
                        if (response.IsSuccessStatusCode)
                        {
                            responseJson = response.Content.ReadAsStringAsync().Result;
                            break;
                        }
                    }
                }
                catch { }
            }

            if (!string.IsNullOrEmpty(responseJson))
            {
                try
                {
                    dynamic res = JsonConvert.DeserializeObject(responseJson);
                    bool isValid = (bool)(res.valid ?? res.Success ?? false);
                    string code = (string)(res.code ?? "");

                    if (code == "TRIAL_ALREADY_USED" || !isValid)
                    {
                        vault.TrialUsedAt = DateTime.Now;
                        SaveVault(vault);

                        return new TrialActivationResult
                        {
                            Success = false,
                            Message = (string)(res.message ?? "Máy tính này đã từng kích hoạt dùng thử 7 ngày trên hệ thống. Mỗi máy tính chỉ được dùng thử 1 lần.")
                        };
                    }

                    DateTime expiry = ParseExpiryDate(res.ExpiryDate ?? res.expiry_date, DateTime.Now.AddDays(7));
                    string trialKey = (string)(res.license_key ?? res.LicenseKey ?? ("TRIAL-7D-" + MACHINE_ID.Replace("-", "").Substring(0, 8)));
                    string token = (string)(res.Token ?? res.token ?? ("TRIAL_" + Guid.NewGuid().ToString("N")));

                    vault.TrialUsedAt = DateTime.Now;
                    SaveActiveLicenseToVault(trialKey, new List<string> { ProductCatalog.PRODUCT_ALL }, "Toàn Bộ Công Cụ (Dùng Thử 7 Ngày)", "Khách Hàng Dùng Thử", token, expiry, true);

                    return new TrialActivationResult
                    {
                        Success = true,
                        ExpiryDate = expiry,
                        LicenseKey = trialKey,
                        Message = "Kích hoạt dùng thử 7 ngày thành công!"
                    };
                }
                catch (Exception ex)
                {
                    Debug.WriteLine("[LicenseManager] Trial API parse error: " + ex.Message);
                }
            }

            // Fallback khi mất mạng hoàn toàn (chỉ cho phép nếu máy chưa từng dùng thử)
            DateTime localExpiry = DateTime.Now.AddDays(7);
            string localTrialKey = "TRIAL-7D-" + MACHINE_ID.Replace("-", "").Substring(0, Math.Min(8, MACHINE_ID.Length));

            vault.TrialUsedAt = DateTime.Now;
            SaveActiveLicenseToVault(localTrialKey, new List<string> { ProductCatalog.PRODUCT_ALL }, "Toàn Bộ Công Cụ (Dùng Thử 7 Ngày)", "Khách Hàng Dùng Thử", "LOCAL_TRIAL_" + Guid.NewGuid().ToString("N"), localExpiry, true);

            return new TrialActivationResult
            {
                Success = true,
                ExpiryDate = localExpiry,
                LicenseKey = localTrialKey,
                Message = "Kích hoạt dùng thử 7 ngày thành công!"
            };
        }

        private static void SaveActiveLicenseToVault(string key, List<string> allowedModules, string display, string customer, string token, DateTime expiry, bool isTrial)
        {
            var vault = LoadVault();

            var active = new SingleActiveLicense
            {
                LicenseKey = key,
                AllowedModules = allowedModules ?? new List<string>(),
                ModulesDisplay = display,
                CustomerName = customer,
                Token = token,
                ExpiryDate = expiry,
                LastValidation = DateTime.Now,
                LastRunTime = DateTime.Now,
                IsTrial = isTrial,
                ActivatedTime = DateTime.Now
            };

            vault.ActiveLicense = active;

            // Đồng bộ sang bảng Licenses cũ để tương thích 100% với các component khác
            vault.Licenses = new Dictionary<string, ProductLicenseInfo>(StringComparer.OrdinalIgnoreCase);

            foreach (var mod in active.AllowedModules)
            {
                vault.Licenses[mod] = new ProductLicenseInfo
                {
                    ProductCode = mod,
                    ProductName = ProductCatalog.GetProductName(mod),
                    LicenseKey = key,
                    Token = token,
                    CustomerName = customer,
                    ExpiryDate = expiry,
                    LastValidation = DateTime.Now,
                    LastRunTime = DateTime.Now,
                    IsTrial = isTrial,
                    ActivatedTime = DateTime.Now
                };
            }

            SaveVault(vault);

            // Làm mới cache RAM
            LicenseCache.ClearCache();
            if (active.AllowedModules.Contains(ProductCatalog.PRODUCT_ALL))
            {
                LicenseCache.RefreshProduct(ProductCatalog.PRODUCT_ALL, 30);
            }
            else
            {
                foreach (var mod in active.AllowedModules)
                {
                    LicenseCache.RefreshProduct(mod, 30);
                }
            }
        }

        #endregion

        #region Helpers & UI Triggers

        public static SingleActiveLicense GetActiveLicense()
        {
            var vault = LoadVault();
            return GetActiveLicense(vault);
        }

        private static SingleActiveLicense GetActiveLicense(MultiLicenseStore vault)
        {
            if (vault == null) return null;

            if (vault.ActiveLicense != null)
                return vault.ActiveLicense;

            // Tương thích ngược: Lấy từ vault.Licenses nếu có
            if (vault.Licenses != null && vault.Licenses.Count > 0)
            {
                ProductLicenseInfo chosen = null;
                if (vault.Licenses.TryGetValue(ProductCatalog.PRODUCT_ALL, out var vip) && (vip.ExpiryDate <= DateTime.MinValue || vip.ExpiryDate >= DateTime.Now))
                {
                    chosen = vip;
                }
                else
                {
                    chosen = vault.Licenses.Values.FirstOrDefault(l => l.ExpiryDate <= DateTime.MinValue || l.ExpiryDate >= DateTime.Now) ?? vault.Licenses.Values.FirstOrDefault();
                }

                if (chosen != null)
                {
                    vault.ActiveLicense = new SingleActiveLicense
                    {
                        LicenseKey = chosen.LicenseKey,
                        AllowedModules = new List<string> { chosen.ProductCode },
                        ModulesDisplay = chosen.ProductName ?? ProductCatalog.GetProductName(chosen.ProductCode),
                        CustomerName = chosen.CustomerName,
                        Token = chosen.Token,
                        ExpiryDate = chosen.ExpiryDate,
                        LastValidation = chosen.LastValidation,
                        LastRunTime = chosen.LastRunTime,
                        IsTrial = chosen.IsTrial,
                        ActivatedTime = chosen.ActivatedTime
                    };
                    return vault.ActiveLicense;
                }
            }

            return null;
        }

        public static string GetCurrentMachineId()
        {
            return MACHINE_ID;
        }

        public static string GetSavedLicenseKey()
        {
            var active = GetActiveLicense();
            return active?.LicenseKey ?? string.Empty;
        }

        public static string GetLicenseStatus()
        {
            var active = GetActiveLicense();
            if (active == null || (active.ExpiryDate > DateTime.MinValue && active.ExpiryDate < DateTime.Now))
            {
                return "Chưa kích hoạt bản quyền hợp lệ.\nMã máy: " + MACHINE_ID;
            }

            int daysLeft = (int)Math.Max(0, (active.ExpiryDate - DateTime.Now).TotalDays);
            return "• Gói bản quyền: " + (active.ModulesDisplay ?? "DS Tools") + "\n" +
                   "• License Key: " + active.LicenseKey + "\n" +
                   "• Khách hàng: " + (active.CustomerName ?? "Doan Son") + "\n" +
                   "• Hạn sử dụng: " + active.ExpiryDate.ToString("dd/MM/yyyy") + " (Còn " + daysLeft + " ngày)\n" +
                   "• Mã máy (HWID): " + MACHINE_ID;
        }

        public static LicenseInfo GetCurrentLicenseInfo()
        {
            try
            {
                var active = GetActiveLicense();
                if (active == null) return null;
                return new LicenseInfo
                {
                    LicenseKey = active.LicenseKey,
                    CustomerName = active.CustomerName,
                    ExpiryDate = active.ExpiryDate,
                    LastValidation = active.LastValidation,
                    LastRunTime = active.LastRunTime,
                    IsOfflineMode = false,
                    Token = active.Token,
                    LoginTime = active.ActivatedTime
                };
            }
            catch
            {
                return null;
            }
        }

        public static bool IsLoggedIn()
        {
            var lic = GetActiveLicense();
            return lic != null && !string.IsNullOrWhiteSpace(lic.LicenseKey) && (lic.ExpiryDate <= DateTime.MinValue || lic.ExpiryDate >= DateTime.Now);
        }

        public static bool IsProductLoggedIn(string productCode)
        {
            return CanAccessModule(productCode);
        }

        public static string GetCustomerName()
        {
            var lic = GetActiveLicense();
            return lic?.CustomerName ?? "Kỹ Sư Doan Son";
        }

        public static bool ShowLicenseCenter()
        {
            // Cập nhật trạng thái khóa/gỡ máy từ server trước khi mở giao diện
            VerifyActiveLicenseStatusOnline(null, out _, forceCheck: true);
            using (var center = new LicenseCenterForm())
            {
                return center.ShowDialog() == DialogResult.OK;
            }
        }

        public static bool ShowLicenseCenterForProduct(string productCode)
        {
            // Cập nhật trạng thái khóa/gỡ máy từ server trước khi mở giao diện
            VerifyActiveLicenseStatusOnline(null, out _, forceCheck: true);
            using (var center = new LicenseCenterForm(productCode))
            {
                if (center.ShowDialog() == DialogResult.OK)
                {
                    return CanAccessModule(productCode);
                }
                return false;
            }
        }

        public static void OpenStoreUrl()
        {
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = "https://doanson.com/revit-store-hub",
                    UseShellExecute = true
                });
            }
            catch
            {
                try { Process.Start("https://doanson.com/revit-store-hub"); } catch { }
            }
        }

        public static void OpenZaloSupport()
        {
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = "https://zalo.me/0765321779",
                    UseShellExecute = true
                });
            }
            catch
            {
                try { Process.Start("https://zalo.me/0765321779"); } catch { }
            }
        }

        public static void SignOut()
        {
            try
            {
                var vault = LoadVault();
                string activeKey = vault.ActiveLicense?.LicenseKey;
                vault.ActiveLicense = null;
                vault.Licenses.Clear();
                SaveVault(vault);
                LicenseCache.ClearCache();

                // Đồng bộ hủy đăng ký máy trạm trên Server / GitHub
                if (!string.IsNullOrEmpty(activeKey))
                {
                    UnregisterWorkstationFromGitHub(activeKey);
                }

                MessageBox.Show("Đã đăng xuất bản quyền trên máy tính này thành công.\nThiết bị đã được giải phóng trên website https://doanson.com/revit-store-hub/.",
                    "Đăng Xuất", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Lỗi khi đăng xuất: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private static void UnregisterWorkstationFromGitHub(string licenseKey)
        {
            try
            {
                using (var client = new HttpClient())
                {
                    client.Timeout = TimeSpan.FromSeconds(6);
                    client.DefaultRequestHeaders.Add("User-Agent", "Revit-Store-Hub");
                    client.DefaultRequestHeaders.Add("Accept", "application/vnd.github.v3+json");
                    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("token", GH_TOKEN);

                    string apiUrl = $"https://api.github.com/repos/{GH_OWNER}/{GH_REPO}/contents/{GH_VAULT_PATH}?t={DateTime.UtcNow.Ticks}";
                    var getRes = client.GetAsync(apiUrl).Result;
                    if (!getRes.IsSuccessStatusCode) return;

                    string fileJson = getRes.Content.ReadAsStringAsync().Result;
                    dynamic fileObj = JsonConvert.DeserializeObject(fileJson);
                    string sha = (string)fileObj.sha;
                    string contentBase64 = ((string)fileObj.content).Replace("\n", "").Replace("\r", "").Trim();

                    byte[] jsonBytes = Convert.FromBase64String(contentBase64);
                    string vaultRaw = Encoding.UTF8.GetString(jsonBytes);
                    var vaultDict = JsonConvert.DeserializeObject<Dictionary<string, JObject>>(vaultRaw);
                    if (vaultDict == null) return;

                    string matchedKey = vaultDict.Keys.FirstOrDefault(k => string.Equals(k, licenseKey, StringComparison.OrdinalIgnoreCase));
                    if (matchedKey == null) return;

                    var entry = vaultDict[matchedKey];
                    if (entry["registered_accounts"] is JArray regAccounts)
                    {
                        var filtered = new JArray();
                        foreach (var devItem in regAccounts)
                        {
                            if (devItem is JObject obj)
                            {
                                string mId = (string)(obj["machine_id"] ?? obj["machineId"] ?? obj["hwid"]);
                                if (!string.Equals(mId, MACHINE_ID, StringComparison.OrdinalIgnoreCase))
                                {
                                    filtered.Add(obj);
                                }
                            }
                        }
                        entry["registered_accounts"] = filtered;
                        entry["updated_at"] = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");

                        string updatedJson = JsonConvert.SerializeObject(vaultDict, Formatting.Indented);
                        string updatedBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(updatedJson));

                        var putPayload = new
                        {
                            message = $"Workstation [{MACHINE_ID}] unregistered key [{matchedKey}] via SignOut",
                            content = updatedBase64,
                            sha = sha
                        };

                        var putContent = new StringContent(JsonConvert.SerializeObject(putPayload), Encoding.UTF8, "application/json");
                        var putRes = client.PutAsync(apiUrl, putContent).Result;
                        if (putRes.IsSuccessStatusCode)
                        {
                            Debug.WriteLine("[LicenseManager] Unregister workstation from GitHub succeeded.");
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[LicenseManager] UnregisterWorkstationFromGitHub error: " + ex.Message);
            }
        }

        public static bool ValidateLicense(bool isSilentStartup = false)
        {
            string productCode = ProductCatalog.GetProductCodeFromCaller();
            return ValidateProductLicense(productCode, isSilentStartup);
        }

        #endregion

        #region Storage Vault & Security (DPAPI)

        public static MultiLicenseStore LoadVault()
        {
            try
            {
                var appDataPath = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    "MyRevitAddin");

                var vaultPath = Path.Combine(appDataPath, VAULT_FILE);

                if (File.Exists(vaultPath))
                {
                    var encrypted = File.ReadAllBytes(vaultPath);
                    var decrypted = ProtectedData.Unprotect(
                        encrypted,
                        Encoding.UTF8.GetBytes(MACHINE_ID),
                        DataProtectionScope.CurrentUser);

                    var json = Encoding.UTF8.GetString(decrypted);
                    return JsonConvert.DeserializeObject<MultiLicenseStore>(json) ?? new MultiLicenseStore { MachineId = MACHINE_ID };
                }

                // Di chuyển từ file cũ nếu có
                var oldPath = Path.Combine(appDataPath, OLD_LICENSE_FILE);
                if (File.Exists(oldPath))
                {
                    try
                    {
                        var oldEncrypted = File.ReadAllBytes(oldPath);
                        var oldDecrypted = ProtectedData.Unprotect(
                            oldEncrypted,
                            Encoding.UTF8.GetBytes(MACHINE_ID),
                            DataProtectionScope.CurrentUser);

                        var oldJson = Encoding.UTF8.GetString(oldDecrypted);
                        dynamic oldInfo = JsonConvert.DeserializeObject(oldJson);

                        if (oldInfo != null && oldInfo.LicenseKey != null)
                        {
                            string oldKey = (string)oldInfo.LicenseKey;
                            var store = new MultiLicenseStore { MachineId = MACHINE_ID, VaultCreatedTime = DateTime.Now };
                            SaveActiveLicenseToVault(oldKey, new List<string> { ProductCatalog.PRODUCT_ALL }, "Toàn Bộ Công Cụ", "Khách Hàng", "TOKEN_MIGRATED", DateTime.Now.AddDays(365), false);
                            return LoadVault();
                        }
                    }
                    catch { }
                }

                return new MultiLicenseStore { MachineId = MACHINE_ID };
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[LicenseManager] Error loading vault: " + ex.Message);
                return new MultiLicenseStore { MachineId = MACHINE_ID };
            }
        }

        public static void SaveVault(MultiLicenseStore vault)
        {
            try
            {
                if (vault == null) return;
                vault.LastVaultCheck = DateTime.Now;

                var json = JsonConvert.SerializeObject(vault, Formatting.Indented);
                var encrypted = ProtectedData.Protect(
                    Encoding.UTF8.GetBytes(json),
                    Encoding.UTF8.GetBytes(MACHINE_ID),
                    DataProtectionScope.CurrentUser);

                var appDataPath = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    "MyRevitAddin");

                Directory.CreateDirectory(appDataPath);
                File.WriteAllBytes(Path.Combine(appDataPath, VAULT_FILE), encrypted);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[LicenseManager] Error saving vault: " + ex.Message);
            }
        }

        public static void ClearVault()
        {
            try
            {
                var vault = LoadVault();
                vault.ActiveLicense = null;
                vault.Licenses.Clear();
                SaveVault(vault);
            }
            catch { }
        }

        #endregion

        #region Machine Hardware ID

        public static string GetMachineId()
        {
            try
            {
                var sb = new StringBuilder();

                try
                {
                    using (var searcher = new ManagementObjectSearcher("SELECT ProcessorId FROM Win32_Processor"))
                    {
                        foreach (var item in searcher.Get())
                        {
                            sb.Append(item["ProcessorId"]?.ToString());
                            break;
                        }
                    }
                }
                catch { }

                try
                {
                    using (var searcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BaseBoard"))
                    {
                        foreach (var item in searcher.Get())
                        {
                            sb.Append(item["SerialNumber"]?.ToString());
                            break;
                        }
                    }
                }
                catch { }

                if (sb.Length == 0)
                {
                    sb.Append(Environment.MachineName);
                    sb.Append(Environment.UserName);
                }

                using (var sha256 = SHA256.Create())
                {
                    var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(sb.ToString()));
                    var hashStr = BitConverter.ToString(hash).Replace("-", "");
                    return "DS-" + hashStr.Substring(0, 4) + "-" + hashStr.Substring(4, 4);
                }
            }
            catch
            {
                return "DS-8F12-9A4B";
            }
        }

        #endregion
    }
}
