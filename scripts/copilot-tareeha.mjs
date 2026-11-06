/**
 * copilot-tareeha.mjs — the one definition of a tareeha (daily target) deficit, shared by the bot's
 * tareeha tool and the worker statement PDF.
 *
 * Source fields on labor_daily_logs, as the daily-logs screen fills them:
 *   tareeha          «الطريحة (المستهدف)» — the day's target, auto-filled from the BOQ item
 *   productivity     «الإنتاجية (المنفذ)» — quantity actually executed
 *   attendance_value «الحضور» — 1 يوم كامل / 0.5 نصف يوم / 0 غياب
 *
 * Definition:
 *   expected   = tareeha × attendance_value  (a half day is expected to deliver half the target)
 *   deficit    = productivity < expected
 *   shortfall  = expected − productivity
 *   achievement% = productivity ÷ expected × 100
 * Not assessable (never counted as a deficit, but counted separately so it stays visible):
 *   no target (tareeha ≤ 0 / empty), productivity not recorded, or absence (attendance 0).
 * Note: the screen's «نسبة الإنجاز» is productivity ÷ tareeha without the attendance factor, so for a
 * half day the two percentages differ by design.
 */

const EPSILON = 1e-9;
const round2 = value => Math.round(value * 100) / 100;

function toNumber(value) {
  if (value === null || value === undefined || value === '') return NaN;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

/** Returns null when the row can't be assessed, otherwise { expected, done, shortfall, achievement, deficit }. */
export function assessTareeha(row) {
  const target = toNumber(row?.tareeha);
  const done = toNumber(row?.productivity);
  const rawAttendance = toNumber(row?.attendance_value);
  const attendance = Number.isNaN(rawAttendance) ? 1 : rawAttendance;
  if (!(target > 0) || Number.isNaN(done) || done < 0 || !(attendance > 0)) return null;
  const expected = round2(target * attendance);
  return {
    expected,
    done,
    shortfall: round2(Math.max(0, expected - done)),
    achievement: Math.round((done / expected) * 100),
    deficit: done + EPSILON < expected,
  };
}

/** Why a row with a target wasn't assessed (for counting), or null if it was / has no target. */
export function unassessedReason(row) {
  if (!(toNumber(row?.tareeha) > 0)) return null;
  if (Number.isNaN(toNumber(row?.productivity))) return 'no_productivity';
  if (!(Number.isNaN(toNumber(row?.attendance_value)) || toNumber(row?.attendance_value) > 0)) return 'absent';
  return assessTareeha(row) ? null : 'invalid';
}

export const TAREEHA_DEFINITION =
  'العجز = الإنتاجية أقل من (الطريحة × الحضور). نص اليوم مستهدفه نص الطريحة، والغياب والسجلات اللي من غير إنتاجية مابتتحسبش عجز وبتتعد لوحدها.';
