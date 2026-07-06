-- ============================================
-- SUPABASE DATABASE SIFIRLAMA
-- ============================================
-- DİKKAT: Bu kod TÜM VERİLERİ SİLER!
-- Sadece geliştirme/test ortamında kullanın
-- ============================================

-- Hata mesajlarını görmezden gel
DO $$ 
BEGIN
    -- 1. Trigger'ları sil
    EXECUTE 'DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users';
    EXECUTE 'DROP TRIGGER IF EXISTS on_meal_log_insert ON public.meal_logs';
    EXECUTE 'DROP TRIGGER IF EXISTS on_meal_log_delete ON public.meal_logs';
    EXECUTE 'DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles';
    EXECUTE 'DROP TRIGGER IF EXISTS update_nutrition_plans_updated_at ON public.nutrition_plans';
    EXECUTE 'DROP TRIGGER IF EXISTS update_meal_logs_updated_at ON public.meal_logs';
    EXECUTE 'DROP TRIGGER IF EXISTS update_daily_progress_updated_at ON public.daily_progress';
    
    RAISE NOTICE 'Trigger''lar silindi ✓';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Trigger silme hatası (normal olabilir): %', SQLERRM;
END $$;

-- 2. Fonksiyonları sil
DROP FUNCTION IF EXISTS public.create_user_profile() CASCADE;
DROP FUNCTION IF EXISTS public.update_daily_progress_on_meal() CASCADE;
DROP FUNCTION IF EXISTS public.update_daily_progress_on_meal_delete() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_daily_stats(UUID, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_weekly_summary(UUID, DATE) CASCADE;

-- 3. Tabloları sil (CASCADE ile ilişkili her şey silinir)
DROP TABLE IF EXISTS public.weight_logs CASCADE;
DROP TABLE IF EXISTS public.daily_progress CASCADE;
DROP TABLE IF EXISTS public.meal_logs CASCADE;
DROP TABLE IF EXISTS public.nutrition_plans CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- 4. Auth kullanıcılarını sil (DİKKAT: Tüm kullanıcılar silinir!)
-- Sadece test ortamında kullan!
DO $$ 
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id FROM auth.users LOOP
        DELETE FROM auth.users WHERE id = user_record.id;
    END LOOP;
    RAISE NOTICE 'Auth kullanıcıları silindi ✓';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Auth kullanıcı silme hatası: %', SQLERRM;
END $$;

-- ============================================
-- SIFIRLAMA TAMAMLANDI! ✅
-- ============================================
-- Şimdi ne yapmalısın:
-- 1. supabase-schema.sql dosyasını çalıştır
-- 2. Yeni kullanıcı oluştur
-- ============================================
