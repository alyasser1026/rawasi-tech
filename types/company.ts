/** Role of a user inside one company (user_companies.role).
 *  admin  = edits the company's details and manages its members.
 *  member = can open and switch to the company.
 *  Screen permissions (view / create / edit / delete) still come from profiles.permissions. */
export type CompanyRole = 'admin' | 'member';

export interface Company {
  id: string;
  code: string;
  name: string;
  legal_name?: string | null;
  tax_number?: string | null;
  cr_number?: string | null;
  currency: string;
  country: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  logo_url?: string | null;
  brand_color?: string | null;
  fiscal_year_start?: string | null;
  is_active: boolean;
  /** The system-wide default company (the one that owned the data before multi-company). */
  is_default: boolean;
  /** The signed-in user's role in this company; absent when the user manages it without being a member. */
  role?: CompanyRole;
  /** The company the signed-in user opens by default. */
  is_user_default?: boolean;
  settings?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface UserCompanyMembership {
  id: string;
  user_id: string;
  company_id: string;
  role: CompanyRole;
  is_active: boolean;
  is_default: boolean;
}

/** Editable fields sent to the create_company / update_company functions. */
export interface CompanyInput {
  code: string;
  name: string;
  legal_name: string;
  tax_number: string;
  cr_number: string;
  currency: string;
  country: string;
  email: string;
  phone: string;
  address: string;
  brand_color: string;
  fiscal_year_start: string;
}
