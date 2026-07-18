-- ============================================
-- BESLENME TAKİP SİSTEMİ — SUPABASE SQL ŞEMASI
-- ============================================
-- Yeni Supabase projesinde: Dashboard → SQL Editor → bu dosyayı yapıştır → Run
-- Tablolar, indexler, RLS, trigger'lar ve RPC fonksiyonları tek dosyadadır.
-- ============================================

-- Varsa eski nesneleri temizle
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TABLE IF EXISTS public.weight_logs CASCADE;
DROP TABLE IF EXISTS public.daily_progress CASCADE;
DROP TABLE IF EXISTS public.meal_logs CASCADE;
DROP TABLE IF EXISTS public.nutrition_plans CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.create_user_profile() CASCADE;
DROP FUNCTION IF EXISTS public.update_daily_progress_on_meal() CASCADE;
DROP FUNCTION IF EXISTS public.update_daily_progress_on_meal_delete() CASCADE;
-- (Kaldırılan kullanılmayan istatistik RPC'leri — mevcut kurulumlardan da temizlenir)
DROP FUNCTION IF EXISTS public.get_user_daily_stats(UUID, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_weekly_summary(UUID, DATE) CASCADE;

-- ============================================
-- 1. TABLOLAR
-- ============================================

CREATE TABLE public.user_profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email           TEXT NOT NULL UNIQUE,
    name            TEXT,
    age             INTEGER CHECK (age > 0 AND age < 150),
    gender          TEXT CHECK (gender IN ('male', 'female', 'other')),
    height_cm       INTEGER CHECK (height_cm > 0 AND height_cm < 300),
    current_weight_kg DECIMAL(5,2) CHECK (current_weight_kg > 0 AND current_weight_kg < 500),
    target_weight_kg  DECIMAL(5,2) CHECK (target_weight_kg > 0 AND target_weight_kg < 500),
    activity_level  TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
    goal            TEXT CHECK (goal IN ('lose_weight', 'gain_weight', 'build_muscle', 'maintain')),
    dietary_preferences TEXT[] DEFAULT '{}',
    allergies       TEXT[] DEFAULT '{}',
    meal_count      INTEGER DEFAULT 3 CHECK (meal_count >= 3 AND meal_count <= 6),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);

CREATE TABLE public.nutrition_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    daily_calories  INTEGER NOT NULL CHECK (daily_calories > 0),
    protein_g       DECIMAL(6,2) NOT NULL CHECK (protein_g >= 0),
    carbs_g         DECIMAL(6,2) NOT NULL CHECK (carbs_g >= 0),
    fat_g           DECIMAL(6,2) NOT NULL CHECK (fat_g >= 0),
    fiber_g         DECIMAL(6,2) CHECK (fiber_g >= 0),
    is_active       BOOLEAN DEFAULT true,
    plan_name       TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nutrition_plans_user_id ON public.nutrition_plans(user_id);
CREATE INDEX idx_nutrition_plans_active  ON public.nutrition_plans(user_id, is_active) WHERE is_active = true;

CREATE TABLE public.meal_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    date            DATE NOT NULL DEFAULT CURRENT_DATE,
    meal_type       TEXT NOT NULL,
    description     TEXT NOT NULL,
    food_items      JSONB NOT NULL DEFAULT '[]',
    total_calories  DECIMAL(8,2) NOT NULL CHECK (total_calories >= 0),
    total_protein_g DECIMAL(6,2) CHECK (total_protein_g >= 0),
    total_carbs_g   DECIMAL(6,2) CHECK (total_carbs_g >= 0),
    total_fat_g     DECIMAL(6,2) CHECK (total_fat_g >= 0),
    ai_analysis     TEXT,
    ai_suggestions  TEXT,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meal_logs_user_date  ON public.meal_logs(user_id, date DESC);
CREATE INDEX idx_meal_logs_meal_type  ON public.meal_logs(user_id, meal_type);
CREATE INDEX idx_meal_logs_created_at ON public.meal_logs(created_at DESC);

CREATE TABLE public.daily_progress (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    date                DATE NOT NULL DEFAULT CURRENT_DATE,
    calories_consumed   DECIMAL(8,2) DEFAULT 0 CHECK (calories_consumed >= 0),
    protein_consumed_g  DECIMAL(6,2) DEFAULT 0 CHECK (protein_consumed_g >= 0),
    carbs_consumed_g    DECIMAL(6,2) DEFAULT 0 CHECK (carbs_consumed_g >= 0),
    fat_consumed_g      DECIMAL(6,2) DEFAULT 0 CHECK (fat_consumed_g >= 0),
    calories_target     DECIMAL(8,2),
    protein_target_g    DECIMAL(6,2),
    carbs_target_g      DECIMAL(6,2),
    fat_target_g        DECIMAL(6,2),
    goal_met            BOOLEAN DEFAULT false,
    meal_count          INTEGER DEFAULT 0 CHECK (meal_count >= 0),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_progress_user_date ON public.daily_progress(user_id, date DESC);

CREATE TABLE public.weight_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    weight_kg   DECIMAL(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 500),
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

CREATE INDEX idx_weight_logs_user_date ON public.weight_logs(user_id, date DESC);

-- ============================================
-- 2. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.user_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_progress  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_logs     ENABLE ROW LEVEL SECURITY;

-- user_profiles
CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
    ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE USING (auth.uid() = id);

-- nutrition_plans
CREATE POLICY "Users can view own nutrition plans"
    ON public.nutrition_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own nutrition plans"
    ON public.nutrition_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own nutrition plans"
    ON public.nutrition_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own nutrition plans"
    ON public.nutrition_plans FOR DELETE USING (auth.uid() = user_id);

-- meal_logs
CREATE POLICY "Users can view own meal logs"
    ON public.meal_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meal logs"
    ON public.meal_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meal logs"
    ON public.meal_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meal logs"
    ON public.meal_logs FOR DELETE USING (auth.uid() = user_id);

-- daily_progress
CREATE POLICY "Users can view own daily progress"
    ON public.daily_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily progress"
    ON public.daily_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily progress"
    ON public.daily_progress FOR UPDATE USING (auth.uid() = user_id);

-- weight_logs
CREATE POLICY "Users can view own weight logs"
    ON public.weight_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own weight logs"
    ON public.weight_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weight logs"
    ON public.weight_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own weight logs"
    ON public.weight_logs FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 3. TRIGGER FONKSİYONLARI
-- ============================================

-- 3a. updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nutrition_plans_updated_at
    BEFORE UPDATE ON public.nutrition_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meal_logs_updated_at
    BEFORE UPDATE ON public.meal_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_progress_updated_at
    BEFORE UPDATE ON public.daily_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3b. Yeni auth kullanıcısında otomatik profil oluşturma
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- 3c. Meal log INSERT → daily_progress upsert + goal_met hesaplama
CREATE OR REPLACE FUNCTION update_daily_progress_on_meal()
RETURNS TRIGGER AS $$
DECLARE
    v_plan RECORD;
    v_target_cal DECIMAL;
BEGIN
    SELECT daily_calories, protein_g, carbs_g, fat_g
    INTO v_plan
    FROM public.nutrition_plans
    WHERE user_id = NEW.user_id AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;

    v_target_cal := COALESCE(v_plan.daily_calories, 2000);

    INSERT INTO public.daily_progress (
        user_id, date,
        calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g,
        calories_target, protein_target_g, carbs_target_g, fat_target_g,
        meal_count, goal_met
    ) VALUES (
        NEW.user_id, NEW.date,
        NEW.total_calories, NEW.total_protein_g, NEW.total_carbs_g, NEW.total_fat_g,
        v_target_cal,
        COALESCE(v_plan.protein_g, 150),
        COALESCE(v_plan.carbs_g, 200),
        COALESCE(v_plan.fat_g, 70),
        1,
        NEW.total_calories >= v_target_cal * 0.8
    )
    ON CONFLICT (user_id, date) DO UPDATE SET
        calories_consumed  = daily_progress.calories_consumed  + EXCLUDED.calories_consumed,
        protein_consumed_g = daily_progress.protein_consumed_g + EXCLUDED.protein_consumed_g,
        carbs_consumed_g   = daily_progress.carbs_consumed_g   + EXCLUDED.carbs_consumed_g,
        fat_consumed_g     = daily_progress.fat_consumed_g     + EXCLUDED.fat_consumed_g,
        meal_count         = daily_progress.meal_count + 1,
        goal_met           = (daily_progress.calories_consumed + EXCLUDED.calories_consumed)
                             >= COALESCE(daily_progress.calories_target, 2000) * 0.8,
        updated_at         = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE TRIGGER on_meal_log_insert
    AFTER INSERT ON public.meal_logs
    FOR EACH ROW EXECUTE FUNCTION update_daily_progress_on_meal();

-- 3d. Meal log DELETE → daily_progress güncelle + goal_met yeniden hesapla
CREATE OR REPLACE FUNCTION update_daily_progress_on_meal_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.daily_progress
    SET
        calories_consumed  = GREATEST(0, calories_consumed  - OLD.total_calories),
        protein_consumed_g = GREATEST(0, protein_consumed_g - OLD.total_protein_g),
        carbs_consumed_g   = GREATEST(0, carbs_consumed_g   - OLD.total_carbs_g),
        fat_consumed_g     = GREATEST(0, fat_consumed_g     - OLD.total_fat_g),
        meal_count         = GREATEST(0, meal_count - 1),
        goal_met           = GREATEST(0, calories_consumed - OLD.total_calories)
                             >= COALESCE(calories_target, 2000) * 0.8,
        updated_at         = NOW()
    WHERE user_id = OLD.user_id AND date = OLD.date;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE TRIGGER on_meal_log_delete
    AFTER DELETE ON public.meal_logs
    FOR EACH ROW EXECUTE FUNCTION update_daily_progress_on_meal_delete();

-- ============================================
-- 4. YETKİ SIKILAŞTIRMA
-- ============================================
-- Trigger fonksiyonları REST API üzerinden (/rest/v1/rpc/...) çağrılamamalı;
-- sadece trigger context'inde tetiklenmeliler.
REVOKE EXECUTE ON FUNCTION public.create_user_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_daily_progress_on_meal() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_daily_progress_on_meal_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- ============================================
-- KURULUM TAMAMLANDI
-- ============================================
-- Sonraki adımlar:
-- 1. Supabase Dashboard → Settings → API → URL ve anon key'i kopyala
-- 2. apps/web/.env.local içindeki NEXT_PUBLIC_SUPABASE_URL ve _ANON_KEY'i güncelle
-- 3. apps/mobile/.env içindeki EXPO_PUBLIC_SUPABASE_URL ve _ANON_KEY'i güncelle
-- 4. Supabase Dashboard → Authentication → Settings:
--    - Email auth açık olmalı (varsayılan)
--    - "Confirm email" tercihe göre (geliştirme için kapatılabilir)
--    - Site URL: http://localhost:3000
--    - Redirect URLs: http://localhost:3000/auth/callback
-- ============================================
