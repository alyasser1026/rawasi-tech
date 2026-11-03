-- Restore pre-phase-3 guards without rewriting business rows. Run transactionally.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DROP FUNCTION public.save_journal_draft(uuid,date,text,jsonb);
DROP TRIGGER journal_balance_headers ON public.journal_headers;
DROP TRIGGER journal_balance_lines ON public.journal_lines;
DROP TRIGGER trg_journal_write_state ON public.journal_headers;
DROP TRIGGER trg_protect_journal_lines ON public.journal_lines;
CREATE OR REPLACE FUNCTION rawasi_private.protect_journal_headers()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
    -- 🛑 منع تعديل القيود المرحلة
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status IN ('مرحل', 'معتمد') THEN
            -- السماح للمستخدم بتغيير الحالة فقط إلى (مسودة) أو (ملغي) في حالة فك الترحيل
            -- مع منع تغيير أي بيانات جوهرية أخرى
            IF NEW.status NOT IN ('مرحل', 'معتمد') THEN
                IF NEW.entry_date != OLD.entry_date OR NEW.description != OLD.description THEN
                     RAISE EXCEPTION 'مرفوض: يجب فك الترحيل أولاً لتعديل البيانات الأساسية.';
                END IF;
                RETURN NEW;
            END IF;

            -- إذا حاول التعديل مع إبقاء الحالة "مرحل"
            IF NEW.description != OLD.description OR NEW.entry_date != OLD.entry_date OR NEW.reference_id != OLD.reference_id THEN
                RAISE EXCEPTION 'مرفوض: لا يمكن تعديل قيد حالته % (يرجى فك الترحيل أولاً)', OLD.status;
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    -- تم السماح بعملية الـ DELETE من قاعدة البيانات لتسمح لنظام (فك الترحيل) بحذف القيد تلقائياً.
    -- (تم حظر الحذف اليدوي من شاشة الواجهة بشكل منفصل لعدم التلاعب).
    RETURN OLD;
END;
$function$;
CREATE OR REPLACE FUNCTION rawasi_private.protect_journal_lines()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_status VARCHAR;
BEGIN
    -- جلب حالة القيد
    SELECT status INTO v_status FROM journal_headers WHERE id = NEW.header_id;

    IF v_status IN ('مرحل', 'معتمد') THEN
        IF TG_OP = 'UPDATE' THEN
            RAISE EXCEPTION 'مرفوض: لا يمكن تعديل مبالغ أو حسابات لسطر في قيد مرحل';
        ELSIF TG_OP = 'INSERT' THEN
            RAISE EXCEPTION 'مرفوض: لا يمكن إضافة سطر جديد لقيد مرحل';
        END IF;
    END IF;

    -- تم تجاوز عملية DELETE هنا أيضاً للسماح بالـ CASCADE عندما يقوم النظام بمسح الرأس أثناء فك الترحيل
    RETURN NEW;
END;
$function$;
CREATE TRIGGER trg_protect_journal_lines BEFORE INSERT OR UPDATE ON public.journal_lines FOR EACH ROW EXECUTE FUNCTION rawasi_private.protect_journal_lines();
ALTER TABLE public.journal_lines DROP CONSTRAINT journal_lines_debit_nonnegative_finite, DROP CONSTRAINT journal_lines_credit_nonnegative_finite, DROP CONSTRAINT journal_lines_one_sided_amount;
DROP FUNCTION rawasi_private.track_journal_write_state();
DROP FUNCTION rawasi_private.enforce_journal_balance();
DROP TABLE rawasi_private.journal_write_state;
NOTIFY pgrst,'reload schema';
