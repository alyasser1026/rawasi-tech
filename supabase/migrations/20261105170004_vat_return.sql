-- Internal VAT return with an explicit tax review for each document.
-- Source documents and the general ledger are never changed by a VAT review.
BEGIN;

CREATE TABLE public.vat_document_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id),
    source text NOT NULL CHECK (source IN ('invoice', 'expense', 'note')),
    source_id uuid NOT NULL,
    invoice_id uuid GENERATED ALWAYS AS (CASE WHEN source = 'invoice' THEN source_id END) STORED,
    expense_id uuid GENERATED ALWAYS AS (CASE WHEN source = 'expense' THEN source_id END) STORED,
    note_id uuid GENERATED ALWAYS AS (CASE WHEN source = 'note' THEN source_id END) STORED,
    category text NOT NULL,
    effective_tax_date date NOT NULL CHECK (isfinite(effective_tax_date)),
    recoverable_vat numeric(15,2) CHECK (recoverable_vat >= 0 AND recoverable_vat <> 'NaN'::numeric),
    evidence text NOT NULL CHECK (length(btrim(evidence)) BETWEEN 1 AND 500),
    source_document_date date NOT NULL,
    source_base numeric(15,2) NOT NULL,
    source_tax numeric(15,2) NOT NULL,
    source_skip_zatca boolean,
    source_journal_id uuid NOT NULL,
    reviewed_by uuid NOT NULL,
    reviewed_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, company_id),
    UNIQUE (company_id, source, source_id),
    FOREIGN KEY (invoice_id, company_id) REFERENCES public.invoices(id, company_id) ON DELETE CASCADE,
    FOREIGN KEY (expense_id, company_id) REFERENCES public.expenses(id, company_id) ON DELETE CASCADE,
    FOREIGN KEY (note_id, company_id) REFERENCES public.invoice_adjustment_notes(id, company_id) ON DELETE CASCADE,
    CHECK (
        (source IN ('invoice', 'note') AND recoverable_vat IS NULL AND category IN (
            'standard_sales', 'zero_sales', 'export_sales', 'exempt_sales', 'outside_scope'
        )) OR
        (source = 'expense' AND (
            (category IN ('standard_purchases', 'imports_paid') AND recoverable_vat IS NOT NULL)
            OR (category IN ('zero_purchases', 'exempt_purchases', 'outside_scope', 'noncompliant_purchase')
                AND recoverable_vat IS NULL)
        ))
    )
);

INSERT INTO rawasi_private.company_scoped_tables (table_name) VALUES ('vat_document_reviews');
CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.vat_document_reviews
    FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.vat_document_reviews
    FOR EACH ROW EXECUTE FUNCTION rawasi_private.log_audit_event();
ALTER TABLE public.vat_document_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY module_view ON public.vat_document_reviews FOR SELECT TO authenticated USING (
    rawasi_private.can_access('vat_return', 'view')
    AND rawasi_private.can_access('invoices', 'view')
    AND rawasi_private.can_access('expenses', 'view')
    AND rawasi_private.can_access('journal', 'view')
    AND company_id = (SELECT rawasi_private.current_company_id())
);
REVOKE ALL ON public.vat_document_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vat_document_reviews TO authenticated;

CREATE TABLE public.vat_period_adjustments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id),
    period_from date NOT NULL CHECK (isfinite(period_from)),
    period_to date NOT NULL CHECK (isfinite(period_to) AND period_to >= period_from AND period_to - period_from <= 366),
    prior_period_adjustment numeric(15,2) NOT NULL DEFAULT 0
        CHECK (prior_period_adjustment <> 'NaN'::numeric AND prior_period_adjustment::text NOT IN ('Infinity', '-Infinity')),
    carried_forward_credit numeric(15,2) NOT NULL DEFAULT 0
        CHECK (carried_forward_credit >= 0 AND carried_forward_credit <> 'NaN'::numeric AND carried_forward_credit < 'Infinity'::numeric),
    evidence text NOT NULL CHECK (length(btrim(evidence)) BETWEEN 1 AND 500),
    reviewed_by uuid NOT NULL,
    reviewed_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, company_id),
    UNIQUE (company_id, period_from, period_to)
);

INSERT INTO rawasi_private.company_scoped_tables (table_name) VALUES ('vat_period_adjustments');
CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.vat_period_adjustments
    FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.vat_period_adjustments
    FOR EACH ROW EXECUTE FUNCTION rawasi_private.log_audit_event();
ALTER TABLE public.vat_period_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY module_view ON public.vat_period_adjustments FOR SELECT TO authenticated USING (
    rawasi_private.can_access('vat_return', 'view')
    AND rawasi_private.can_access('invoices', 'view')
    AND rawasi_private.can_access('expenses', 'view')
    AND rawasi_private.can_access('journal', 'view')
    AND company_id = (SELECT rawasi_private.current_company_id())
);
REVOKE ALL ON public.vat_period_adjustments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vat_period_adjustments TO authenticated;

-- Match financial sources using the document reference and the journal's company and type.
-- Rows whose posting flag disagrees with their journal still surface for review.
CREATE VIEW rawasi_private.vat_document_sources WITH (security_invoker = true) AS
    SELECT i.company_id, 'invoice'::text AS source, i.id AS source_id, i.id AS invoice_id,
           i.invoice_number::text AS reference, i.date AS document_date,
           coalesce(i.taxable_amount, 0) AS base, coalesce(i.tax_amount, 0) AS recorded_tax,
           i.skip_zatca AS skip_zatca, j.id AS journal_id, j.posted_count,
           NULL::text AS note_type
    FROM public.invoices i
    LEFT JOIN LATERAL (
        SELECT (array_agg(h.id ORDER BY h.id))[1] AS id, count(*) AS posted_count
        FROM public.journal_headers h
        WHERE h.company_id = i.company_id AND h.reference_id = i.id
          AND h.v_type IN ('invoices', 'invoice', 'فاتورة مبيعات')
          AND h.status IN ('posted', 'مرحل', 'معتمد')
    ) j ON true
    WHERE i.company_id = (SELECT rawasi_private.current_company_id())
      AND (j.posted_count > 0 OR i.status IN ('posted', 'مرحل', 'معتمد', 'مدفوع', 'مسدد جزئي', 'مغلق'))

    UNION ALL
    SELECT e.company_id, 'expense', e.id, NULL::uuid, e.id::text, e.exp_date,
           coalesce(e.total_price, 0) - coalesce(e.discount_amount, 0), coalesce(e.vat_amount, 0),
           NULL::boolean, j.id, j.posted_count, NULL::text
    FROM public.expenses e
    LEFT JOIN LATERAL (
        SELECT (array_agg(h.id ORDER BY h.id))[1] AS id, count(*) AS posted_count
        FROM public.journal_headers h
        WHERE h.company_id = e.company_id AND h.reference_id = e.id
          AND h.v_type IN ('expense', 'expenses') AND h.status IN ('posted', 'مرحل', 'معتمد')
    ) j ON true
    WHERE e.company_id = (SELECT rawasi_private.current_company_id())
      AND (j.posted_count > 0 OR (e.is_posted AND NOT coalesce(e.is_deleted, false)))

    UNION ALL
    SELECT n.company_id, 'note', n.id, n.invoice_id, n.note_number, n.note_date,
           CASE n.note_type WHEN 'credit' THEN -n.base_amount ELSE n.base_amount END,
           CASE n.note_type WHEN 'credit' THEN -n.tax_amount ELSE n.tax_amount END,
           i.skip_zatca, h.id,
           CASE WHEN h.id IS NOT NULL AND oh.id IS NOT NULL THEN 1 ELSE 0 END,
           n.note_type
    FROM public.invoice_adjustment_notes n
    JOIN public.invoices i ON i.id = n.invoice_id AND i.company_id = n.company_id
    LEFT JOIN public.journal_headers h ON h.id = n.journal_header_id AND h.company_id = n.company_id
      AND h.reference_id = n.id AND h.status IN ('posted', 'مرحل', 'معتمد')
    LEFT JOIN public.journal_headers oh ON oh.id = n.original_journal_id AND oh.company_id = n.company_id
      AND oh.reference_id = i.id AND oh.v_type IN ('invoices', 'invoice', 'فاتورة مبيعات')
      AND oh.status IN ('posted', 'مرحل', 'معتمد')
    WHERE n.company_id = (SELECT rawasi_private.current_company_id());

CREATE VIEW rawasi_private.vat_document_review_state WITH (security_invoker = true) AS
    WITH matched AS (
        SELECT d.*, r.id AS review_id, r.category, r.effective_tax_date, r.recoverable_vat, r.evidence,
               (d.posted_count = 1
                   AND d.journal_id = r.source_journal_id
                   AND d.document_date = r.source_document_date
                   AND d.base = r.source_base AND d.recorded_tax = r.source_tax
                   AND d.skip_zatca IS NOT DISTINCT FROM r.source_skip_zatca) AS matches_review,
               CASE WHEN oi.posted_count = 1
                        AND oi.journal_id = ro.source_journal_id
                        AND oi.document_date = ro.source_document_date
                        AND oi.base = ro.source_base AND oi.recorded_tax = ro.source_tax
                        AND oi.skip_zatca IS NOT DISTINCT FROM ro.source_skip_zatca
                    THEN ro.category END AS original_category
        FROM rawasi_private.vat_document_sources d
        LEFT JOIN public.vat_document_reviews r ON r.company_id = d.company_id
          AND r.source = d.source AND r.source_id = d.source_id
        LEFT JOIN rawasi_private.vat_document_sources oi ON d.source = 'note'
          AND oi.source = 'invoice' AND oi.company_id = d.company_id AND oi.source_id = d.invoice_id
        LEFT JOIN public.vat_document_reviews ro ON ro.company_id = oi.company_id
          AND ro.source = 'invoice' AND ro.source_id = oi.source_id
    )
    SELECT *,
           coalesce(matches_review AND (source <> 'note' OR category = original_category), false) AS is_confirmed
    FROM matched;

REVOKE ALL ON rawasi_private.vat_document_sources, rawasi_private.vat_document_review_state FROM PUBLIC, anon, authenticated;
GRANT SELECT ON rawasi_private.vat_document_sources, rawasi_private.vat_document_review_state TO authenticated;

CREATE FUNCTION rawasi_private.require_vat_report_access(p_action text)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    v_company uuid := rawasi_private.current_company_id();
BEGIN
    IF auth.uid() IS NULL OR v_company IS NULL
        OR NOT rawasi_private.can_access('vat_return', 'view')
        OR NOT rawasi_private.can_access('vat_return', p_action)
        OR NOT rawasi_private.can_access('invoices', 'view')
        OR NOT rawasi_private.can_access('expenses', 'view')
        OR NOT rawasi_private.can_access('journal', 'view') THEN
        RAISE EXCEPTION 'تحتاج صلاحية الإقرار الضريبي والاطلاع على الفواتير والمصروفات واليومية' USING ERRCODE = '42501';
    END IF;
    RETURN v_company;
END;
$$;
REVOKE ALL ON FUNCTION rawasi_private.require_vat_report_access(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rawasi_private.require_vat_report_access(text) TO authenticated;

CREATE FUNCTION public.save_vat_document_review(
    p_source text, p_source_id uuid, p_category text, p_effective_tax_date date,
    p_recoverable_vat numeric, p_evidence text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_company uuid := rawasi_private.require_vat_report_access('edit');
    d rawasi_private.vat_document_review_state%ROWTYPE;
    v_id uuid;
BEGIN
    IF p_source IS NULL OR p_source NOT IN ('invoice', 'expense', 'note') OR p_source_id IS NULL
        OR p_category IS NULL OR p_effective_tax_date IS NULL OR NOT isfinite(p_effective_tax_date)
        OR p_evidence IS NULL OR length(btrim(p_evidence)) NOT BETWEEN 1 AND 500 THEN
        RAISE EXCEPTION 'حدد المستند والتصنيف وتاريخ الاستحقاق الضريبي ومرجع المراجعة' USING ERRCODE = '22023';
    END IF;

    SELECT s.* INTO d FROM rawasi_private.vat_document_review_state s
    WHERE s.company_id = v_company AND s.source = p_source AND s.source_id = p_source_id;
    IF NOT FOUND OR d.posted_count <> 1 THEN
        RAISE EXCEPTION 'المستند غير متاح للمراجعة أو ليس له قيد مرحّل واحد مطابق' USING ERRCODE = '22023';
    END IF;
    IF d.base::text IN ('NaN', 'Infinity', '-Infinity') OR d.recorded_tax::text IN ('NaN', 'Infinity', '-Infinity')
        OR (p_source <> 'note' AND (d.base < 0 OR d.recorded_tax < 0)) THEN
        RAISE EXCEPTION 'مبالغ المستند غير صالحة للتصنيف' USING ERRCODE = '22023';
    END IF;
    IF p_source = 'note' AND p_category IS DISTINCT FROM d.original_category THEN
        RAISE EXCEPTION 'راجع تصنيف الفاتورة الأصلية أولاً واستخدم نفس التصنيف للإشعار' USING ERRCODE = '22023';
    END IF;

    IF p_source IN ('invoice', 'note') THEN
        IF p_recoverable_vat IS NOT NULL OR p_category NOT IN (
            'standard_sales', 'zero_sales', 'export_sales', 'exempt_sales', 'outside_scope'
        ) OR (p_category = 'standard_sales' AND (abs(d.base) <= 0 OR d.skip_zatca IS TRUE
            OR (p_source = 'invoice' AND abs(d.recorded_tax) <= 0)))
          OR (p_category <> 'standard_sales' AND d.recorded_tax <> 0) THEN
            RAISE EXCEPTION 'تصنيف المبيعات لا يطابق قيمة الضريبة المسجلة على المستند' USING ERRCODE = '22023';
        END IF;
    ELSE
        IF p_category NOT IN ('standard_purchases', 'imports_paid', 'zero_purchases', 'exempt_purchases',
                              'outside_scope', 'noncompliant_purchase') THEN
            RAISE EXCEPTION 'تصنيف المشتريات غير متاح' USING ERRCODE = '22023';
        ELSIF p_category IN ('standard_purchases', 'imports_paid') THEN
            IF d.base <= 0 OR d.recorded_tax <= 0 OR p_recoverable_vat IS NULL
                OR p_recoverable_vat NOT BETWEEN 0 AND d.recorded_tax
                OR p_recoverable_vat <> round(p_recoverable_vat, 2) THEN
                RAISE EXCEPTION 'أدخل ضريبة قابلة للخصم لا تتجاوز الضريبة المسجلة على مستند الشراء' USING ERRCODE = '22023';
            END IF;
        ELSIF p_recoverable_vat IS NOT NULL OR (p_category <> 'noncompliant_purchase' AND d.recorded_tax <> 0) THEN
            RAISE EXCEPTION 'تصنيف المشتريات لا يطابق قيمة الضريبة المسجلة على المستند' USING ERRCODE = '22023';
        END IF;
    END IF;

    INSERT INTO public.vat_document_reviews AS r (
        company_id, source, source_id, category, effective_tax_date, recoverable_vat, evidence,
        source_document_date, source_base, source_tax, source_skip_zatca, source_journal_id, reviewed_by
    ) VALUES (
        v_company, p_source, p_source_id, p_category, p_effective_tax_date, p_recoverable_vat, btrim(p_evidence),
        d.document_date, d.base, d.recorded_tax, d.skip_zatca, d.journal_id, auth.uid()
    )
    ON CONFLICT (company_id, source, source_id) DO UPDATE SET
        category = excluded.category, effective_tax_date = excluded.effective_tax_date,
        recoverable_vat = excluded.recoverable_vat, evidence = excluded.evidence,
        source_document_date = excluded.source_document_date, source_base = excluded.source_base,
        source_tax = excluded.source_tax, source_skip_zatca = excluded.source_skip_zatca,
        source_journal_id = excluded.source_journal_id,
        reviewed_by = excluded.reviewed_by, reviewed_at = now()
    RETURNING r.id INTO v_id;
    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_vat_document_review(text, uuid, text, date, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_vat_document_review(text, uuid, text, date, numeric, text) TO authenticated;

CREATE FUNCTION public.save_vat_period_adjustments(
    p_from date, p_to date,
    p_prior_period_adjustment numeric,
    p_carried_forward_credit numeric,
    p_evidence text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_company uuid := rawasi_private.require_vat_report_access('edit');
    v_id uuid;
BEGIN
    IF p_from IS NULL OR p_to IS NULL OR NOT isfinite(p_from) OR NOT isfinite(p_to)
        OR p_to < p_from OR p_to - p_from > 366 THEN
        RAISE EXCEPTION 'حدد فترة ضريبية صحيحة لا تزيد على سنة' USING ERRCODE = '22023';
    END IF;
    IF p_prior_period_adjustment IS NULL
        OR p_prior_period_adjustment::text IN ('NaN', 'Infinity', '-Infinity')
        OR p_prior_period_adjustment <> round(p_prior_period_adjustment, 2) THEN
        RAISE EXCEPTION 'أدخل قيمة صحيحة لتصحيحات الفترات السابقة (خانة 14)' USING ERRCODE = '22023';
    END IF;
    IF p_carried_forward_credit IS NULL
        OR p_carried_forward_credit::text IN ('NaN', 'Infinity', '-Infinity')
        OR p_carried_forward_credit < 0
        OR p_carried_forward_credit <> round(p_carried_forward_credit, 2) THEN
        RAISE EXCEPTION 'أدخل رصيداً دائناً مرحلاً غير سالب (خانة 15)' USING ERRCODE = '22023';
    END IF;
    IF p_evidence IS NULL OR length(btrim(p_evidence)) NOT BETWEEN 1 AND 500 THEN
        RAISE EXCEPTION 'أدخل بيان أو مرجع اعتماد تسويات الفترة (خانة 14 و15)' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.vat_period_adjustments AS pa (
        company_id, period_from, period_to,
        prior_period_adjustment, carried_forward_credit,
        evidence, reviewed_by
    ) VALUES (
        v_company, p_from, p_to,
        p_prior_period_adjustment, p_carried_forward_credit,
        btrim(p_evidence), auth.uid()
    )
    ON CONFLICT (company_id, period_from, period_to) DO UPDATE SET
        prior_period_adjustment = excluded.prior_period_adjustment,
        carried_forward_credit = excluded.carried_forward_credit,
        evidence = excluded.evidence,
        reviewed_by = excluded.reviewed_by,
        reviewed_at = now()
    RETURNING pa.id INTO v_id;
    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_vat_period_adjustments(date, date, numeric, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_vat_period_adjustments(date, date, numeric, numeric, text) TO authenticated;

CREATE FUNCTION public.get_vat_return(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    v_company uuid := rawasi_private.require_vat_report_access('view');
    v_account uuid := rawasi_private.company_account_id('215');
BEGIN
    IF p_from IS NULL OR p_to IS NULL OR NOT isfinite(p_from) OR NOT isfinite(p_to)
        OR p_to < p_from OR p_to - p_from > 366 THEN
        RAISE EXCEPTION 'حدد فترة ضريبية صحيحة لا تزيد على سنة' USING ERRCODE = '22023';
    END IF;

    RETURN (
        WITH entries AS MATERIALIZED (
            SELECT d.*, d.document_date BETWEEN p_from AND p_to AS in_document_period,
                   d.is_confirmed AND d.effective_tax_date BETWEEN p_from AND p_to AS in_tax_period
            FROM rawasi_private.vat_document_review_state d
            WHERE d.company_id = v_company AND (d.document_date BETWEEN p_from AND p_to
                OR d.effective_tax_date BETWEEN p_from AND p_to)
        ),
        transactions AS MATERIALIZED (
            SELECT e.*,
                CASE WHEN e.is_confirmed THEN e.effective_tax_date END AS tax_date,
                CASE WHEN NOT e.is_confirmed THEN 'review'
                     WHEN e.category IN ('outside_scope', 'noncompliant_purchase') THEN 'excluded'
                     ELSE 'confirmed' END AS status,
                CASE WHEN NOT e.is_confirmed THEN NULL::numeric
                     WHEN e.category IN ('outside_scope', 'noncompliant_purchase') THEN 0
                     WHEN e.source = 'expense' THEN coalesce(e.recoverable_vat, 0)
                     ELSE e.recorded_tax END AS confirmed_tax,
                CASE WHEN e.is_confirmed THEN NULL::text
                     WHEN e.posted_count = 0 THEN 'missing_posted_journal'
                     WHEN e.posted_count > 1 THEN 'multiple_posted_journals'
                     WHEN e.source = 'note' AND e.original_category IS NULL THEN 'original_review_required'
                     WHEN e.review_id IS NOT NULL THEN 'review_stale'
                     WHEN e.source = 'expense' THEN 'purchase_tax_eligibility_unverified'
                     ELSE 'tax_category_or_date_unverified' END AS review_reason
            FROM entries e
        ),
        gl AS MATERIALIZED (
            SELECT l.id, h.id AS header_id, h.entry_date AS date, h.v_type AS source,
                   h.reference_id AS source_id, h.description, l.credit - l.debit AS amount,
                   CASE WHEN h.v_type IN ('invoice', 'invoices', 'فاتورة مبيعات') THEN 'sale'
                        WHEN h.v_type IN ('expense', 'expenses') THEN 'purchase'
                        WHEN n.id IS NOT NULL THEN 'note'
                        WHEN h.v_type = 'manual_journals' OR h.v_type IS NULL THEN 'manual'
                        ELSE 'other' END AS kind
            FROM public.journal_lines l
            JOIN public.journal_headers h ON h.id = l.header_id AND h.company_id = l.company_id
            LEFT JOIN public.invoice_adjustment_notes n ON n.id = h.reference_id AND n.company_id = h.company_id
              AND n.journal_header_id = h.id
            WHERE l.company_id = v_company AND l.account_id = v_account
              AND h.entry_date BETWEEN p_from AND p_to AND h.status IN ('posted', 'مرحل', 'معتمد')
        ),
        gl_by_header AS (
            SELECT header_id, sum(amount) AS amount FROM gl GROUP BY header_id
        ),
        totals AS (
            SELECT coalesce(sum(CASE WHEN source = 'expense' THEN -recorded_tax ELSE recorded_tax END)
                       FILTER (WHERE in_document_period), 0) AS recorded_net,
                   sum(CASE WHEN source = 'expense' THEN -confirmed_tax ELSE confirmed_tax END)
                       FILTER (WHERE in_tax_period) AS confirmed_net,
                   count(*) FILTER (WHERE status = 'review' AND source <> 'expense') AS sales_review_count,
                   count(*) FILTER (WHERE status = 'review' AND source = 'expense') AS purchases_review_count,
                   (SELECT coalesce(sum(amount), 0) FROM gl) AS movement
            FROM transactions
        ),
        period_adj AS (
            SELECT pa.id, pa.prior_period_adjustment, pa.carried_forward_credit, pa.evidence, pa.reviewed_at
            FROM public.vat_period_adjustments pa
            WHERE pa.company_id = v_company AND pa.period_from = p_from AND pa.period_to = p_to
        ),
        box_definitions(number, label, categories, side) AS (
            VALUES
            (1, 'المبيعات الخاضعة للنسبة الأساسية', ARRAY['standard_sales'], 'sales'),
            (2, 'مبيعات للمواطنين تتحمل الدولة ضريبتها', NULL::text[], 'manual'),
            (3, 'المبيعات المحلية الخاضعة للنسبة الصفرية', ARRAY['zero_sales'], 'sales'),
            (4, 'الصادرات', ARRAY['export_sales'], 'sales'),
            (5, 'المبيعات المعفاة', ARRAY['exempt_sales'], 'sales'),
            (6, 'إجمالي المبيعات', ARRAY['standard_sales', 'zero_sales', 'export_sales', 'exempt_sales'], 'total_sales'),
            (7, 'المشتريات الخاضعة للنسبة الأساسية', ARRAY['standard_purchases'], 'purchases'),
            (8, 'الواردات المسددة ضريبتها عند الاستيراد', ARRAY['imports_paid'], 'purchases'),
            (9, 'الواردات الخاضعة للحساب العكسي', NULL::text[], 'manual'),
            (10, 'المشتريات الخاضعة للنسبة الصفرية', ARRAY['zero_purchases'], 'purchases'),
            (11, 'المشتريات المعفاة', ARRAY['exempt_purchases'], 'purchases'),
            (12, 'إجمالي المشتريات', ARRAY['standard_purchases', 'imports_paid', 'zero_purchases', 'exempt_purchases'], 'total_purchases'),
            (13, 'صافي الضريبة عن الفترة الحالية', NULL::text[], 'net'),
            (14, 'تصحيحات الفترات السابقة', NULL::text[], 'prior_adj'),
            (15, 'الضريبة المرحلة من الفترات السابقة', NULL::text[], 'credit_fwd'),
            (16, 'صافي الضريبة المستحقة', NULL::text[], 'final_net')
        ),
        boxes AS (
            SELECT b.number, b.label,
                CASE WHEN b.categories IS NOT NULL AND (a.cnt > 0 OR c.review_count = 0)
                    THEN coalesce(a.base, 0) END AS base,
                CASE WHEN b.categories IS NOT NULL AND (a.cnt > 0 OR c.review_count = 0)
                    THEN coalesce(a.adjustment, 0) END AS adjustment,
                CASE WHEN b.side = 'net' THEN
                         CASE WHEN totals.sales_review_count + totals.purchases_review_count = 0
                              THEN coalesce(totals.confirmed_net, 0)
                              ELSE totals.confirmed_net END
                     WHEN b.side = 'prior_adj' THEN pa.prior_period_adjustment
                     WHEN b.side = 'credit_fwd' THEN pa.carried_forward_credit
                     WHEN b.side = 'final_net' THEN
                         CASE WHEN pa.id IS NOT NULL AND totals.sales_review_count + totals.purchases_review_count = 0
                              THEN coalesce(totals.confirmed_net, 0) + pa.prior_period_adjustment - pa.carried_forward_credit END
                     WHEN b.categories IS NOT NULL AND (a.cnt > 0 OR c.review_count = 0)
                        THEN coalesce(a.tax, 0) END AS tax,
                CASE WHEN b.side = 'manual' THEN 'manual'
                     WHEN b.side IN ('prior_adj', 'credit_fwd') THEN
                         CASE WHEN pa.id IS NOT NULL THEN 'confirmed' ELSE 'manual' END
                     WHEN b.side = 'final_net' THEN
                         CASE WHEN pa.id IS NOT NULL AND totals.sales_review_count + totals.purchases_review_count = 0
                              THEN 'confirmed' ELSE 'pending' END
                     WHEN b.side IN ('total_sales', 'total_purchases', 'net') THEN 'partial'
                     WHEN c.review_count = 0 THEN 'confirmed'
                     WHEN a.cnt > 0 THEN 'partial'
                     ELSE 'pending' END AS status
            FROM box_definitions b CROSS JOIN totals
            LEFT JOIN period_adj pa ON true
            CROSS JOIN LATERAL (
                SELECT CASE WHEN b.side IN ('sales', 'total_sales') THEN totals.sales_review_count
                            ELSE totals.purchases_review_count END AS review_count
            ) c
            CROSS JOIN LATERAL (
                SELECT count(*) AS cnt, sum(t.base) FILTER (WHERE t.source <> 'note') AS base,
                       sum(t.base) FILTER (WHERE t.source = 'note') AS adjustment, sum(t.confirmed_tax) AS tax
                FROM transactions t WHERE t.in_tax_period AND t.category = ANY(b.categories)
            ) a
        )
        SELECT jsonb_build_object(
            'period', jsonb_build_object('from', p_from, 'to', p_to),
            'company', (SELECT jsonb_build_object('id', c.id, 'name', c.name, 'tax_number', c.tax_number)
                        FROM public.companies c WHERE c.id = v_company),
            'period_adjustments', (
                SELECT jsonb_build_object(
                    'prior_period_adjustment', pa.prior_period_adjustment,
                    'carried_forward_credit', pa.carried_forward_credit,
                    'evidence', pa.evidence,
                    'reviewed_at', pa.reviewed_at
                ) FROM period_adj pa
            ),
            'boxes', (SELECT jsonb_agg(to_jsonb(b) ORDER BY b.number) FROM boxes b),
            'transactions', coalesce((SELECT jsonb_agg(jsonb_build_object(
                'source', t.source, 'source_id', t.source_id, 'invoice_id', t.invoice_id,
                'reference', t.reference, 'document_date', t.document_date, 'tax_date', t.tax_date,
                'base', t.base, 'recorded_tax', t.recorded_tax, 'confirmed_tax', t.confirmed_tax,
                'recoverable_vat', t.recoverable_vat, 'category', t.category, 'original_category', t.original_category,
                'status', t.status, 'review_reason', t.review_reason, 'evidence', t.evidence,
                'in_document_period', t.in_document_period, 'in_tax_period', t.in_tax_period,
                'gl_215_amount', CASE WHEN v_account IS NOT NULL THEN coalesce(g.amount, 0) END
            ) ORDER BY t.document_date DESC, t.source, t.source_id)
            FROM transactions t LEFT JOIN gl_by_header g ON g.header_id = t.journal_id), '[]'::jsonb),
            'reconciliation', jsonb_build_object(
                'account_code', '215', 'posted_movement', CASE WHEN v_account IS NOT NULL THEN totals.movement END,
                'recorded_document_net', totals.recorded_net, 'confirmed_document_net', totals.confirmed_net,
                'variance_recorded', CASE WHEN v_account IS NOT NULL THEN totals.movement - totals.recorded_net END,
                'variance_confirmed', CASE WHEN v_account IS NOT NULL THEN totals.movement - totals.confirmed_net END,
                'lines', coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.date, g.id) FROM gl g), '[]'::jsonb)
            )
        ) FROM totals
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_vat_return(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vat_return(date, date) TO authenticated;

COMMIT;
