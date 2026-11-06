"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase, getActiveCompanyId } from '@/lib/supabase';
import { useCompany } from '@/lib/CompanyContext';
import { notify } from '@/lib/notify';
import {
  AttendanceStatus,
  EmployeeMonthlyAttendance,
  MonthlyAttendancePayload,
} from '@/types/attendance';

export const ATTENDANCE_STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; short: string; color: string; bg: string; border: string; factor: number }
> = {
  'حاضر': {
    label: 'حاضر',
    short: '✓',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.3)',
    factor: 0,
  },
  'غائب': {
    label: 'غائب',
    short: '✕',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.14)',
    border: 'rgba(239, 68, 68, 0.35)',
    factor: 1.0,
  },
  'نص يوم': {
    label: 'نصف يوم',
    short: '½',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.14)',
    border: 'rgba(245, 158, 11, 0.35)',
    factor: 0.5,
  },
  'إجازة مدفوعة': {
    label: 'إجازة مدفوعة',
    short: 'مدفوعة',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.12)',
    border: 'rgba(56, 189, 248, 0.3)',
    factor: 0,
  },
  'إجازة غير مدفوعة': {
    label: 'إجازة بدون أجر',
    short: 'بدون أجر',
    color: '#a8a29e',
    bg: 'rgba(168, 162, 158, 0.12)',
    border: 'rgba(168, 162, 158, 0.3)',
    factor: 1.0,
  },
  'مأمورية': {
    label: 'مأمورية عمل',
    short: 'مأمورية',
    color: '#a855f7',
    bg: 'rgba(168, 85, 247, 0.12)',
    border: 'rgba(168, 85, 247, 0.3)',
    factor: 0,
  },
  'عطلة': {
    label: 'عطلة رسمية',
    short: 'عطلة',
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.1)',
    border: 'rgba(251, 191, 36, 0.25)',
    factor: 0,
  },
};

export function useAttendanceLogic() {
  const { activeCompanyId, activeCompany } = useCompany();
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [cutoffDate, setCutoffDate] = useState<string>(
    new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [data, setData] = useState<MonthlyAttendancePayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [editingModal, setEditingModal] = useState<{
    partnerId: string;
    employeeName: string;
    day: number;
    date: string;
    status: AttendanceStatus;
    checkIn?: string | null;
    checkOut?: string | null;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    notes?: string | null;
    isLocked: boolean;
  } | null>(null);

  const fetchVersionRef = useRef(0);

  // Update cutoff date when month changes
  const handleMonthChange = (monthStr: string) => {
    setSelectedMonth(monthStr);
    const [year, month] = monthStr.split('-').map(Number);
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    setCutoffDate(`${monthStr}-${String(lastDayOfMonth).padStart(2, '0')}`);
  };

  const fetchMonthlyAttendance = useCallback(async () => {
    const requestVersion = ++fetchVersionRef.current;
    setIsLoading(true);

    try {
      const { data: result, error } = await supabase.rpc('get_company_monthly_attendance', {
        p_month: selectedMonth,
        p_cutoff_date: cutoffDate,
      });

      if (error) throw error;
      if (requestVersion === fetchVersionRef.current) {
        setData(result as MonthlyAttendancePayload);
      }
    } catch (err: any) {
      if (requestVersion === fetchVersionRef.current) {
        console.error('Failed to fetch monthly attendance:', err);
        notify(err.message || 'تعذر تحميل كشف حضور وانصراف الموظفين');
      }
    } finally {
      if (requestVersion === fetchVersionRef.current) {
        setIsLoading(false);
      }
    }
  }, [selectedMonth, cutoffDate]);

  useEffect(() => {
    void fetchMonthlyAttendance();

    // Setup Supabase Realtime subscription
    const channel = supabase
      .channel(`attendance_live_${selectedMonth}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employee_attendance' },
        () => {
          void fetchMonthlyAttendance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMonthlyAttendance, selectedMonth]);

  // Fast inline status toggle or save
  const saveAttendanceRecord = async (params: {
    partnerId: string;
    workDate: string;
    status: AttendanceStatus;
    checkIn?: string | null;
    checkOut?: string | null;
    lateMinutes?: number;
    earlyLeaveMinutes?: number;
    notes?: string | null;
  }) => {
    setIsSaving(true);
    try {
      const cid = getActiveCompanyId();
      const payload: Record<string, any> = {
        company_id: cid,
        partner_id: params.partnerId,
        work_date: params.workDate,
        status: params.status,
        check_in: params.checkIn || null,
        check_out: params.checkOut || null,
        late_minutes: params.lateMinutes || 0,
        early_leave_minutes: params.earlyLeaveMinutes || 0,
        notes: params.notes || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('employee_attendance')
        .upsert(payload, { onConflict: 'company_id,partner_id,work_date' });

      if (error) throw error;

      notify('تم تحديث حالة الحضور بنجاح');
      setEditingModal(null);
      await fetchMonthlyAttendance();
    } catch (err: any) {
      console.error('Error saving attendance:', err);
      notify(err.message || 'تعذر حفظ حالة الحضور. تأكد من عدم ترحيل المسير.');
    } finally {
      setIsSaving(false);
    }
  };

  // Quick Action: Fill all unrecorded non-weekend days
  const handleMarkUnrecorded = async (targetStatus: AttendanceStatus = 'حاضر') => {
    setIsSaving(true);
    try {
      const { data: count, error } = await supabase.rpc('mark_unrecorded_days', {
        p_month: selectedMonth,
        p_cutoff_date: cutoffDate,
        p_target_status: targetStatus,
      });

      if (error) throw error;
      notify(`تم تسجيل ${count || 0} يوم شاغر كـ (${targetStatus}) بنجاح`);
      await fetchMonthlyAttendance();
    } catch (err: any) {
      console.error('Error marking unrecorded days:', err);
      notify(err.message || 'فشلت معالجة الأيام الشاغرة');
    } finally {
      setIsSaving(false);
    }
  };

  // Export to Excel CSV
  const exportToExcel = () => {
    if (!data || !data.employees.length) {
      notify('لا توجد بيانات حضور لتصديرها');
      return;
    }

    const daysCount = data.days_in_month;
    const daysHeaders = Array.from({ length: daysCount }, (_, i) => `يوم ${i + 1}`).join(',');

    const headers = `الموظف,المسمى الوظيفي,رقم الهوية,الراتب الأساسي,أجر اليوم (÷30),أيام الحضور,أيام الغياب,نصف يوم,إجازات,أيام الخصم,خصم الغياب,الأيام غير المسجلة,${daysHeaders}`;

    const rows = data.employees.map((emp) => {
      const s = emp.summary;
      const daysMap: Record<number, string> = {};
      emp.attendance.forEach((r) => {
        daysMap[r.day] = r.status;
      });

      const dayCells = Array.from({ length: daysCount }, (_, i) => {
        const d = i + 1;
        return `"${daysMap[d] || '-'}"`;
      }).join(',');

      return [
        `"${emp.name}"`,
        `"${emp.job_role || 'بدون'}"`,
        `"${emp.identity_number || ''}"`,
        s.basic_salary,
        s.daily_rate,
        s.days_present,
        s.days_absent,
        s.days_half,
        s.days_paid_leave,
        s.total_absence_days,
        s.absence_deduction,
        s.unrecorded_days,
        dayCells,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `كشف_حضور_الموظفين_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify('تم تصدير كشف الحضور بنجاح');
  };

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    if (!data?.employees) return [];
    if (!searchQuery.trim()) return data.employees;
    const q = searchQuery.trim().toLowerCase();
    return data.employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.job_role && e.job_role.toLowerCase().includes(q)) ||
        (e.identity_number && e.identity_number.includes(q))
    );
  }, [data, searchQuery]);

  // Overall KPIs
  const kpis = useMemo(() => {
    if (!data?.employees) {
      return { totalEmployees: 0, totalAbsenceDays: 0, totalDeduction: 0, unrecordedEmployees: 0 };
    }
    let totalAbsenceDays = 0;
    let totalDeduction = 0;
    let unrecordedEmployees = 0;

    data.employees.forEach((e) => {
      totalAbsenceDays += Number(e.summary.total_absence_days || 0);
      totalDeduction += Number(e.summary.absence_deduction || 0);
      if (Number(e.summary.unrecorded_days || 0) > 0) {
        unrecordedEmployees++;
      }
    });

    return {
      totalEmployees: data.employees.length,
      totalAbsenceDays: Math.round(totalAbsenceDays * 10) / 10,
      totalDeduction: Math.round(totalDeduction * 100) / 100,
      unrecordedEmployees,
    };
  }, [data]);

  return {
    selectedMonth,
    cutoffDate,
    searchQuery,
    setSearchQuery,
    data,
    filteredEmployees,
    isLoading,
    isSaving,
    editingModal,
    setEditingModal,
    kpis,
    handleMonthChange,
    setCutoffDate,
    fetchMonthlyAttendance,
    saveAttendanceRecord,
    handleMarkUnrecorded,
    exportToExcel,
  };
}
