"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { formatCurrency } from '@/lib/helpers';
import { buildDocumentFileName } from '@/lib/documentFileName';
import { printWithDocumentTitle } from '@/lib/printWithTitle';
import {
  computeDailyWorkerExpenseAllocations,
  getExpenseDisplayDescription,
  getExpenseNetAmount,
} from '@/lib/dailyWorkerExpenseAllocation';
import ReportOfficialHeader from '@/components/ReportOfficialHeader';
import ReportContactFooter from '@/components/ReportContactFooter';
import { DocNote, DocSection, DocSignatures, DocStats, PHI_DOC_CSS } from '@/components/PrintDocument';
import {
  DailyCategorySlice,
  DailyExecutiveCharts,
  DailyReportModel,
  DailyTrendPoint,
  DailyVillaSummary,
} from './DailyExecutiveCharts';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  HardHat,
  Layers,
  Package,
  Printer,
  Receipt,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';

interface DailyExecutiveReportProps {
  rawData: any;
  selectedProjectId: string;
  activeCompanyId: string;
}

const round2 = (n: number) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

function getLocalTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return isoDate;
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  dt.setDate(dt.getDate() + deltaDays);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function extractDateOnly(val?: string | null): string {
  if (!val) return '';
  return String(val).trim().split('T')[0];
}

function formatArabicWeekdayDate(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return isoDate;
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(dt);
  } catch {
    return isoDate;
  }
}

function formatShortWeekday(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return isoDate;
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  try {
    return new Intl.DateTimeFormat('ar-EG', { weekday: 'short' }).format(dt);
  } catch {
    return isoDate.slice(5);
  }
}

const SLICE_PALETTE = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#f43f5e', '#06b6d4', '#ec4899'];

export default function DailyExecutiveReport({
  rawData,
  selectedProjectId,
  activeCompanyId,
}: DailyExecutiveReportProps) {
  const todayIso = useMemo(() => getLocalTodayIso(), []);
  const yesterdayIso = useMemo(() => shiftIsoDate(todayIso, -1), [todayIso]);

  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalTodayIso());
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  // خرائط المرجع السريعة
  const maps = useMemo(() => {
    const projectMap = new Map<string, any>();
    const projectNameToId = new Map<string, string>();
    (rawData?.projects || []).forEach((p: any) => {
      const pid = String(p.id);
      projectMap.set(pid, p);
      if (p.Property) projectNameToId.set(String(p.Property).trim().toLowerCase(), pid);
      if (p.project_name) projectNameToId.set(String(p.project_name).trim().toLowerCase(), pid);
    });

    const partnerMap = new Map<string, { name: string; type: string }>();
    (rawData?.partners || []).forEach((p: any) => {
      partnerMap.set(String(p.id), { name: p.name || 'غير محدد', type: p.partner_type || '' });
    });

    const jobOrderMap = new Map<string, any>();
    (rawData?.job_orders || []).forEach((j: any) => {
      jobOrderMap.set(String(j.id), j);
    });

    const boqMap = new Map<string, any>();
    (rawData?.boq_budget || []).forEach((b: any) => {
      boqMap.set(String(b.id), b);
    });

    const receiptLinesByReceiptId = new Map<string, any[]>();
    (rawData?.material_receipt_lines || []).forEach((line: any) => {
      const rid = String(line.receipt_id || '');
      if (!rid) return;
      const bucket = receiptLinesByReceiptId.get(rid);
      if (bucket) bucket.push(line);
      else receiptLinesByReceiptId.set(rid, [line]);
    });

    const issueLinesByIssueId = new Map<string, any[]>();
    (rawData?.material_issue_lines || []).forEach((line: any) => {
      const iid = String(line.issue_id || '');
      if (!iid) return;
      const bucket = issueLinesByIssueId.get(iid);
      if (bucket) bucket.push(line);
      else issueLinesByIssueId.set(iid, [line]);
    });

    const resolveProjectIds = (rec: any): string[] => {
      const ids = new Set<string>();
      if (rec?.project_id) ids.add(String(rec.project_id));
      if (Array.isArray(rec?.project_ids)) {
        rec.project_ids.forEach((id: any) => {
          if (id) ids.add(String(id));
        });
      }
      if (rec?.job_order_id) {
        const jo = jobOrderMap.get(String(rec.job_order_id));
        if (jo?.project_id) ids.add(String(jo.project_id));
      }
      if (ids.size === 0 && rec?.site_ref) {
        const matched = projectNameToId.get(String(rec.site_ref).trim().toLowerCase());
        if (matched) ids.add(matched);
      }
      return Array.from(ids);
    };

    const matchesSelectedProject = (rec: any) => {
      if (selectedProjectId === 'all') return true;
      return resolveProjectIds(rec).includes(String(selectedProjectId));
    };

    return {
      projectMap,
      partnerMap,
      jobOrderMap,
      boqMap,
      receiptLinesByReceiptId,
      issueLinesByIssueId,
      resolveProjectIds,
      matchesSelectedProject,
    };
  }, [rawData, selectedProjectId]);

  // استخراج أحدث الأيام النشطة التي تحتوي على حركات (للانتقال السريع)
  const activeDays = useMemo(() => {
    const counts = new Map<string, number>();
    const bump = (dStr?: string | null, rec?: any) => {
      if (rec && !maps.matchesSelectedProject(rec)) return;
      const d = extractDateOnly(dStr);
      if (!d) return;
      counts.set(d, (counts.get(d) || 0) + 1);
    };

    (rawData?.receipt_vouchers || []).forEach((r: any) => bump(r.date, r));
    (rawData?.payment_vouchers || []).forEach((v: any) => bump(v.date, v));
    (rawData?.labor_daily_logs || []).forEach((l: any) => bump(l.work_date, l));
    (rawData?.expenses || []).forEach((e: any) => bump(e.exp_date, e));
    (rawData?.material_issues || []).forEach((m: any) => bump(m.issue_date, m));
    (rawData?.material_receipts || []).forEach((m: any) => bump(m.receipt_date, m));
    (rawData?.sub_claims || []).forEach((c: any) => bump(c.date, c));

    return Array.from(counts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [rawData, maps]);

  const latestActiveDate = activeDays[0]?.date || todayIso;

  // دالة مساعدة لتجميع بيانات أي يوم معين (تُستخدم لليوم المختار وللمسار الأسبوعي)
  const buildSnapshotForDate = (targetDate: string) => {
    const dayReceipts = (rawData?.receipt_vouchers || []).filter(
      (r: any) => extractDateOnly(r.date) === targetDate && maps.matchesSelectedProject(r)
    );
    const dayPayments = (rawData?.payment_vouchers || []).filter(
      (v: any) => extractDateOnly(v.date) === targetDate && maps.matchesSelectedProject(v)
    );
    const dayLabor = (rawData?.labor_daily_logs || []).filter(
      (l: any) => extractDateOnly(l.work_date) === targetDate && maps.matchesSelectedProject(l)
    );
    const dayExpensesRaw = (rawData?.expenses || []).filter(
      (e: any) => extractDateOnly(e.exp_date) === targetDate
    );

    const cashIn = round2(dayReceipts.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0));
    const cashOut = round2(dayPayments.reduce((s: number, v: any) => s + (Number(v.amount) || 0), 0));
    const laborCost = round2(dayLabor.reduce((s: number, l: any) => s + (Number(l.daily_wage) || 0), 0));

    const workerSet = new Set<string>();
    dayLabor.forEach((l: any) => {
      const nm = String(
        l.worker_name || maps.partnerMap.get(String(l.worker_partner_id))?.name || l.id
      )
        .trim()
        .toLowerCase();
      if (nm) workerSet.add(nm);
    });

    const filteredExpenses =
      selectedProjectId === 'all'
        ? dayExpensesRaw
        : dayExpensesRaw.filter((e: any) => maps.matchesSelectedProject(e));
    const expensesTotal = round2(
      filteredExpenses.reduce((s: number, e: any) => s + getExpenseNetAmount(e), 0)
    );

    return {
      cashIn,
      cashOut,
      laborCost,
      expensesTotal,
      workersCount: workerSet.size,
    };
  };

  // بناء النموذج التحليلي الكامل لليوم المختار
  const dailyModel: DailyReportModel = useMemo(() => {
    const selectedProj =
      selectedProjectId !== 'all' ? maps.projectMap.get(String(selectedProjectId)) : null;
    const selectedProjectLabel = selectedProj
      ? selectedProj.Property || selectedProj.project_name || 'مشروع محدد'
      : `جميع المشاريع (${rawData?.projects?.length || 0} فلل)`;

    // 1. سندات القبض (الفلوس اللي دخلت)
    const receipts = (rawData?.receipt_vouchers || [])
      .filter((r: any) => extractDateOnly(r.date) === selectedDate && maps.matchesSelectedProject(r))
      .map((r: any) => {
        const pids = maps.resolveProjectIds(r);
        const projLabels =
          pids.length > 0
            ? pids.map((pid) => maps.projectMap.get(pid)?.Property || maps.projectMap.get(pid)?.project_name || pid).join(' ، ')
            : 'خزينة عامة / تمويل عهدة';
        return {
          ...r,
          amount_num: round2(Number(r.amount) || 0),
          partner_name: maps.partnerMap.get(String(r.partner_id))?.name || 'غير محدد',
          projects_label: projLabels,
          resolved_project_ids: pids,
        };
      });

    // 2. سندات الصرف (الفلوس اللي اتصرفت)
    const linkedExpenseVoucherIds = new Set<string>();
    const payments = (rawData?.payment_vouchers || [])
      .filter((v: any) => extractDateOnly(v.date) === selectedDate && maps.matchesSelectedProject(v))
      .map((v: any) => {
        if (v.related_expense_id) linkedExpenseVoucherIds.add(String(v.related_expense_id));
        let category = 'صرف عام';
        if (v.sub_claim_id) category = 'سداد مستخلص مقاول';
        else if (v.related_expense_id) category = 'سداد مصروف تشغيلي';
        else if (v.partner_id) category = 'دفعة / يوميات عمالة';

        const pids = maps.resolveProjectIds(v);
        const projectsLabel =
          pids.length > 0
            ? pids.map((pid) => maps.projectMap.get(pid)?.Property || maps.projectMap.get(pid)?.project_name || pid).join(' ، ')
            : v.site_ref || (v.related_expense_id ? 'موزع تلقائياً (ABC)' : 'عام');

        return {
          ...v,
          amount_num: round2(Number(v.amount) || 0),
          partner_name:
            maps.partnerMap.get(String(v.partner_id))?.name ||
            maps.partnerMap.get(String(v.custody_partner_id))?.name ||
            '---',
          category,
          projects_label: projectsLabel,
          resolved_project_ids: pids,
        };
      });

    // 3. العمال اللي نزلت اشتغلت اليوم
    const laborLogs = (rawData?.labor_daily_logs || [])
      .filter((l: any) => extractDateOnly(l.work_date) === selectedDate && maps.matchesSelectedProject(l))
      .map((l: any) => {
        const pids = maps.resolveProjectIds(l);
        const primaryPid = pids[0] || '';
        const proj = primaryPid ? maps.projectMap.get(primaryPid) : null;
        const projName = proj?.Property || proj?.project_name || l.site_ref || 'غير محدد';
        const workerName =
          l.worker_name || maps.partnerMap.get(String(l.worker_partner_id))?.name || 'عامل';
        const jo = l.job_order_id ? maps.jobOrderMap.get(String(l.job_order_id)) : null;
        const boq = l.work_item_id ? maps.boqMap.get(String(l.work_item_id)) : null;
        const attendance = Number(l.attendance_value) || 1;
        const wage = round2(Number(l.daily_wage) || 0);

        return {
          ...l,
          worker_display_name: workerName,
          project_display_name: projName,
          primary_project_id: primaryPid,
          job_order_number: jo?.order_number || '',
          work_item_label: l.work_item || boq?.work_item || 'أعمال عامة',
          attendance_num: attendance,
          wage_num: wage,
        };
      });

    // 4. المصروفات اليومية + توزيع الـ ABC على الفلل
    const allTodayExpenses = (rawData?.expenses || []).filter(
      (e: any) => extractDateOnly(e.exp_date) === selectedDate
    );

    const todayAbcAllocations = computeDailyWorkerExpenseAllocations({
      expenses: allTodayExpenses,
      laborLogs: rawData?.labor_daily_logs || [],
      jobOrders: rawData?.job_orders || [],
      projects: rawData?.projects || [],
      boqItems: rawData?.boq_budget || [],
      activeCompanyId,
    });

    const abcByExpenseId = new Map<string, typeof todayAbcAllocations>();
    todayAbcAllocations.forEach((alloc) => {
      const eid = String(alloc.expense_id);
      const list = abcByExpenseId.get(eid);
      if (list) list.push(alloc);
      else abcByExpenseId.set(eid, [alloc]);
    });

    const enrichedExpenses = allTodayExpenses
      .filter((e: any) => {
        if (selectedProjectId === 'all') return true;
        if (maps.matchesSelectedProject(e)) return true;
        const allocs = abcByExpenseId.get(String(e.id)) || [];
        return allocs.some((a) => String(a.project_id) === String(selectedProjectId));
      })
      .map((e: any) => {
        const netAmount = round2(getExpenseNetAmount(e));
        const desc = getExpenseDisplayDescription(e);
        const allocs = abcByExpenseId.get(String(e.id)) || [];
        const pids = maps.resolveProjectIds(e);

        let effectiveAmount = netAmount;
        if (selectedProjectId !== 'all' && !maps.matchesSelectedProject(e)) {
          effectiveAmount = round2(
            allocs
              .filter((a) => String(a.project_id) === String(selectedProjectId))
              .reduce((s, a) => s + Number(a.allocated_amount || 0), 0)
          );
        }

        const distributionText =
          allocs.length > 0
            ? allocs.map((a) => `${a['اسم الفيلا المحمل عليها']}: ${formatCurrency(a.allocated_amount)}`).join(' | ')
            : pids.length > 0
            ? pids.map((pid) => maps.projectMap.get(pid)?.Property || maps.projectMap.get(pid)?.project_name || pid).join(' ، ')
            : e.site_ref || 'مصروف عام';

        return {
          ...e,
          net_amount: effectiveAmount,
          full_net_amount: netAmount,
          display_description: desc,
          distribution_text: distributionText,
          allocations: allocs,
          resolved_project_ids: pids,
          payee_display:
            e.payee_name ||
            maps.partnerMap.get(String(e.payee_id))?.name ||
            e.sub_contractor ||
            '---',
        };
      });

    // 5. الخامات المنصرفة والمستلمة ومستخلصات اليوم
    const materialIssues = (rawData?.material_issues || [])
      .filter((m: any) => extractDateOnly(m.issue_date) === selectedDate && maps.matchesSelectedProject(m))
      .map((m: any) => {
        const lines = maps.issueLinesByIssueId.get(String(m.id)) || [];
        const total =
          round2(Number(m.total_amount) || 0) ||
          round2(lines.reduce((s: number, l: any) => s + (Number(l.total_price) || 0), 0));
        const pids = maps.resolveProjectIds(m);
        const proj = pids[0] ? maps.projectMap.get(pids[0]) : null;
        return {
          ...m,
          lines,
          total_num: total,
          project_display_name: proj?.Property || proj?.project_name || 'عام',
          contractor_display:
            maps.partnerMap.get(String(m.subcontractor_id))?.name || m.contractor_text_name || '---',
        };
      });

    const materialReceipts = (rawData?.material_receipts || [])
      .filter((m: any) => extractDateOnly(m.receipt_date) === selectedDate && maps.matchesSelectedProject(m))
      .map((m: any) => {
        const lines = maps.receiptLinesByReceiptId.get(String(m.id)) || [];
        const total =
          round2(Number(m.total_amount) || 0) ||
          round2(lines.reduce((s: number, l: any) => s + (Number(l.total_price) || 0), 0));
        const pids = maps.resolveProjectIds(m);
        const proj = pids[0] ? maps.projectMap.get(pids[0]) : null;
        return {
          ...m,
          lines,
          total_num: total,
          project_display_name: proj?.Property || proj?.project_name || 'مخزن عام',
          supplier_display: maps.partnerMap.get(String(m.supplier_id))?.name || '---',
        };
      });

    const subClaims = (rawData?.sub_claims || [])
      .filter((c: any) => extractDateOnly(c.date) === selectedDate && maps.matchesSelectedProject(c))
      .map((c: any) => {
        const pids = maps.resolveProjectIds(c);
        const projLabels =
          pids.length > 0
            ? pids.map((pid) => maps.projectMap.get(pid)?.Property || pid).join(' ، ')
            : c.project_names_text || '---';
        return {
          ...c,
          net_num: round2(Number(c.net_amount) || 0),
          paid_num: round2(Number(c.paid_amount) || 0),
          contractor_display: maps.partnerMap.get(String(c.contractor_id))?.name || 'مقاول باطن',
          project_display_name: projLabels,
        };
      });

    // 6. تجميع الفلل النشطة اليوم
    const villaBucketMap = new Map<
      string,
      DailyVillaSummary & { workerSet: Set<string> }
    >();

    const ensureVilla = (pid: string, fallbackName?: string) => {
      const key = pid || `site:${fallbackName || 'عام'}`;
      let entry = villaBucketMap.get(key);
      if (!entry) {
        const p = pid ? maps.projectMap.get(pid) : null;
        entry = {
          projectId: key,
          projectName: p?.Property || p?.project_name || fallbackName || 'غير محدد / عام',
          unitType: p?.unit_type || '---',
          workersCount: 0,
          workerNames: [],
          workerSet: new Set<string>(),
          laborDays: 0,
          laborCost: 0,
          directExpensesCost: 0,
          abcExpensesCost: 0,
          materialsCost: 0,
          claimsCost: 0,
          cashIn: 0,
          cashOut: 0,
          totalOperationalCost: 0,
        };
        villaBucketMap.set(key, entry);
      }
      return entry;
    };

    laborLogs.forEach((l: any) => {
      const v = ensureVilla(l.primary_project_id, l.project_display_name);
      v.laborDays = round2(v.laborDays + l.attendance_num);
      v.laborCost = round2(v.laborCost + l.wage_num);
      const wn = String(l.worker_display_name || '').trim();
      if (wn && !v.workerSet.has(wn.toLowerCase())) {
        v.workerSet.add(wn.toLowerCase());
        v.workerNames.push(wn);
      }
    });

    enrichedExpenses.forEach((e: any) => {
      if (e.allocations && e.allocations.length > 0) {
        e.allocations.forEach((a: any) => {
          const apid = String(a.project_id || '');
          if (selectedProjectId !== 'all' && apid !== String(selectedProjectId)) return;
          const v = ensureVilla(apid, a['اسم الفيلا المحمل عليها']);
          const amt = Number(a.allocated_amount || 0);
          if (a.source_has_project) {
            v.directExpensesCost = round2(v.directExpensesCost + amt);
          } else {
            v.abcExpensesCost = round2(v.abcExpensesCost + amt);
          }
        });
      } else {
        const pid = e.resolved_project_ids[0] || '';
        const v = ensureVilla(pid, e.site_ref || 'مصاريف عامة');
        v.directExpensesCost = round2(v.directExpensesCost + e.net_amount);
      }
    });

    materialIssues.forEach((m: any) => {
      const pid = maps.resolveProjectIds(m)[0] || '';
      const v = ensureVilla(pid, m.project_display_name);
      v.materialsCost = round2(v.materialsCost + m.total_num);
    });

    materialReceipts
      .filter((m: any) => m.receipt_type !== 'توريد عميل')
      .forEach((m: any) => {
        const pid = maps.resolveProjectIds(m)[0] || '';
        const v = ensureVilla(pid, m.project_display_name);
        v.materialsCost = round2(v.materialsCost + m.total_num);
      });

    subClaims.forEach((c: any) => {
      const pids = maps.resolveProjectIds(c);
      const targetPids =
        selectedProjectId !== 'all'
          ? pids.filter((id) => id === String(selectedProjectId))
          : pids;
      const share = targetPids.length > 0 ? c.net_num / targetPids.length : c.net_num;
      if (targetPids.length > 0) {
        targetPids.forEach((pid) => {
          const v = ensureVilla(pid);
          v.claimsCost = round2(v.claimsCost + share);
        });
      } else {
        const v = ensureVilla('', c.project_display_name);
        v.claimsCost = round2(v.claimsCost + share);
      }
    });

    receipts.forEach((r: any) => {
      const pids: string[] = r.resolved_project_ids || [];
      if (pids.length > 0) {
        const target =
          selectedProjectId !== 'all' ? pids.filter((id) => id === String(selectedProjectId)) : pids;
        const share = target.length > 0 ? r.amount_num / target.length : 0;
        target.forEach((pid) => {
          const v = ensureVilla(pid);
          v.cashIn = round2(v.cashIn + share);
        });
      }
    });

    payments.forEach((vRow: any) => {
      const pids: string[] = vRow.resolved_project_ids || [];
      if (pids.length > 0) {
        const target =
          selectedProjectId !== 'all' ? pids.filter((id) => id === String(selectedProjectId)) : pids;
        const share = target.length > 0 ? vRow.amount_num / target.length : 0;
        target.forEach((pid) => {
          const v = ensureVilla(pid);
          v.cashOut = round2(v.cashOut + share);
        });
      }
    });

    const activeVillas: DailyVillaSummary[] = Array.from(villaBucketMap.values())
      .map((v) => {
        const totalOp = round2(
          v.laborCost + v.directExpensesCost + v.abcExpensesCost + v.materialsCost + v.claimsCost
        );
        return {
          projectId: v.projectId,
          projectName: v.projectName,
          unitType: v.unitType,
          workersCount: v.workerSet.size,
          workerNames: v.workerNames,
          laborDays: v.laborDays,
          laborCost: v.laborCost,
          directExpensesCost: v.directExpensesCost,
          abcExpensesCost: v.abcExpensesCost,
          materialsCost: v.materialsCost,
          claimsCost: v.claimsCost,
          cashIn: v.cashIn,
          cashOut: v.cashOut,
          totalOperationalCost: totalOp,
        };
      })
      .sort((a, b) => b.totalOperationalCost - a.totalOperationalCost || b.workersCount - a.workersCount);

    // 7. الإجماليات والمؤشرات
    const cashIn = round2(receipts.reduce((s: number, r: any) => s + r.amount_num, 0));
    const cashOut = round2(payments.reduce((s: number, v: any) => s + v.amount_num, 0));
    const netCash = round2(cashIn - cashOut);
    const expensesTotal = round2(enrichedExpenses.reduce((s: number, e: any) => s + e.net_amount, 0));
    const directCashExpensesUnlinked = round2(
      enrichedExpenses
        .filter((e: any) => e.payment_method === 'نقدي' && !linkedExpenseVoucherIds.has(String(e.id)))
        .reduce((s: number, e: any) => s + e.net_amount, 0)
    );

    const laborTotal = round2(laborLogs.reduce((s: number, l: any) => s + l.wage_num, 0));
    const laborDays = round2(laborLogs.reduce((s: number, l: any) => s + l.attendance_num, 0));
    const distinctWorkersSet = new Set<string>();
    laborLogs.forEach((l: any) => {
      distinctWorkersSet.add(String(l.worker_display_name || l.id).trim().toLowerCase());
    });

    const materialIssuesTotal = round2(
      materialIssues.reduce((s: number, m: any) => s + m.total_num, 0)
    );
    const materialReceiptsTotal = round2(
      materialReceipts.reduce((s: number, m: any) => s + m.total_num, 0)
    );
    const subClaimsTotal = round2(subClaims.reduce((s: number, c: any) => s + c.net_num, 0));
    const materialsAndClaimsTotal = round2(materialIssuesTotal + subClaimsTotal);
    const totalDailyOperationsCost = round2(
      laborTotal + expensesTotal + materialIssuesTotal + subClaimsTotal
    );

    // 8. شرائح الرسم الدائري لتصنيف مصروفات اليوم
    const catTotals = new Map<string, number>();
    enrichedExpenses.forEach((e: any) => {
      const cat = String(e.main_category || 'مصروفات تشغيلية متنوعة').trim();
      catTotals.set(cat, round2((catTotals.get(cat) || 0) + e.net_amount));
    });
    const expenseCategories: DailyCategorySlice[] = Array.from(catTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], idx) => ({
        label,
        value,
        color: SLICE_PALETTE[idx % SLICE_PALETTE.length],
      }));

    const costComposition: DailyCategorySlice[] = [
      { label: 'يوميات العمالة', value: laborTotal, color: '#3b82f6' },
      { label: 'المصروفات التشغيلية', value: expensesTotal, color: '#f59e0b' },
      { label: 'خامات منصرفة', value: materialIssuesTotal, color: '#8b5cf6' },
      { label: 'مستخلصات مقاولين', value: subClaimsTotal, color: '#10b981' },
      { label: 'سندات صرف عامة', value: cashOut, color: '#f43f5e' },
    ];

    // 9. مسار آخر 7 أيام
    const trend7Days: DailyTrendPoint[] = [];
    for (let offset = -6; offset <= 0; offset++) {
      const dt = shiftIsoDate(selectedDate, offset);
      const snap = buildSnapshotForDate(dt);
      trend7Days.push({
        date: dt,
        shortLabel: formatShortWeekday(dt),
        cashIn: snap.cashIn,
        cashOut: snap.cashOut,
        expensesTotal: snap.expensesTotal,
        laborCost: snap.laborCost,
        workersCount: snap.workersCount,
        isSelected: dt === selectedDate,
      });
    }

    return {
      selectedDate,
      weekdayLabel: formatArabicWeekdayDate(selectedDate),
      selectedProjectLabel,
      cashIn,
      cashOut,
      netCash,
      expensesTotal,
      directCashExpensesUnlinked,
      laborTotal,
      laborDays,
      distinctWorkersCount: distinctWorkersSet.size,
      materialIssuesTotal,
      materialReceiptsTotal,
      subClaimsTotal,
      materialsAndClaimsTotal,
      totalDailyOperationsCost,
      activeVillasCount: activeVillas.length,
      receipts,
      payments,
      laborLogs,
      expenses: enrichedExpenses,
      materialIssues,
      materialReceipts,
      subClaims,
      activeVillas,
      expenseCategories,
      costComposition,
      trend7Days,
    };
  }, [rawData, selectedDate, selectedProjectId, activeCompanyId, maps]);

  // تصدير التقرير اليومي إلى Excel
  const exportDailyExcel = () => {
    const wb = XLSX.utils.book_new();
    const m = dailyModel;

    const summaryRows = [
      { 'البند': 'التاريخ', 'القيمة': `${m.weekdayLabel} (${m.selectedDate})` },
      { 'البند': 'نطاق التقرير', 'القيمة': m.selectedProjectLabel },
      { 'البند': 'الفلوس الداخلة اليوم (سندات قبض)', 'القيمة': m.cashIn },
      { 'البند': 'الفلوس المصروفة اليوم (سندات صرف)', 'القيمة': m.cashOut },
      { 'البند': 'صافي حركة الخزينة اليوم', 'القيمة': m.netCash },
      { 'البند': 'إجمالي مصروفات اليوم المسجلة', 'القيمة': m.expensesTotal },
      { 'البند': 'عدد العمال الذين نزلوا اليوم', 'القيمة': m.distinctWorkersCount },
      { 'البند': 'إجمالي اليوميات', 'القيمة': m.laborDays },
      { 'البند': 'إجمالي أجور العمال اليوم', 'القيمة': m.laborTotal },
      { 'البند': 'الخامات المنصرفة للمواقع اليوم', 'القيمة': m.materialIssuesTotal },
      { 'البند': 'مستخلصات المقاولين المعتمدة اليوم', 'القيمة': m.subClaimsTotal },
      { 'البند': 'عدد الفلل التي تم العمل بها اليوم', 'القيمة': m.activeVillasCount },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    wsSummary['!dir'] = 'rtl';
    XLSX.utils.book_append_sheet(wb, wsSummary, 'ملخص_اليوم');

    const villasRows = m.activeVillas.map((v) => ({
      'الفيلا / المشروع': v.projectName,
      'النموذج': v.unitType,
      'عدد العمال': v.workersCount,
      'أسماء العمال': v.workerNames.join(' ، ') || '---',
      'أيام العمل': v.laborDays,
      'تكلفة العمالة': v.laborCost,
      'مصروفات مباشرة': v.directExpensesCost,
      'مصروفات موزعة (ABC)': v.abcExpensesCost,
      'خامات منصرفة': v.materialsCost,
      'مستخلصات مقاولين': v.claimsCost,
      'إجمالي التشغيل اليومي': v.totalOperationalCost,
      'الداخل للفيلا (قبض)': v.cashIn,
      'المنصرف للفيلا (صرف)': v.cashOut,
    }));
    const wsVillas = XLSX.utils.json_to_sheet(villasRows);
    wsVillas['!dir'] = 'rtl';
    XLSX.utils.book_append_sheet(wb, wsVillas, 'الفلل_النشطة');

    const workersRows = m.laborLogs.map((l: any) => ({
      'العامل / الفني': l.worker_display_name,
      'التخصص / المهارة': l.skill_level || '---',
      'الفيلا / المشروع': l.project_display_name,
      'أمر الشغل': l.job_order_number || '---',
      'البند': l.work_item_label,
      'قيمة الحضور': l.attendance_num,
      'اليومية': l.wage_num,
      'الإنجاز / الملاحظات': l.production_desc || l.notes || '---',
      'الحالة': l.is_posted ? 'مرحل' : 'مسودة',
    }));
    const wsWorkers = XLSX.utils.json_to_sheet(workersRows);
    wsWorkers['!dir'] = 'rtl';
    XLSX.utils.book_append_sheet(wb, wsWorkers, 'العمال_اليوم');

    const expensesRows = m.expenses.map((e: any) => ({
      'التصنيف': e.main_category || '---',
      'البيان': e.display_description,
      'المستفيد': e.payee_display,
      'الفيلا / التوزيع': e.distribution_text,
      'طريقة الدفع': e.payment_method || '---',
      'الضريبة': Number(e.vat_amount) || 0,
      'الصافي': e.net_amount,
      'الحالة': e.is_posted ? 'مرحل' : 'قيد المراجعة',
    }));
    const wsExp = XLSX.utils.json_to_sheet(expensesRows);
    wsExp['!dir'] = 'rtl';
    XLSX.utils.book_append_sheet(wb, wsExp, 'المصروفات_اليوم');

    const receiptsRows = m.receipts.map((r: any) => ({
      'رقم السند': r.receipt_number || '---',
      'الجهة / الشريك': r.partner_name,
      'المشروع': r.projects_label,
      'طريقة الدفع': r.payment_method || '---',
      'المبلغ': r.amount_num,
      'البيان': r.notes || '---',
    }));
    const wsRv = XLSX.utils.json_to_sheet(receiptsRows);
    wsRv['!dir'] = 'rtl';
    XLSX.utils.book_append_sheet(wb, wsRv, 'سندات_القبض_اليوم');

    const paymentsRows = m.payments.map((v: any) => ({
      'رقم السند': v.voucher_number || '---',
      'التصنيف': v.category,
      'المستفيد': v.partner_name,
      'المشروع / التوجيه': v.projects_label,
      'طريقة الدفع': v.payment_method || '---',
      'المبلغ': v.amount_num,
      'البيان': v.description || v.notes || '---',
    }));
    const wsPv = XLSX.utils.json_to_sheet(paymentsRows);
    wsPv['!dir'] = 'rtl';
    XLSX.utils.book_append_sheet(wb, wsPv, 'سندات_الصرف_اليوم');

    const matAndClaimsRows = [
      ...m.materialIssues.map((mi: any) => ({
        'النوع': 'إذن صرف خامات',
        'الرقم المرجعي': mi.issue_number || '---',
        'المشروع / الفيلا': mi.project_display_name,
        'المقاول / المورد': mi.contractor_display,
        'القيمة': mi.total_num,
        'ملاحظات': mi.notes || '---',
      })),
      ...m.materialReceipts.map((mr: any) => ({
        'النوع': `توريد خامات (${mr.receipt_type || 'شركة'})`,
        'الرقم المرجعي': mr.receipt_number || '---',
        'المشروع / الفيلا': mr.project_display_name,
        'المقاول / المورد': mr.supplier_display,
        'القيمة': mr.total_num,
        'ملاحظات': mr.notes || '---',
      })),
      ...m.subClaims.map((sc: any) => ({
        'النوع': 'مستخلص مقاول',
        'الرقم المرجعي': sc.claim_number || '---',
        'المشروع / الفيلا': sc.project_display_name,
        'المقاول / المورد': sc.contractor_display,
        'القيمة': sc.net_num,
        'ملاحظات': sc.status || '---',
      })),
    ];
    const wsMatClaims = XLSX.utils.json_to_sheet(matAndClaimsRows);
    wsMatClaims['!dir'] = 'rtl';
    XLSX.utils.book_append_sheet(wb, wsMatClaims, 'الخامات_والمستخلصات');

    const { fileName } = buildDocumentFileName({
      docType: 'التقرير_اليومي_التنفيذي',
      prefix: 'DAILY-RPT',
      seedParts: [m.selectedDate, m.cashIn, m.cashOut],
      ext: 'xlsx',
    });
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
      {/* شريط التحكم في تاريخ التقرير اليومي + آخر الأيام النشطة */}
      <div className="rpt-section-card" style={{ marginBottom: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.9rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '2.2rem',
                  height: '2.2rem',
                  borderRadius: '10px',
                  background: 'var(--accent-soft-bg)',
                  color: 'var(--accent-ink)',
                }}
              >
                <CalendarDays size={18} />
              </span>
              <div>
                <h2 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 900 }}>
                  التقرير اليومي التنفيذي والمالي الشامل
                </h2>
                <p style={{ margin: 0, fontSize: 'var(--fs-xs)', fontWeight: 800, color: 'var(--text-secondary)' }}>
                  {dailyModel.weekdayLabel} ({selectedDate}) • {dailyModel.selectedProjectLabel}
                </p>
              </div>
            </div>
          </div>

          {/* أدوات اختيار التاريخ والتصدير والطباعة */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSelectedDate(shiftIsoDate(selectedDate, -1))}
              className="rpt-tab-btn"
              title="اليوم السابق"
              style={{ background: 'var(--surface-sunken)', padding: '0.5rem 0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <ChevronRight size={15} />
              <span>السابق</span>
            </button>

            <input
              type="date"
              className="rpt-input"
              style={{ width: 'auto', minWidth: '10rem' }}
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            />

            <button
              type="button"
              onClick={() => setSelectedDate(shiftIsoDate(selectedDate, 1))}
              className="rpt-tab-btn"
              title="اليوم التالي"
              style={{ background: 'var(--surface-sunken)', padding: '0.5rem 0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <span>التالي</span>
              <ChevronLeft size={15} />
            </button>

            <button
              type="button"
              onClick={() => setSelectedDate(todayIso)}
              className={`rpt-tab-btn ${selectedDate === todayIso ? 'is-active' : ''}`}
              style={{ padding: '0.5rem 0.85rem' }}
            >
              اليوم
            </button>

            <button
              type="button"
              onClick={() => setSelectedDate(yesterdayIso)}
              className={`rpt-tab-btn ${selectedDate === yesterdayIso ? 'is-active' : ''}`}
              style={{ padding: '0.5rem 0.85rem' }}
            >
              أمس
            </button>

            {latestActiveDate && latestActiveDate !== selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate(latestActiveDate)}
                className="rpt-tab-btn"
                style={{
                  padding: '0.5rem 0.85rem',
                  background: 'rgba(16, 185, 129, 0.14)',
                  color: '#059669',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Sparkles size={14} />
                <span>آخر يوم به حركة ({latestActiveDate})</span>
              </button>
            )}

            <button
              type="button"
              onClick={exportDailyExcel}
              className="rpt-tab-btn"
              style={{
                padding: '0.5rem 0.9rem',
                background: 'rgba(16, 185, 129, 0.14)',
                color: '#059669',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <FileSpreadsheet size={15} />
              <span>Excel اليوم</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPrintOpen(true)}
              className="rpt-tab-btn"
              style={{
                padding: '0.5rem 0.95rem',
                background: 'var(--action-fill)',
                color: 'var(--action-ink)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Printer size={15} />
              <span>طباعة تقرير اليوم (PDF)</span>
            </button>
          </div>
        </div>

        {/* شريط سريع لآخر 5 أيام مسجل بها حركات */}
        {activeDays.length > 0 && (
          <div
            style={{
              marginTop: '0.85rem',
              paddingTop: '0.7rem',
              borderTop: '1px solid var(--table-zebra-bg)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, color: 'var(--text-secondary)' }}>
              أحدث الأيام النشطة:
            </span>
            {activeDays.slice(0, 6).map((item) => {
              const isCurr = item.date === selectedDate;
              return (
                <button
                  key={item.date}
                  type="button"
                  onClick={() => setSelectedDate(item.date)}
                  className={`rpt-tab-btn ${isCurr ? 'is-active' : ''}`}
                  style={{
                    padding: '0.32rem 0.7rem',
                    fontSize: 'var(--fs-xs)',
                    background: isCurr ? undefined : 'var(--surface-sunken)',
                  }}
                >
                  {item.date} ({item.count} حركة)
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 6 كروت KPIs رئيسية لليوم */}
      <div className="rpt-kpi-grid" style={{ marginBottom: 0 }}>
        <div className="rpt-kpi-card">
          <small style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <ArrowDownLeft size={14} color="#10b981" />
            <span>الفلوس اللي دخلت اليوم (قبض)</span>
          </small>
          <strong style={{ color: 'var(--status-positive, #10b981)' }}>
            {formatCurrency(dailyModel.cashIn)}
          </strong>
          <span>عدد سندات القبض: {dailyModel.receipts.length} سند</span>
        </div>

        <div className="rpt-kpi-card">
          <small style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <ArrowUpRight size={14} color="#f43f5e" />
            <span>الفلوس اللي اتصرفت اليوم (صرف)</span>
          </small>
          <strong style={{ color: 'var(--status-negative, #f43f5e)' }}>
            {formatCurrency(dailyModel.cashOut)}
          </strong>
          <span>عدد سندات الصرف: {dailyModel.payments.length} سند</span>
        </div>

        <div className="rpt-kpi-card">
          <small style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Wallet size={14} color="#0ea5e9" />
            <span>صافي حركة الخزينة اليوم</span>
          </small>
          <strong
            style={{
              color:
                dailyModel.netCash >= 0
                  ? 'var(--status-positive, #10b981)'
                  : 'var(--status-negative, #f43f5e)',
            }}
          >
            {dailyModel.netCash > 0 ? '+' : ''}
            {formatCurrency(dailyModel.netCash)}
          </strong>
          <span>الداخل ناقص سندات الصرف اليوم</span>
        </div>

        <div className="rpt-kpi-card">
          <small style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Receipt size={14} color="#f59e0b" />
            <span>مصروفات اليوم المسجلة</span>
          </small>
          <strong style={{ color: '#d97706' }}>{formatCurrency(dailyModel.expensesTotal)}</strong>
          <span>
            {dailyModel.expenses.length} مصروف • نقدي مباشر بدون سند: {formatCurrency(dailyModel.directCashExpensesUnlinked)}
          </span>
        </div>

        <div className="rpt-kpi-card">
          <small style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <HardHat size={14} color="#3b82f6" />
            <span>العمال اللي نزلت اشتغلت اليوم</span>
          </small>
          <strong style={{ color: '#2563eb' }}>
            {dailyModel.distinctWorkersCount} عامل ({formatCurrency(dailyModel.laborTotal)})
          </strong>
          <span>
            إجمالي اليوميات المسجلة: {dailyModel.laborDays} يومية • {dailyModel.laborLogs.length} قيد ميداني
          </span>
        </div>

        <div className="rpt-kpi-card">
          <small style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Building2 size={14} color="#8b5cf6" />
            <span>الفلل التي تم العمل بها اليوم</span>
          </small>
          <strong style={{ color: '#7c3aed' }}>{dailyModel.activeVillasCount} فلل / مشاريع</strong>
          <span>إجمالي تكلفة تشغيل اليوم: {formatCurrency(dailyModel.totalDailyOperationsCost)}</span>
        </div>
      </div>

      {/* الرسوم البيانية التفاعلية الأربعة للتقرير اليومي */}
      <DailyExecutiveCharts data={dailyModel} variant="web" />

      {/* 1. جدول الفلل والمشاريع اللي اشتغلنا فيها اليوم */}
      <div className="rpt-section-card" style={{ marginBottom: 0 }}>
        <div className="rpt-section-title">
          <h3>
            <Building2 size={18} style={{ display: 'inline', marginLeft: '6px', verticalAlign: 'middle' }} />
            1. الفلل والمشاريع التي تم العمل بها اليوم ({dailyModel.activeVillas.length})
          </h3>
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>
            تفصيل العمال واليوميات والمصروفات والخامات والمستخلصات وحركة الفلوس لكل فيلا
          </span>
        </div>

        {dailyModel.activeVillas.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 800 }}>
            لا توجد فلل مسجل عليها عمل أو حركات مالية بتاريخ {selectedDate}. جرّب اختيار يوم من «أحدث الأيام النشطة» بالأعلى.
          </div>
        ) : (
          <table className="rpt-table">
            <thead>
              <tr>
                <th>الفيلا / المشروع</th>
                <th>النموذج</th>
                <th>عدد العمال وأسماؤهم</th>
                <th>اليوميات</th>
                <th>أجور العمالة</th>
                <th>مصروفات مباشرة</th>
                <th>مصروفات موزعة (ABC)</th>
                <th>خامات منصرفة / موردة</th>
                <th>مستخلصات مقاولين</th>
                <th>إجمالي تشغيل اليوم</th>
                <th>قبض اليوم</th>
                <th>صرف اليوم</th>
              </tr>
            </thead>
            <tbody>
              {dailyModel.activeVillas.map((v) => (
                <tr key={v.projectId}>
                  <td style={{ textAlign: 'right', fontWeight: 900 }}>{v.projectName}</td>
                  <td>{v.unitType}</td>
                  <td style={{ textAlign: 'right', maxWidth: '15rem' }}>
                    {v.workersCount > 0 ? (
                      <div>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: 'rgba(59, 130, 246, 0.14)',
                            color: '#2563eb',
                            fontSize: 'var(--fs-xs)',
                            fontWeight: 900,
                            marginLeft: '6px',
                          }}
                        >
                          {v.workersCount} عامل
                        </span>
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
                          {v.workerNames.slice(0, 4).join('، ')}
                          {v.workerNames.length > 4 ? ` +${v.workerNames.length - 4}` : ''}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>---</span>
                    )}
                  </td>
                  <td>{v.laborDays}</td>
                  <td style={{ color: '#2563eb' }}>{formatCurrency(v.laborCost)}</td>
                  <td>{formatCurrency(v.directExpensesCost)}</td>
                  <td>{formatCurrency(v.abcExpensesCost)}</td>
                  <td>{formatCurrency(v.materialsCost)}</td>
                  <td>{formatCurrency(v.claimsCost)}</td>
                  <td style={{ fontWeight: 900, color: 'var(--accent-ink)' }}>
                    {formatCurrency(v.totalOperationalCost)}
                  </td>
                  <td style={{ color: '#10b981' }}>{formatCurrency(v.cashIn)}</td>
                  <td style={{ color: '#f43f5e' }}>{formatCurrency(v.cashOut)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ textAlign: 'right' }}>
                  إجمالي الفلل النشطة ({dailyModel.activeVillas.length})
                </td>
                <td>{dailyModel.laborDays}</td>
                <td>{formatCurrency(dailyModel.activeVillas.reduce((s, v) => s + v.laborCost, 0))}</td>
                <td>{formatCurrency(dailyModel.activeVillas.reduce((s, v) => s + v.directExpensesCost, 0))}</td>
                <td>{formatCurrency(dailyModel.activeVillas.reduce((s, v) => s + v.abcExpensesCost, 0))}</td>
                <td>{formatCurrency(dailyModel.activeVillas.reduce((s, v) => s + v.materialsCost, 0))}</td>
                <td>{formatCurrency(dailyModel.activeVillas.reduce((s, v) => s + v.claimsCost, 0))}</td>
                <td>{formatCurrency(dailyModel.activeVillas.reduce((s, v) => s + v.totalOperationalCost, 0))}</td>
                <td>{formatCurrency(dailyModel.activeVillas.reduce((s, v) => s + v.cashIn, 0))}</td>
                <td>{formatCurrency(dailyModel.activeVillas.reduce((s, v) => s + v.cashOut, 0))}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* 2. كشف العمال الذين نزلوا للشغل اليوم */}
      <div className="rpt-section-card" style={{ marginBottom: 0 }}>
        <div className="rpt-section-title">
          <h3>
            <HardHat size={18} style={{ display: 'inline', marginLeft: '6px', verticalAlign: 'middle' }} />
            2. كشف العمال الذين نزلوا للعمل اليوم ({dailyModel.distinctWorkersCount} عامل • {dailyModel.laborLogs.length} يومية)
          </h3>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#2563eb' }}>
            إجمالي أجور اليوم: {formatCurrency(dailyModel.laborTotal)}
          </span>
        </div>

        {dailyModel.laborLogs.length === 0 ? (
          <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 800 }}>
            لم يتم تسجيل يوميات عمالة بتاريخ {selectedDate}.
          </div>
        ) : (
          <table className="rpt-table">
            <thead>
              <tr>
                <th>#</th>
                <th>اسم العامل / الفني</th>
                <th>المهنة / التخصص</th>
                <th>الفيلا / الموقع</th>
                <th>أمر الشغل</th>
                <th>البند المنفذ</th>
                <th>قيمة الحضور</th>
                <th>أجر اليومية</th>
                <th>الإنجاز والملاحظات</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {dailyModel.laborLogs.map((l: any, idx: number) => (
                <tr key={l.id || idx}>
                  <td>{idx + 1}</td>
                  <td style={{ textAlign: 'right', fontWeight: 900 }}>{l.worker_display_name}</td>
                  <td>{l.skill_level || 'فني / عامل'}</td>
                  <td style={{ fontWeight: 800 }}>{l.project_display_name}</td>
                  <td>{l.job_order_number || '---'}</td>
                  <td style={{ textAlign: 'right' }}>{l.work_item_label}</td>
                  <td>{l.attendance_num}</td>
                  <td style={{ fontWeight: 900, color: '#2563eb' }}>{formatCurrency(l.wage_num)}</td>
                  <td style={{ textAlign: 'right', fontSize: 'var(--fs-xs)' }}>
                    {l.production_desc || l.notes || '---'}
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 800,
                        background: l.is_posted ? 'rgba(16, 185, 129, 0.14)' : 'rgba(245, 158, 11, 0.14)',
                        color: l.is_posted ? '#059669' : '#d97706',
                      }}
                    >
                      {l.is_posted ? 'مرحل' : 'مسودة'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} style={{ textAlign: 'right' }}>
                  الإجمالي ({dailyModel.distinctWorkersCount} عامل)
                </td>
                <td>{dailyModel.laborDays}</td>
                <td>{formatCurrency(dailyModel.laborTotal)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* 3. الفلوس اللي دخلت واللي اتصرفت اليوم (سندات القبض والصرف) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(26rem, 1fr))',
          gap: '1.15rem',
        }}
      >
        {/* سندات القبض (الداخل) */}
        <div className="rpt-section-card" style={{ marginBottom: 0 }}>
          <div className="rpt-section-title">
            <h3>
              <ArrowDownLeft size={18} color="#10b981" style={{ display: 'inline', marginLeft: '6px', verticalAlign: 'middle' }} />
              3أ. الفلوس اللي دخلت اليوم ({dailyModel.receipts.length} سند)
            </h3>
            <strong style={{ color: '#10b981', fontSize: 'var(--fs-md)' }}>
              {formatCurrency(dailyModel.cashIn)}
            </strong>
          </div>
          {dailyModel.receipts.length === 0 ? (
            <div style={{ padding: '1.15rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 800 }}>
              لا توجد سندات قبض مسجلة بتاريخ {selectedDate}.
            </div>
          ) : (
            <table className="rpt-table" style={{ minWidth: '30rem' }}>
              <thead>
                <tr>
                  <th>رقم السند</th>
                  <th>الجهة / الشريك</th>
                  <th>المشروع / التوجيه</th>
                  <th>الطريقة</th>
                  <th>المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {dailyModel.receipts.map((r: any) => (
                  <tr key={r.id}>
                    <td>{r.receipt_number || '---'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{r.partner_name}</td>
                    <td style={{ fontSize: 'var(--fs-xs)' }}>{r.projects_label}</td>
                    <td>{r.payment_method || '---'}</td>
                    <td style={{ fontWeight: 900, color: '#10b981' }}>{formatCurrency(r.amount_num)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ textAlign: 'right' }}>إجمالي الداخل اليوم</td>
                  <td>{formatCurrency(dailyModel.cashIn)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* سندات الصرف (الخارج) */}
        <div className="rpt-section-card" style={{ marginBottom: 0 }}>
          <div className="rpt-section-title">
            <h3>
              <ArrowUpRight size={18} color="#f43f5e" style={{ display: 'inline', marginLeft: '6px', verticalAlign: 'middle' }} />
              3ب. الفلوس اللي اتصرفت اليوم ({dailyModel.payments.length} سند)
            </h3>
            <strong style={{ color: '#f43f5e', fontSize: 'var(--fs-md)' }}>
              {formatCurrency(dailyModel.cashOut)}
            </strong>
          </div>
          {dailyModel.payments.length === 0 ? (
            <div style={{ padding: '1.15rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 800 }}>
              لا توجد سندات صرف مسجلة بتاريخ {selectedDate}.
            </div>
          ) : (
            <table className="rpt-table" style={{ minWidth: '30rem' }}>
              <thead>
                <tr>
                  <th>رقم السند</th>
                  <th>التصنيف</th>
                  <th>المستفيد</th>
                  <th>المشروع / البيان</th>
                  <th>المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {dailyModel.payments.map((v: any) => (
                  <tr key={v.id}>
                    <td>{v.voucher_number || '---'}</td>
                    <td>{v.category}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{v.partner_name}</td>
                    <td style={{ textAlign: 'right', fontSize: 'var(--fs-xs)' }}>
                      {v.projects_label} {v.description ? `— ${v.description}` : ''}
                    </td>
                    <td style={{ fontWeight: 900, color: '#f43f5e' }}>{formatCurrency(v.amount_num)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ textAlign: 'right' }}>إجمالي المصروف بسندات اليوم</td>
                  <td>{formatCurrency(dailyModel.cashOut)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* 4. مصروفات اليوم التفصيلية */}
      <div className="rpt-section-card" style={{ marginBottom: 0 }}>
        <div className="rpt-section-title">
          <h3>
            <Receipt size={18} style={{ display: 'inline', marginLeft: '6px', verticalAlign: 'middle' }} />
            4. كشف مصروفات النهارده وتوزيعها ({dailyModel.expenses.length} مصروف)
          </h3>
          <strong style={{ color: '#d97706', fontSize: 'var(--fs-md)' }}>
            إجمالي مصروفات اليوم: {formatCurrency(dailyModel.expensesTotal)}
          </strong>
        </div>

        {dailyModel.expenses.length === 0 ? (
          <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 800 }}>
            لا توجد مصروفات مسجلة بتاريخ {selectedDate}.
          </div>
        ) : (
          <table className="rpt-table">
            <thead>
              <tr>
                <th>#</th>
                <th>التصنيف الرئيسي</th>
                <th>البيان / الوصف</th>
                <th>الجهة / المستفيد</th>
                <th>التوجيه على الفلل (أو ABC)</th>
                <th>طريقة الدفع</th>
                <th>الضريبة</th>
                <th>صافي المصروف</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {dailyModel.expenses.map((e: any, idx: number) => (
                <tr key={e.id || idx}>
                  <td>{idx + 1}</td>
                  <td style={{ fontWeight: 800 }}>{e.main_category || 'مصروف عام'}</td>
                  <td style={{ textAlign: 'right' }}>{e.display_description}</td>
                  <td>{e.payee_display}</td>
                  <td style={{ textAlign: 'right', fontSize: 'var(--fs-xs)' }}>{e.distribution_text}</td>
                  <td>{e.payment_method || '---'}</td>
                  <td>{formatCurrency(Number(e.vat_amount) || 0)}</td>
                  <td style={{ fontWeight: 900, color: '#d97706' }}>{formatCurrency(e.net_amount)}</td>
                  <td>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 800,
                        background: e.is_posted ? 'rgba(16, 185, 129, 0.14)' : 'rgba(245, 158, 11, 0.14)',
                        color: e.is_posted ? '#059669' : '#d97706',
                      }}
                    >
                      {e.is_posted ? 'مرحل' : 'قيد المراجعة'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7} style={{ textAlign: 'right' }}>
                  إجمالي مصروفات اليوم ({dailyModel.expenses.length} بند)
                </td>
                <td>{formatCurrency(dailyModel.expensesTotal)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* 5. الخامات المنصرفة والموردة ومستخلصات المقاولين اليوم */}
      {(dailyModel.materialIssues.length > 0 ||
        dailyModel.materialReceipts.length > 0 ||
        dailyModel.subClaims.length > 0) && (
        <div className="rpt-section-card" style={{ marginBottom: 0 }}>
          <div className="rpt-section-title">
            <h3>
              <Package size={18} style={{ display: 'inline', marginLeft: '6px', verticalAlign: 'middle' }} />
              5. حركات الخامات والمستخلصات اليوم ({dailyModel.materialIssues.length} صرف خامات •{' '}
              {dailyModel.materialReceipts.length} توريد خامات • {dailyModel.subClaims.length} مستخلص)
            </h3>
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, color: 'var(--text-secondary)' }}>
              خامات منصرفة: {formatCurrency(dailyModel.materialIssuesTotal)} • مستخلصات:{' '}
              {formatCurrency(dailyModel.subClaimsTotal)}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(22rem, 1fr))',
              gap: '1rem',
            }}
          >
            {dailyModel.materialIssues.length > 0 && (
              <div style={{ background: 'var(--surface-sunken)', borderRadius: '14px', padding: '0.9rem' }}>
                <div style={{ fontWeight: 900, fontSize: 'var(--fs-sm)', marginBottom: '0.5rem', color: '#7c3aed' }}>
                  أذونات صرف الخامات ({dailyModel.materialIssues.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {dailyModel.materialIssues.map((m: any) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 700,
                        paddingBottom: '0.35rem',
                        borderBottom: '1px solid var(--table-zebra-bg)',
                      }}
                    >
                      <span>
                        {m.issue_number || '---'} • {m.project_display_name} ({m.contractor_display})
                      </span>
                      <strong style={{ color: '#7c3aed' }}>{formatCurrency(m.total_num)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {dailyModel.materialReceipts.length > 0 && (
              <div style={{ background: 'var(--surface-sunken)', borderRadius: '14px', padding: '0.9rem' }}>
                <div style={{ fontWeight: 900, fontSize: 'var(--fs-sm)', marginBottom: '0.5rem', color: '#0284c7' }}>
                  توريدات الخامات ({dailyModel.materialReceipts.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {dailyModel.materialReceipts.map((m: any) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 700,
                        paddingBottom: '0.35rem',
                        borderBottom: '1px solid var(--table-zebra-bg)',
                      }}
                    >
                      <span>
                        {m.receipt_number || '---'} • {m.project_display_name} ({m.receipt_type || 'شركة'})
                      </span>
                      <strong style={{ color: '#0284c7' }}>{formatCurrency(m.total_num)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {dailyModel.subClaims.length > 0 && (
              <div style={{ background: 'var(--surface-sunken)', borderRadius: '14px', padding: '0.9rem' }}>
                <div style={{ fontWeight: 900, fontSize: 'var(--fs-sm)', marginBottom: '0.5rem', color: '#059669' }}>
                  مستخلصات المقاولين ({dailyModel.subClaims.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {dailyModel.subClaims.map((c: any) => (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 700,
                        paddingBottom: '0.35rem',
                        borderBottom: '1px solid var(--table-zebra-bg)',
                      }}
                    >
                      <span>
                        {c.claim_number || '---'} • {c.contractor_display} ({c.project_display_name})
                      </span>
                      <strong style={{ color: '#059669' }}>{formatCurrency(c.net_num)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* نافذة المعاينة والطباعة الرسمية للتقرير اليومي A4 بدون حدود */}
      {isPrintOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <DailyReportPrintModal
            data={dailyModel}
            onClose={() => setIsPrintOpen(false)}
          />,
          document.body
        )}
    </div>
  );
}

function DailyReportPrintModal({
  data,
  onClose,
}: {
  data: DailyReportModel;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handlePrintNow = () => {
    printWithDocumentTitle({
      docType: 'التقرير_اليومي_التنفيذي',
      prefix: 'DAILY-RPT',
      seedParts: [data.selectedDate, data.cashIn, data.cashOut],
    });
  };

  return (
    <div
      className="print-modal-overlay"
      onClick={onClose}
      dir="rtl"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        overflowY: 'auto',
        padding: '16px 14px 48px',
        direction: 'rtl',
      }}
    >
      <style>{`
        ${PHI_DOC_CSS}
        #printable-daily-report .phi-doc-table,
        #printable-daily-report .phi-doc-table th,
        #printable-daily-report .phi-doc-table td {
          border: none !important;
        }
        #printable-daily-report .phi-doc-table th {
          background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%) !important;
          color: #ffffff !important;
          font-size: 9.5px;
          padding: 6px 5px;
        }
        #printable-daily-report .phi-doc-table td {
          font-size: 9.5px;
          padding: 5px 5px;
          background: transparent;
        }
        #printable-daily-report .phi-doc-table tbody tr:nth-child(even) td {
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
        }
        #printable-daily-report .phi-doc-table tfoot td {
          background: linear-gradient(180deg, #fff7ed 0%, #ffedd5 100%);
          font-weight: 900;
        }
        @media print {
          @page { size: A4 landscape; margin: 8mm 10mm; }
          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body > *:not(.print-modal-overlay) { display: none !important; }
          .no-print { display: none !important; }
          .print-modal-overlay {
            position: static !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
          }
          #printable-daily-report {
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* شريط التحكم في المعاينة */}
      <div
        className="no-print"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          maxWidth: '277mm',
          margin: '0 auto 14px',
          background: '#ffffff',
          borderRadius: '14px',
          padding: '12px 16px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.28)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          color: '#0f172a',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900 }}>
            معاينة الطباعة الرسمية — التقرير اليومي التنفيذي ({data.selectedDate})
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#64748b', fontWeight: 700 }}>
            نموذج A4 Landscape بدون حدود خارجية مع الرسوم البيانية والتوقيعات المعتمدة
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handlePrintNow}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              borderRadius: '10px',
              border: 'none',
              background: '#ea580c',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <Printer size={16} />
            <span>طباعة / حفظ PDF</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '9px 14px',
              borderRadius: '10px',
              border: 'none',
              background: '#f1f5f9',
              color: '#0f172a',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
            <span>إغلاق</span>
          </button>
        </div>
      </div>

      {/* ورقة التقرير الرسمية */}
      <div
        id="printable-daily-report"
        className="phi-doc"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '277mm',
          margin: '0 auto',
          background: '#ffffff',
          borderRadius: '14px',
          padding: '18px 20px',
          boxShadow: '0 22px 50px rgba(0, 0, 0, 0.35)',
        }}
      >
        <ReportOfficialHeader
          title="التقرير اليومي التنفيذي والمالي الشامل"
          subtitle={`${data.weekdayLabel} (${data.selectedDate}) — ${data.selectedProjectLabel}`}
          issueDate={data.selectedDate}
          refPrefix="DAILY"
          details={[
            { label: 'التاريخ المعتمد', value: data.selectedDate, ltr: true },
            { label: 'الفلل النشطة', value: `${data.activeVillasCount} فلل` },
            { label: 'عدد العمال', value: `${data.distinctWorkersCount} عامل (${data.laborDays} يومية)` },
            { label: 'إجمالي تشغيل اليوم', value: formatCurrency(data.totalDailyOperationsCost), accent: true },
          ]}
        />

        <DocStats
          items={[
            { label: 'الفلوس الداخلة اليوم (قبض)', value: formatCurrency(data.cashIn), tone: 'positive' },
            { label: 'الفلوس المصروفة اليوم (صرف)', value: formatCurrency(data.cashOut), tone: 'warn' },
            { label: 'مصروفات اليوم المسجلة', value: formatCurrency(data.expensesTotal) },
            {
              label: 'صافي حركة الخزينة اليوم',
              value: formatCurrency(data.netCash),
              highlight: true,
            },
          ]}
        />

        <DailyExecutiveCharts data={data} variant="print" />

        {data.activeVillas.length > 0 && (
          <>
            <DocSection title="أولاً: الفلل والمشاريع التي تم العمل بها اليوم" en="Active Villas Daily Summary" />
            <table className="phi-doc-table" style={{ width: '100%', marginBottom: '12px' }}>
              <thead>
                <tr>
                  <th>الفيلا / المشروع</th>
                  <th>العمال</th>
                  <th>اليوميات</th>
                  <th>أجور العمالة</th>
                  <th>مصروفات مباشرة</th>
                  <th>مصروفات ABC</th>
                  <th>خامات</th>
                  <th>مستخلصات</th>
                  <th>إجمالي التشغيل</th>
                  <th>القبض</th>
                  <th>الصرف</th>
                </tr>
              </thead>
              <tbody>
                {data.activeVillas.map((v) => (
                  <tr key={v.projectId}>
                    <td style={{ textAlign: 'right', fontWeight: 900 }}>{v.projectName}</td>
                    <td>{v.workersCount}</td>
                    <td>{v.laborDays}</td>
                    <td>{formatCurrency(v.laborCost)}</td>
                    <td>{formatCurrency(v.directExpensesCost)}</td>
                    <td>{formatCurrency(v.abcExpensesCost)}</td>
                    <td>{formatCurrency(v.materialsCost)}</td>
                    <td>{formatCurrency(v.claimsCost)}</td>
                    <td style={{ fontWeight: 900 }}>{formatCurrency(v.totalOperationalCost)}</td>
                    <td>{formatCurrency(v.cashIn)}</td>
                    <td>{formatCurrency(v.cashOut)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {data.laborLogs.length > 0 && (
          <>
            <DocSection title="ثانياً: كشف العمال الذين نزلوا للعمل اليوم" en="Daily Field Workforce" />
            <table className="phi-doc-table" style={{ width: '100%', marginBottom: '12px' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>اسم العامل / الفني</th>
                  <th>التخصص</th>
                  <th>الفيلا / الموقع</th>
                  <th>البند المنفذ</th>
                  <th>الحضور</th>
                  <th>الأجر</th>
                  <th>الملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {data.laborLogs.map((l: any, i: number) => (
                  <tr key={l.id || i}>
                    <td>{i + 1}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{l.worker_display_name}</td>
                    <td>{l.skill_level || '---'}</td>
                    <td>{l.project_display_name}</td>
                    <td style={{ textAlign: 'right' }}>{l.work_item_label}</td>
                    <td>{l.attendance_num}</td>
                    <td style={{ fontWeight: 900 }}>{formatCurrency(l.wage_num)}</td>
                    <td style={{ textAlign: 'right' }}>{l.production_desc || l.notes || '---'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {data.expenses.length > 0 && (
          <>
            <DocSection title="ثالثاً: مصروفات اليوم المسجلة وتوزيعها" en="Daily Expenses Breakdown" />
            <table className="phi-doc-table" style={{ width: '100%', marginBottom: '12px' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>التصنيف</th>
                  <th>البيان</th>
                  <th>المستفيد</th>
                  <th>التوجيه / ABC</th>
                  <th>الطريقة</th>
                  <th>الصافي</th>
                </tr>
              </thead>
              <tbody>
                {data.expenses.map((e: any, i: number) => (
                  <tr key={e.id || i}>
                    <td>{i + 1}</td>
                    <td>{e.main_category || 'عام'}</td>
                    <td style={{ textAlign: 'right' }}>{e.display_description}</td>
                    <td>{e.payee_display}</td>
                    <td style={{ textAlign: 'right' }}>{e.distribution_text}</td>
                    <td>{e.payment_method || '---'}</td>
                    <td style={{ fontWeight: 900 }}>{formatCurrency(e.net_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {(data.receipts.length > 0 || data.payments.length > 0) && (
          <>
            <DocSection title="رابعاً: سندات القبض والصرف اليوم (حركة الخزينة)" en="Daily Treasury Vouchers" />
            <table className="phi-doc-table" style={{ width: '100%', marginBottom: '12px' }}>
              <thead>
                <tr>
                  <th>النوع</th>
                  <th>رقم السند</th>
                  <th>الجهة / المستفيد</th>
                  <th>المشروع / البيان</th>
                  <th>الطريقة</th>
                  <th>المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {data.receipts.map((r: any) => (
                  <tr key={`rv-${r.id}`}>
                    <td style={{ color: '#059669', fontWeight: 900 }}>قبض (داخل)</td>
                    <td>{r.receipt_number || '---'}</td>
                    <td style={{ textAlign: 'right' }}>{r.partner_name}</td>
                    <td style={{ textAlign: 'right' }}>{r.projects_label}</td>
                    <td>{r.payment_method || '---'}</td>
                    <td style={{ color: '#059669', fontWeight: 900 }}>{formatCurrency(r.amount_num)}</td>
                  </tr>
                ))}
                {data.payments.map((v: any) => (
                  <tr key={`pv-${v.id}`}>
                    <td style={{ color: '#e11d48', fontWeight: 900 }}>صرف ({v.category})</td>
                    <td>{v.voucher_number || '---'}</td>
                    <td style={{ textAlign: 'right' }}>{v.partner_name}</td>
                    <td style={{ textAlign: 'right' }}>
                      {v.projects_label} {v.description ? `— ${v.description}` : ''}
                    </td>
                    <td>{v.payment_method || '---'}</td>
                    <td style={{ color: '#e11d48', fontWeight: 900 }}>{formatCurrency(v.amount_num)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <DocNote title="ملخص المطابقة اليومية">
          تم إجمال الحركات المسجلة بتاريخ {data.selectedDate}: الفلوس الداخلة ({formatCurrency(data.cashIn)})، والفلوس
          المصروفة بسندات ({formatCurrency(data.cashOut)})، ومصروفات اليوم المسجلة ({formatCurrency(data.expensesTotal)})،
          وأجور {data.distinctWorkersCount} عامل نزلوا للمواقع ({formatCurrency(data.laborTotal)}) عبر {data.activeVillasCount} فلل.
        </DocNote>

        <DocSignatures
          slots={[
            { title: 'إعداد المتابعة الميدانية والمحاسبية', date: data.selectedDate },
          ]}
        />

        <ReportContactFooter layout="compact" />
      </div>
    </div>
  );
}
