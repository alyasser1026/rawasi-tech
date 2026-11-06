"use client";

import React from 'react';
import MasterPage from '@/components/MasterPage';
import LoadingScreen from '@/components/LoadingScreen';
import {
  useAttendanceLogic,
  ATTENDANCE_STATUS_CONFIG,
} from './attendance_logic';
import { AttendanceStatus } from '@/types/attendance';
import {
  CalendarDays,
  Users,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  Search,
  Lock,
  Clock,
  Info,
  X,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

export default function AttendancePage() {
  const {
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
  } = useAttendanceLogic();

  const daysCount = data?.days_in_month || 30;
  const daysArray = Array.from({ length: daysCount }, (_, i) => i + 1);

  // Helper to determine day of week and if it's Friday
  const getDayInfo = (day: number) => {
    if (!selectedMonth) return { name: '', isFriday: false, dateStr: '' };
    const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
    const d = new Date(dateStr);
    const dayOfWeek = d.getDay(); // 5 = Friday
    const dayNames = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
    return {
      name: dayNames[dayOfWeek] || '',
      isFriday: dayOfWeek === 5,
      dateStr,
    };
  };

  return (
    <MasterPage
      enterprise
      icon={<CalendarDays size={20} />}
      title="حضور وانصراف الموظفين"
      subtitle="سجل الحضور والغياب الشهري مع خصم الغياب الآلي المباشر في مسيرات الرواتب"
      headerContent={
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="ent-button"
            onClick={exportToExcel}
            title="تصدير كشف الحضور بصيغة Excel"
          >
            <FileSpreadsheet size={16} />
            تصدير كشف
          </button>
          <button
            type="button"
            className="ent-button"
            onClick={() => void fetchMonthlyAttendance()}
            disabled={isLoading || isSaving}
            title="تحديث البيانات"
          >
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
            تحديث
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* 1. لوحة المؤشرات السريعة (KPI Strip) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* كارت 1: الموظفون */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '16px',
              background: 'linear-gradient(145deg, #16120e 0%, #0d0b09 100%)',
              border: '1px solid rgba(249, 115, 22, 0.18)',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '12px',
                background: 'rgba(249, 115, 22, 0.12)',
                color: '#f97316',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Users size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#a8a29e', fontWeight: 600 }}>
                الموظفون المسجلون
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fefcf9' }}>
                {kpis.totalEmployees}
              </div>
            </div>
          </div>

          {/* كارت 2: أيام الغياب الإجمالية */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '16px',
              background: 'linear-gradient(145deg, #16120e 0%, #0d0b09 100%)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <CalendarDays size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#a8a29e', fontWeight: 600 }}>
                أيام الغياب المحتسبة
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ef4444' }}>
                {kpis.totalAbsenceDays}{' '}
                <span style={{ fontSize: '0.85rem', color: '#a8a29e', fontWeight: 500 }}>يوم</span>
              </div>
            </div>
          </div>

          {/* كارت 3: إجمالي خصم الغياب */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '16px',
              background: 'linear-gradient(145deg, #16120e 0%, #0d0b09 100%)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '12px',
                background: 'rgba(245, 158, 11, 0.12)',
                color: '#f59e0b',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <AlertCircle size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#a8a29e', fontWeight: 600 }}>
                إجمالي خصومات المسير
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f59e0b' }}>
                {kpis.totalDeduction.toLocaleString('ar-EG', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                <span style={{ fontSize: '0.85rem', color: '#a8a29e', fontWeight: 500 }}>ر.س</span>
              </div>
            </div>
          </div>

          {/* كارت 4: التنبيه للأيام غير المسجلة */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '16px',
              background:
                kpis.unrecordedEmployees > 0
                  ? 'linear-gradient(145deg, #241412 0%, #160c0b 100%)'
                  : 'linear-gradient(145deg, #16120e 0%, #0d0b09 100%)',
              border:
                kpis.unrecordedEmployees > 0
                  ? '1px solid rgba(239, 68, 68, 0.35)'
                  : '1px solid rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.85rem', color: '#a8a29e', fontWeight: 600 }}>
                أيام شاغرة (غير مسجلة)
              </div>
              <div
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 900,
                  color: kpis.unrecordedEmployees > 0 ? '#ef4444' : '#10b981',
                }}
              >
                {kpis.unrecordedEmployees > 0
                  ? `${kpis.unrecordedEmployees} موظف لديه شاغر`
                  : 'مكتمل بالكامل ✓'}
              </div>
            </div>
            {kpis.unrecordedEmployees > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkUnrecorded('حاضر')}
                disabled={isSaving}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#10b981',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                title="تسجيل جميع الأيام الشاغرة حتى تاريخ الإقفال كـ (حاضر)"
              >
                اعتماد الشاغر حضوراً
              </button>
            )}
          </div>
        </div>

        {/* 2. شريط الأدوات والفلاتر */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '16px',
            background: '#0d0f14',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          {/* اختيار الشهر وتاريخ الإقفال */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#a8a29e', fontWeight: 600 }}>
                شهر المسير:
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: '10px',
                  background: '#161922',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  color: '#fefcf9',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#a8a29e', fontWeight: 600 }}>
                تاريخ الإقفال:
              </label>
              <input
                type="date"
                value={cutoffDate}
                onChange={(e) => setCutoffDate(e.target.value)}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: '10px',
                  background: '#161922',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  color: '#fefcf9',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                }}
              />
            </div>
          </div>

          {/* محرك البحث السريع ودليل الحالات */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ position: 'relative', minWidth: '14rem' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: '0.75rem',
                  transform: 'translateY(-50%)',
                  color: '#78716c',
                }}
              />
              <input
                type="search"
                placeholder="بحث باسم الموظف أو المسمى..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 2.2rem 0.45rem 0.75rem',
                  borderRadius: '10px',
                  background: '#161922',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  color: '#fefcf9',
                  fontFamily: 'inherit',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          </div>
        </div>

        {/* 3. دليل الحالات اللوني السريع */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'center',
            fontSize: '0.8rem',
            color: '#a8a29e',
          }}
        >
          <span style={{ fontWeight: 700, marginInlineEnd: '0.25rem' }}>الحالات:</span>
          {Object.entries(ATTENDANCE_STATUS_CONFIG).map(([key, cfg]) => (
            <span
              key={key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.2rem 0.55rem',
                borderRadius: '8px',
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                color: cfg.color,
                fontWeight: 600,
              }}
            >
              <strong style={{ fontSize: '0.9rem' }}>{cfg.short}</strong>
              {cfg.label}
              {cfg.factor > 0 && (
                <small style={{ opacity: 0.85 }}>({cfg.factor} يوم خصم)</small>
              )}
            </span>
          ))}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.2rem 0.55rem',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px dashed rgba(255, 255, 255, 0.2)',
              color: '#d6d3d1',
            }}
          >
            <strong>-</strong> شاغر (يمنع ترحيل المسير)
          </span>
        </div>

        {/* 4. جدول الحضور الشهري الكبير */}
        {isLoading ? (
          <LoadingScreen message="جاري تجهيز كشف الحضور الشهري..." fullScreen={false} />
        ) : !filteredEmployees.length ? (
          <div
            style={{
              padding: '4rem 1.5rem',
              textAlign: 'center',
              borderRadius: '16px',
              background: '#0d0f14',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <Users size={48} style={{ color: '#78716c', marginBottom: '1rem' }} />
            <h3 style={{ margin: 0, color: '#fefcf9', fontSize: '1.2rem', fontWeight: 800 }}>
              لا يوجد موظفون برواتب شهرية
            </h3>
            <p style={{ color: '#a8a29e', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              تأكد من تسجيل موظفين بنوع «موظف» في شاشة دليل الشركاء وتحديد رواتبهم السارية.
            </p>
          </div>
        ) : (
          <div
            style={{
              borderRadius: '16px',
              background: '#0b0c10',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ overflowX: 'auto', maxHeight: '72vh' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'separate',
                  borderSpacing: 0,
                  direction: 'rtl',
                  fontSize: '0.85rem',
                  textAlign: 'center',
                }}
              >
                <thead>
                  <tr style={{ background: '#12141c', color: '#a8a29e', position: 'sticky', top: 0, zIndex: 20 }}>
                    {/* عمود الموظف الثابت */}
                    <th
                      style={{
                        position: 'sticky',
                        right: 0,
                        zIndex: 25,
                        background: '#12141c',
                        padding: '0.75rem 1rem',
                        textAlign: 'right',
                        minWidth: '200px',
                        fontWeight: 800,
                        borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      الموظف
                    </th>

                    {/* الراتب واليومية */}
                    <th
                      style={{
                        padding: '0.75rem 0.6rem',
                        fontWeight: 800,
                        minWidth: '105px',
                        borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      الراتب (÷30)
                    </th>

                    {/* أيام الشهر */}
                    {daysArray.map((day) => {
                      const info = getDayInfo(day);
                      return (
                        <th
                          key={day}
                          style={{
                            padding: '0.4rem 0.25rem',
                            minWidth: '40px',
                            fontWeight: 700,
                            borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
                            background: info.isFriday ? 'rgba(249, 115, 22, 0.08)' : undefined,
                            color: info.isFriday ? '#f97316' : '#a8a29e',
                          }}
                        >
                          <div style={{ fontSize: '0.9rem', fontWeight: 900 }}>{day}</div>
                          <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{info.name}</div>
                        </th>
                      );
                    })}

                    {/* ملخص الخصومات */}
                    <th
                      style={{
                        padding: '0.75rem 0.6rem',
                        fontWeight: 800,
                        minWidth: '85px',
                        color: '#ef4444',
                        borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      الغياب
                    </th>
                    <th
                      style={{
                        padding: '0.75rem 0.6rem',
                        fontWeight: 800,
                        minWidth: '100px',
                        color: '#f59e0b',
                        borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      خصم الغياب
                    </th>
                    <th
                      style={{
                        padding: '0.75rem 0.6rem',
                        fontWeight: 800,
                        minWidth: '75px',
                        borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      شاغر
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp, empIdx) => {
                    const s = emp.summary;
                    const daysMap: Record<number, any> = {};
                    emp.attendance.forEach((r) => {
                      daysMap[r.day] = r;
                    });

                    const isEven = empIdx % 2 === 0;
                    const rowBg = isEven ? '#0b0c10' : '#0e1017';

                    return (
                      <tr
                        key={emp.id}
                        style={{
                          background: rowBg,
                          transition: 'background 0.15s ease',
                        }}
                      >
                        {/* عمود الموظف الثابت */}
                        <td
                          style={{
                            position: 'sticky',
                            right: 0,
                            zIndex: 10,
                            background: rowBg,
                            padding: '0.75rem 1rem',
                            textAlign: 'right',
                            fontWeight: 700,
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          }}
                        >
                          <div style={{ color: '#fefcf9', fontSize: '0.9rem' }}>{emp.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#78716c' }}>
                            {emp.job_role || 'موظف'}
                          </div>
                        </td>

                        {/* الراتب الأساسي وأجر اليوم */}
                        <td
                          style={{
                            padding: '0.5rem',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          }}
                        >
                          <div style={{ fontWeight: 800, color: '#fefcf9' }}>
                            {Number(s.basic_salary).toLocaleString('ar-EG')}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#a8a29e' }}>
                            {Number(s.daily_rate).toFixed(1)} /يوم
                          </div>
                        </td>

                        {/* خلايا أيام الشهر */}
                        {daysArray.map((day) => {
                          const info = getDayInfo(day);
                          const record = daysMap[day];
                          const status: AttendanceStatus | undefined = record?.status;
                          const cfg = status ? ATTENDANCE_STATUS_CONFIG[status] : null;

                          return (
                            <td
                              key={day}
                              onClick={() => {
                                setEditingModal({
                                  partnerId: emp.id,
                                  employeeName: emp.name,
                                  day,
                                  date: info.dateStr,
                                  status: status || (info.isFriday ? 'عطلة' : 'حاضر'),
                                  checkIn: record?.check_in,
                                  checkOut: record?.check_out,
                                  lateMinutes: record?.late_minutes || 0,
                                  earlyLeaveMinutes: record?.early_leave_minutes || 0,
                                  notes: record?.notes,
                                  isLocked: false,
                                });
                              }}
                              style={{
                                padding: '0.25rem',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                background: info.isFriday ? 'rgba(249, 115, 22, 0.04)' : undefined,
                                cursor: 'pointer',
                              }}
                              title={`يوم ${day} (${info.name}): اضغط لتعديل الحالة`}
                            >
                              {cfg ? (
                                <div
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    background: cfg.bg,
                                    border: `1px solid ${cfg.border}`,
                                    color: cfg.color,
                                    fontWeight: 900,
                                    fontSize: '0.85rem',
                                    transition: 'transform 0.1s ease',
                                  }}
                                >
                                  {cfg.short}
                                </div>
                              ) : (
                                <div
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px dashed rgba(255, 255, 255, 0.15)',
                                    color: '#57534e',
                                    fontSize: '0.8rem',
                                  }}
                                >
                                  -
                                </div>
                              )}
                            </td>
                          );
                        })}

                        {/* أعمدة الملخص */}
                        <td
                          style={{
                            padding: '0.5rem',
                            fontWeight: 800,
                            color: Number(s.total_absence_days) > 0 ? '#ef4444' : '#a8a29e',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          }}
                        >
                          {s.total_absence_days}
                        </td>
                        <td
                          style={{
                            padding: '0.5rem',
                            fontWeight: 900,
                            color: Number(s.absence_deduction) > 0 ? '#f59e0b' : '#a8a29e',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          }}
                        >
                          {Number(s.absence_deduction).toLocaleString('ar-EG', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td
                          style={{
                            padding: '0.5rem',
                            fontWeight: 800,
                            color: Number(s.unrecorded_days) > 0 ? '#ef4444' : '#10b981',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          }}
                        >
                          {Number(s.unrecorded_days) > 0 ? (
                            <span
                              style={{
                                padding: '0.15rem 0.4rem',
                                borderRadius: '6px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                              }}
                            >
                              {s.unrecorded_days}
                            </span>
                          ) : (
                            '✓'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. نافذة تعديل حضور اليوم (Modal) */}
        {editingModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(7, 8, 11, 0.85)',
              backdropFilter: 'blur(12px)',
              padding: '1rem',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '440px',
                borderRadius: '20px',
                background: '#10121a',
                border: '1px solid rgba(249, 115, 22, 0.25)',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
                padding: '1.5rem',
                direction: 'rtl',
              }}
            >
              {/* رأس النافذة */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1.25rem',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingBottom: '0.75rem',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, color: '#fefcf9', fontSize: '1.15rem', fontWeight: 800 }}>
                    تسجيل حضور: {editingModal.employeeName}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: '#f97316', fontWeight: 600 }}>
                    تاريخ {editingModal.date} (يوم {editingModal.day})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingModal(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#a8a29e',
                    cursor: 'pointer',
                    padding: '0.25rem',
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* اختيار الحالة السريع */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    color: '#a8a29e',
                    fontWeight: 700,
                    marginBottom: '0.5rem',
                  }}
                >
                  حالة اليوم:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  {(Object.keys(ATTENDANCE_STATUS_CONFIG) as AttendanceStatus[]).map((st) => {
                    const cfg = ATTENDANCE_STATUS_CONFIG[st];
                    const isSelected = editingModal.status === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() =>
                          setEditingModal({ ...editingModal, status: st })
                        }
                        style={{
                          padding: '0.6rem 0.5rem',
                          borderRadius: '10px',
                          border: isSelected
                            ? `2px solid ${cfg.color}`
                            : '1px solid rgba(255, 255, 255, 0.1)',
                          background: isSelected ? cfg.bg : 'rgba(255, 255, 255, 0.03)',
                          color: isSelected ? cfg.color : '#d6d3d1',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>{cfg.label}</span>
                        <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                          {cfg.factor > 0 ? `-${cfg.factor}` : '0'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* أوقات الحضور والانصراف (اختياري) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.75rem',
                  marginBottom: '1rem',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      color: '#a8a29e',
                      marginBottom: '0.3rem',
                    }}
                  >
                    وقت الحضور:
                  </label>
                  <input
                    type="time"
                    value={editingModal.checkIn || ''}
                    onChange={(e) =>
                      setEditingModal({ ...editingModal, checkIn: e.target.value })
                    }
                    style={{
                      width: '100%',
                      padding: '0.45rem',
                      borderRadius: '8px',
                      background: '#161922',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#fefcf9',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      color: '#a8a29e',
                      marginBottom: '0.3rem',
                    }}
                  >
                    وقت الانصراف:
                  </label>
                  <input
                    type="time"
                    value={editingModal.checkOut || ''}
                    onChange={(e) =>
                      setEditingModal({ ...editingModal, checkOut: e.target.value })
                    }
                    style={{
                      width: '100%',
                      padding: '0.45rem',
                      borderRadius: '8px',
                      background: '#161922',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#fefcf9',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
              </div>

              {/* ملاحظات اليوم */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    color: '#a8a29e',
                    marginBottom: '0.3rem',
                  }}
                >
                  ملاحظات أو سبب الغياب:
                </label>
                <input
                  type="text"
                  placeholder="ملاحظات توثيقية إضافية..."
                  value={editingModal.notes || ''}
                  onChange={(e) =>
                    setEditingModal({ ...editingModal, notes: e.target.value })
                  }
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    background: '#161922',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fefcf9',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              {/* أزرار الحفظ والإلغاء */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setEditingModal(null)}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#a8a29e',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void saveAttendanceRecord({
                      partnerId: editingModal.partnerId,
                      workDate: editingModal.date,
                      status: editingModal.status,
                      checkIn: editingModal.checkIn,
                      checkOut: editingModal.checkOut,
                      lateMinutes: editingModal.lateMinutes,
                      earlyLeaveMinutes: editingModal.earlyLeaveMinutes,
                      notes: editingModal.notes,
                    });
                  }}
                  disabled={isSaving}
                  style={{
                    padding: '0.6rem 1.5rem',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #f97316, #ea580c)',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(249, 115, 22, 0.35)',
                  }}
                >
                  {isSaving ? 'جاري الحفظ...' : 'حفظ الحالة'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MasterPage>
  );
}
