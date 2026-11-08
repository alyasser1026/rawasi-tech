-- Migration: Create project_payment_milestones table for client payment schedule and receipt vouchers
CREATE TABLE IF NOT EXISTS public.project_payment_milestones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid DEFAULT rawasi_private.current_company_id(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    milestone_number integer NOT NULL DEFAULT 1,
    title text NOT NULL,
    due_date date,
    expected_amount numeric NOT NULL DEFAULT 0,
    received_amount numeric NOT NULL DEFAULT 0,
    receipt_voucher_id uuid REFERENCES public.receipt_vouchers(id) ON DELETE SET NULL,
    receipt_number text,
    receipt_date date,
    status text NOT NULL DEFAULT 'معلقة',
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid()
);

ALTER TABLE public.project_payment_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users access to project_payment_milestones"
  ON public.project_payment_milestones FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
