// Types for Phase 11 - Employee Attendance & Partner Salaries

export type AttendanceStatus =
  | 'حاضر'
  | 'غائب'
  | 'نص يوم'
  | 'إجازة مدفوعة'
  | 'إجازة غير مدفوعة'
  | 'مأمورية'
  | 'عطلة';

export interface AttendanceRecord {
  day: number;
  date: string;
  status: AttendanceStatus;
  check_in?: string | null;
  check_out?: string | null;
  late_minutes: number;
  early_leave_minutes: number;
  notes?: string | null;
}

export interface EmployeeAbsenceSummary {
  partner_id: string;
  month: string;
  cutoff_date: string;
  basic_salary: number;
  allowances: number;
  daily_rate: number;
  days_present: number;
  days_absent: number;
  days_half: number;
  days_paid_leave: number;
  days_unpaid_leave: number;
  days_mission: number;
  days_holiday: number;
  days_weekend: number;
  unrecorded_days: number;
  total_absence_days: number;
  absence_deduction: number;
  is_locked: boolean;
}

export interface EmployeeMonthlyAttendance {
  id: string;
  name: string;
  job_role?: string | null;
  identity_number?: string | null;
  phone?: string | null;
  summary: EmployeeAbsenceSummary;
  attendance: AttendanceRecord[];
}

export interface MonthlyAttendancePayload {
  month: string;
  cutoff_date: string;
  days_in_month: number;
  employees: EmployeeMonthlyAttendance[];
}
