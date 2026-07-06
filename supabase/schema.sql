-- ============================================
-- BESLENME TAKİP SİSTEMİ - SUPABASE SQL ŞEMASI
-- ============================================
-- Bu dosyayı Supabase SQL Editor'a yapıştırın
-- Tüm tabloları, ilişkileri, triggerleri ve RLS politikalarını içerir
-- ============================================

-- Önce mevcut tabloları temizle (dikkatli kullan!)
DROP TABLE IF EXISTS public.weight_logs CASCADE;
DROP TABLE IF EXISTS public.daily_progress CASCADE;
DROP TABLE IF EXISTS public.meal_logs CASCADE;
DROP TABLE IF EXISTS public.nutrition_plans CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- ============================================
-- 1. USER PROFILES TABLOSU
-- ============================================
-- Kullanıcı profil bilgileri ve fiziksel özellikleri
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    
    -- Fiziksel özellikler
    age INTEGER CHECK (age > 0 AND age < 150),
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    height_cm INTEGER CHECK (height_cm > 0 AND height_cm < 300),
    current_weight_kg DECIMAL(5,2) CHECK (current_weight_kg > 0 AND current_weight_kg < 500),
    target_weight_kg DECIMAL(5,2) CHECK (target_weight_kg > 0 AND target_weight_kg < 500),
    
    -- Hedef ve aktivite
    activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
    goal TEXT CHECK (goal IN ('lose_weight', 'gain_weight', 'build_muscle', 'maintain')),
    
    -- Diyet tercihleri
    dietary_preferences TEXT[] DEFAULT '{}',
    allergies TEXT[] DEFAULT '{}',
    meal_count INTEGER DEFAULT 3 CHECK (meal_count >= 3 AND meal_count <= 6),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index'ler
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_user_profiles_created_at ON public.user_profiles(created_at);

-- ============================================
-- 2. NUTRITION PLANS TABLOSU
-- ============================================
-- Kullanıcıya özel beslenme planları
CREATE TABLE public.nutrition_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    
    -- Günlük hedefler
    daily_calories INTEGER NOT NULL CHECK (daily_calories > 0),
    protein_g DECIMAL(6,2) NOT NULL CHECK (protein_g >= 0),
    carbs_g DECIMAL(6,2) NOT NULL CHECK (carbs_g >= 0),
    fat_g DECIMAL(6,2) NOT NULL CHECK (fat_g >= 0),
    fiber_g DECIMAL(6,2) CHECK (fiber_g >= 0),
    
    -- Plan durumu
    is_active BOOLEAN DEFAULT true,
    plan_name TEXT,
    notes TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index'ler
CREATE INDEX idx_nutrition_plans_user_id ON public.nutrition_plans(user_id);
CREATE INDEX idx_nutrition_plans_active ON public.nutrition_plans(user_id, is_active) WHERE is_active = true;

-- ============================================
-- 3. MEAL LOGS TABLOSU
-- ============================================
-- Kullanıcıların öğün kayıtları
CREATE TABLE public.meal_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    
    -- Öğün bilgileri
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    meal_type TEXT NOT NULL,
    description TEXT NOT NULL,
    
    -- Besin değerleri (JSON formatında detaylı bilgi)
    food_items JSONB NOT NULL DEFAULT '[]',
    
    -- Toplam değerler (hızlı erişim için)
    total_calories DECIMAL(8,2) NOT NULL CHECK (total_calories >= 0),
    total_protein_g DECIMAL(6,2) CHECK (total_protein_g >= 0),
    total_carbs_g DECIMAL(6,2) CHECK (total_carbs_g >= 0),
    total_fat_g DECIMAL(6,2) CHECK (total_fat_g >= 0),
    
    -- AI analiz sonuçları
    ai_analysis TEXT,
    ai_suggestions TEXT,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index'ler
CREATE INDEX idx_meal_logs_user_date ON public.meal_logs(user_id, date DESC);
CREATE INDEX idx_meal_logs_meal_type ON public.meal_logs(user_id, meal_type);
CREATE INDEX idx_meal_logs_created_at ON public.meal_logs(created_at DESC);

-- ============================================
-- 4. DAILY PROGRESS TABLOSU
-- ============================================
-- Günlük ilerleme özeti
CREATE TABLE public.daily_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Tüketilen değerler
    calories_consumed DECIMAL(8,2) DEFAULT 0 CHECK (calories_consumed >= 0),
    protein_consumed_g DECIMAL(6,2) DEFAULT 0 CHECK (protein_consumed_g >= 0),
    carbs_consumed_g DECIMAL(6,2) DEFAULT 0 CHECK (carbs_consumed_g >= 0),
    fat_consumed_g DECIMAL(6,2) DEFAULT 0 CHECK (fat_consumed_g >= 0),
    
    -- Hedef değerler (o günkü plan)
    calories_target DECIMAL(8,2),
    protein_target_g DECIMAL(6,2),
    carbs_target_g DECIMAL(6,2),
    fat_target_g DECIMAL(6,2),
    
    -- İlerleme metrikleri
    goal_met BOOLEAN DEFAULT false,
    streak_days INTEGER DEFAULT 0 CHECK (streak_days >= 0),
    meal_count INTEGER DEFAULT 0 CHECK (meal_count >= 0),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Her kullanıcı için günde bir kayıt
    UNIQUE(user_id, date)
);

-- Index'ler
CREATE INDEX idx_daily_progress_user_date ON public.daily_progress(user_id, date DESC);
CREATE INDEX idx_daily_progress_streak ON public.daily_progress(user_id, streak_days DESC);

-- ============================================
-- 5. WEIGHT LOGS TABLOSU
-- ============================================
-- Kilo takibi
CREATE TABLE public.weight_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    weight_kg DECIMAL(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 500),
    
    -- Opsiyonel notlar
    notes TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Her kullanıcı için günde bir kilo kaydı
    UNIQUE(user_id, date)
);

-- Index'ler
CREATE INDEX idx_weight_logs_user_date ON public.weight_logs(user_id, date DESC);

-- ============================================
-- TRIGGERS
-- ============================================

-- 1. Updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nutrition_plans_updated_at
    BEFORE UPDATE ON public.nutrition_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meal_logs_updated_at
    BEFORE UPDATE ON public.meal_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_progress_updated_at
    BEFORE UPDATE ON public.daily_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 2. Yeni kullanıcı kaydında otomatik profil oluşturma
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, name, meal_count)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        3
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

-- 3. Meal log eklendiğinde daily_progress'i güncelle
CREATE OR REPLACE FUNCTION update_daily_progress_on_meal()
RETURNS TRIGGER AS $$
DECLARE
    v_nutrition_plan RECORD;
BEGIN
    -- Aktif beslenme planını al
    SELECT daily_calories, protein_g, carbs_g, fat_g
    INTO v_nutrition_plan
    FROM public.nutrition_plans
    WHERE user_id = NEW.user_id AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Daily progress kaydını oluştur veya güncelle
    INSERT INTO public.daily_progress (
        user_id,
        date,
        calories_consumed,
        protein_consumed_g,
        carbs_consumed_g,
        fat_consumed_g,
        calories_target,
        protein_target_g,
        carbs_target_g,
        fat_target_g,
        meal_count
    )
    VALUES (
        NEW.user_id,
        NEW.date,
        NEW.total_calories,
        NEW.total_protein_g,
        NEW.total_carbs_g,
        NEW.total_fat_g,
        COALESCE(v_nutrition_plan.daily_calories, 2000),
        COALESCE(v_nutrition_plan.protein_g, 150),
        COALESCE(v_nutrition_plan.carbs_g, 200),
        COALESCE(v_nutrition_plan.fat_g, 70),
        1
    )
    ON CONFLICT (user_id, date) DO UPDATE SET
        calories_consumed = daily_progress.calories_consumed + NEW.total_calories,
        protein_consumed_g = daily_progress.protein_consumed_g + NEW.total_protein_g,
        carbs_consumed_g = daily_progress.carbs_consumed_g + NEW.total_carbs_g,
        fat_consumed_g = daily_progress.fat_consumed_g + NEW.total_fat_g,
        meal_count = daily_progress.meal_count + 1,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_meal_log_insert
    AFTER INSERT ON public.meal_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_progress_on_meal();

-- 4. Meal log silindiğinde daily_progress'i güncelle
CREATE OR REPLACE FUNCTION update_daily_progress_on_meal_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.daily_progress
    SET
        calories_consumed = GREATEST(0, calories_consumed - OLD.total_calories),
        protein_consumed_g = GREATEST(0, protein_consumed_g - OLD.total_protein_g),
        carbs_consumed_g = GREATEST(0, carbs_consumed_g - OLD.total_carbs_g),
        fat_consumed_g = GREATEST(0, fat_consumed_g - OLD.total_fat_g),
        meal_count = GREATEST(0, meal_count - 1),
        updated_at = NOW()
    WHERE user_id = OLD.user_id AND date = OLD.date;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_meal_log_delete
    AFTER DELETE ON public.meal_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_progress_on_meal_delete();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLİTİKALARI
-- ============================================

-- RLS'i etkinleştir
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;

-- USER PROFILES politikaları
CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.user_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- NUTRITION PLANS politikaları
CREATE POLICY "Users can view own nutrition plans"
    ON public.nutrition_plans FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own nutrition plans"
    ON public.nutrition_plans FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own nutrition plans"
    ON public.nutrition_plans FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own nutrition plans"
    ON public.nutrition_plans FOR DELETE
    USING (auth.uid() = user_id);

-- MEAL LOGS politikaları
CREATE POLICY "Users can view own meal logs"
    ON public.meal_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meal logs"
    ON public.meal_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meal logs"
    ON public.meal_logs FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meal logs"
    ON public.meal_logs FOR DELETE
    USING (auth.uid() = user_id);

-- DAILY PROGRESS politikaları
CREATE POLICY "Users can view own daily progress"
    ON public.daily_progress FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily progress"
    ON public.daily_progress FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily progress"
    ON public.daily_progress FOR UPDATE
    USING (auth.uid() = user_id);

-- WEIGHT LOGS politikaları
CREATE POLICY "Users can view own weight logs"
    ON public.weight_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weight logs"
    ON public.weight_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weight logs"
    ON public.weight_logs FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own weight logs"
    ON public.weight_logs FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- YARDIMCI FONKSİYONLAR
-- ============================================

-- 1. Kullanıcının günlük istatistiklerini getir
CREATE OR REPLACE FUNCTION get_user_daily_stats(
    p_user_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    date DATE,
    calories_consumed DECIMAL,
    calories_target DECIMAL,
    protein_consumed DECIMAL,
    protein_target DECIMAL,
    carbs_consumed DECIMAL,
    carbs_target DECIMAL,
    fat_consumed DECIMAL,
    fat_target DECIMAL,
    meal_count INTEGER,
    goal_met BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        dp.date,
        dp.calories_consumed,
        dp.calories_target,
        dp.protein_consumed_g,
        dp.protein_target_g,
        dp.carbs_consumed_g,
        dp.carbs_target_g,
        dp.fat_consumed_g,
        dp.fat_target_g,
        dp.meal_count,
        dp.goal_met
    FROM public.daily_progress dp
    WHERE dp.user_id = p_user_id AND dp.date = p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Kullanıcının haftalık özetini getir
CREATE OR REPLACE FUNCTION get_user_weekly_summary(
    p_user_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days'
)
RETURNS TABLE (
    total_days INTEGER,
    avg_calories DECIMAL,
    avg_protein DECIMAL,
    avg_carbs DECIMAL,
    avg_fat DECIMAL,
    goals_met_count INTEGER,
    current_streak INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER as total_days,
        AVG(calories_consumed)::DECIMAL as avg_calories,
        AVG(protein_consumed_g)::DECIMAL as avg_protein,
        AVG(carbs_consumed_g)::DECIMAL as avg_carbs,
        AVG(fat_consumed_g)::DECIMAL as avg_fat,
        COUNT(*) FILTER (WHERE goal_met = true)::INTEGER as goals_met_count,
        MAX(streak_days)::INTEGER as current_streak
    FROM public.daily_progress
    WHERE user_id = p_user_id 
    AND date >= p_start_date
    AND date <= CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TEST VERİLERİ (Opsiyonel - Geliştirme için)
-- ============================================
-- Gerçek kullanımda bu bölümü kaldırabilirsiniz

-- Test kullanıcısı için örnek veri (sadece geliştirme ortamında)
-- NOT: Bu kısmı production'da çalıştırmayın!

-- ============================================
-- TAMAMLANDI! ✅
-- ============================================
-- Şema başarıyla oluşturuldu.
-- 
-- Sonraki adımlar:
-- 1. Supabase Dashboard > SQL Editor'a gidin
-- 2. Bu dosyanın içeriğini yapıştırın
-- 3. "Run" butonuna tıklayın
-- 4. Tüm tabloların oluştuğunu kontrol edin
-- 5. .env.local dosyanızdaki Supabase URL ve Key'leri kontrol edin
-- ============================================
