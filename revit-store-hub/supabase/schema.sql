-- ==============================================================================
-- DATABASE SCHEMA CHO HỆ THỐNG WEBSITE THƯƠNG MẠI ĐIỆN TỬ BÁN REVIT FAMILY & TOOLS
-- Nền tảng: Supabase (PostgreSQL 15+)
-- ==============================================================================

-- Bật extension tạo UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. BẢNG HỒ SƠ NGƯỜI DÙNG (PROFILES - Liên kết auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT,
    company TEXT,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. BẢNG SẢN PHẨM (PRODUCTS)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    product_type TEXT NOT NULL CHECK (product_type IN ('family', 'tool')),
    category TEXT NOT NULL, -- Ví dụ: 'MEP - HVAC', 'Kiến trúc - Cửa', 'Kết cấu', 'Add-in Tiện ích'
    description TEXT NOT NULL,
    short_description TEXT,
    revit_versions TEXT[] NOT NULL DEFAULT '{"2022", "2023", "2024", "2025"}',
    thumbnail_url TEXT NOT NULL,
    gallery_urls TEXT[] DEFAULT '{}',
    price NUMERIC(12, 0) NOT NULL DEFAULT 0, -- Giá niêm yết (VNĐ)
    sale_price NUMERIC(12, 0), -- Giá khuyến mãi (nếu có)
    billing_cycle TEXT NOT NULL DEFAULT 'one_time' CHECK (billing_cycle IN ('one_time', 'monthly', 'yearly')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb, -- Lưu LOD, Family Category, File format (.rfa, .exe)
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. BẢNG FILE SẢN PHẨM LƯU PRIVATE TRONG R2/STORAGE (PRODUCT_FILES)
CREATE TABLE IF NOT EXISTS public.product_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL, -- Đường dẫn trong Cloudflare R2 Private Bucket (không public)
    file_size BIGINT NOT NULL DEFAULT 0, -- Dung lượng tính bằng Byte
    version TEXT NOT NULL DEFAULT '1.0.0',
    file_hash TEXT, -- SHA256 checksum kiểm tra toàn vẹn file
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. BẢNG ĐƠN HÀNG (ORDERS)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_code BIGINT NOT NULL UNIQUE, -- Mã số đơn hàng dạng integer dùng cho VietQR / PayOS
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    total_amount NUMERIC(12, 0) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'expired')),
    payment_provider TEXT NOT NULL DEFAULT 'payos',
    payment_reference TEXT, -- Transaction ID từ Ngân hàng / PayOS
    notes TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. BẢNG CHI TIẾT ĐƠN HÀNG (ORDER_ITEMS)
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    price NUMERIC(12, 0) NOT NULL,
    billing_cycle TEXT NOT NULL DEFAULT 'one_time',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. BẢNG QUYỀN SỞ HỮU REVIT FAMILY ĐÃ MUA (USER_PURCHASES)
CREATE TABLE IF NOT EXISTS public.user_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    purchase_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(user_id, product_id)
);

-- 7. BẢNG GIẤY PHÉP BẢN QUYỀN REVIT TOOLS (LICENSES)
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_key TEXT NOT NULL UNIQUE, -- Định dạng: REVIT-XXXX-XXXX-XXXX
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    subscription_type TEXT NOT NULL DEFAULT 'yearly' CHECK (subscription_type IN ('monthly', 'yearly', 'lifetime')),
    max_machines INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),
    start_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expiry_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. BẢNG MÁY TÍNH KÍCH HOẠT LICENSE (LICENSE_ACTIVATIONS)
CREATE TABLE IF NOT EXISTS public.license_activations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_id UUID NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
    machine_id TEXT NOT NULL, -- Hardware UUID máy tính (CPU ID + Motherboard Serial)
    machine_name TEXT,
    os_info TEXT,
    revit_version TEXT,
    activated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(license_id, machine_id)
);

-- 9. BẢNG NHẬT KÝ TẢI FILE AN TOÀN (DOWNLOAD_LOGS)
CREATE TABLE IF NOT EXISTS public.download_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_file_id UUID NOT NULL REFERENCES public.product_files(id) ON DELETE CASCADE,
    ip_address TEXT,
    user_agent TEXT,
    downloaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. BẢNG LOG WEBHOOK THANH TOÁN (PAYMENT_WEBHOOKS)
CREATE TABLE IF NOT EXISTS public.payment_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider TEXT NOT NULL DEFAULT 'payos',
    order_code BIGINT,
    payload JSONB NOT NULL,
    signature_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- CẤU HÌNH BẢO MẬT ROW-LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active products" ON public.products
    FOR SELECT USING (is_active = true);

CREATE POLICY "User can read own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "User can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "User can view own orders" ON public.orders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "User can view own order items" ON public.order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders 
            WHERE orders.id = order_items.order_id 
            AND orders.user_id = auth.uid()
        )
    );

CREATE POLICY "User can view own purchases" ON public.user_purchases
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "User can view own licenses" ON public.licenses
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "User can view own license activations" ON public.license_activations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.licenses 
            WHERE licenses.id = license_activations.license_id 
            AND licenses.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role only for product files" ON public.product_files
    FOR ALL USING (auth.role() = 'service_role');

-- ==============================================================================
-- TRIGGER TỰ ĐỘNG TẠO PROFILE KHI ĐĂNG KÝ USER QUA SUPABASE AUTH
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        'customer'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- DỮ LIỆU MẪU BAN ĐẦU (SEED DATA: REVIT FAMILY & REVIT TOOLS)
-- ==============================================================================
INSERT INTO public.products (name, slug, product_type, category, description, short_description, revit_versions, thumbnail_url, price, sale_price, billing_cycle, metadata)
VALUES
(
    'Bơm Chữa Cháy Trục Đứng Đa Tầng Cánh (Vertical Multistage Pump)',
    'bom-chua-chay-truc-dung-da-tang-canh',
    'family',
    'MEP - Phòng Cháy Chữa Cháy',
    'Family Revit chuẩn MEP đầy đủ connector PCCC & Cấp nước, tham số đầy đủ theo Catalogue Grundfos/Ebara, tích hợp 2D Annotation chuẩn TCVN.',
    'Family chuẩn MEP đầy đủ Connector nước & điện, chuẩn TCVN.',
    ARRAY['2021', '2022', '2023', '2024', '2025'],
    'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
    350000,
    250000,
    'one_time',
    '{"lod": "LOD 350", "category": "Mechanical Equipment", "omniclass": "23.35.10.11"}'::jsonb
),
(
    'Van Bướm Tín hiệu Điện & Kèm Công Tắc Giám Sát',
    'van-buom-tin-hieu-dien-kem-cong-tac',
    'family',
    'MEP - Cấp Thoát Nước & PCCC',
    'Van bướm kích thước DN50 - DN300, đầy đủ thông số lưu lượng, tổn thất áp lực và tín hiệu báo về tủ điều khiển trung tâm.',
    'Đầy đủ dải kích thước DN50-DN300, tích hợp thông số thủy lực.',
    ARRAY['2022', '2023', '2024', '2025'],
    'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=800&q=80',
    200000,
    150000,
    'one_time',
    '{"lod": "LOD 300", "category": "Pipe Accessories", "omniclass": "23.15.11.14"}'::jsonb
),
(
    'MEP Auto Routing & Clash Solver Pro',
    'mep-auto-routing-clash-solver-pro',
    'tool',
    'Revit Add-in Tự Động Hóa',
    'Add-in tự động vẽ đường ống né dầm né cột chỉ với 1 cú click. Tự động kiểm tra xung đột thời gian thực và xuất báo cáo va chạm chi tiết sang Excel.',
    'Tự động né dầm/cột cho ống gió & ống nước, giải quyết va chạm tức thì.',
    ARRAY['2022', '2023', '2024', '2025'],
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80',
    1800000,
    1200000,
    'yearly',
    '{"version": "v2.4.0", "target_revit": "Revit 2022-2025", "author": "BIM MEP Automation Team"}'::jsonb
),
(
    'Batch Sheet Exporter & Auto Renaming Pro',
    'batch-sheet-exporter-auto-renaming',
    'tool',
    'Revit Add-in Tự Động Hóa',
    'Công cụ xuất hàng loạt bản vẽ PDF, DWG, NWC theo cú pháp chuẩn ISO 19650. Tự động đánh số và sắp xếp bản vẽ theo tiến độ dự án.',
    'Xuất hàng loạt PDF/DWG/NWC chuẩn ISO 19650, tiết kiệm 90% thời gian.',
    ARRAY['2021', '2022', '2023', '2024', '2025'],
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
    950000,
    750000,
    'yearly',
    '{"version": "v1.8.2", "target_revit": "Revit 2021-2025", "author": "BIM MEP Automation Team"}'::jsonb
);
