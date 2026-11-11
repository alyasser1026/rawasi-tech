"use client";
import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

// تكبير وتصغير واجهة السيستم كلها (الخطوط والمسافات والمربعات والقائمة والهيدر).
// كل المقاسات في السيستم بالـ rem، فتغيير حجم خط الجذر (--ui-scale في phi-scale.css) بيكبّر أو يصغّر كله بنسبة واحدة.
// الاختيار بيتحفظ على الجهاز ده، وبيتطبق قبل أول رسم من السكربت اللي في app/layout.tsx.

export const UI_SCALE_KEY = 'phi_ui_scale';
export const UI_SCALE_STEPS = [0.8, 0.85, 0.9, 1, 1.1, 1.2, 1.3] as const;

const nearest = (v: number) => UI_SCALE_STEPS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), 1 as number);

export function applyUiScale(v: number) {
  document.documentElement.style.setProperty('--ui-scale', String(v));
  try { localStorage.setItem(UI_SCALE_KEY, String(v)); } catch { /* storage unavailable */ }
}

export default function UiScaleControl() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    try { setScale(nearest(Number(localStorage.getItem(UI_SCALE_KEY)) || 1)); } catch { /* storage unavailable */ }
  }, []);

  const idx = UI_SCALE_STEPS.indexOf(scale as (typeof UI_SCALE_STEPS)[number]);
  const set = (v: number) => { setScale(v); applyUiScale(v); };
  const pct = Math.round(scale * 100);

  return (
    <div className="ent-ui-scale" role="group" aria-label="حجم الواجهة">
      <button type="button" className="ent-ui-scale-btn" onClick={() => set(UI_SCALE_STEPS[Math.max(0, idx - 1)])} disabled={idx <= 0} aria-label="تصغير الواجهة" title="تصغير">
        <Minus size={14} aria-hidden="true" />
      </button>
      <button type="button" className="ent-ui-scale-value" onClick={() => set(1)} aria-label={`حجم الواجهة ${pct}% — اضغط للرجوع للحجم الطبيعي`} title="الرجوع للحجم الطبيعي (100%)">
        {pct}%
      </button>
      <button type="button" className="ent-ui-scale-btn" onClick={() => set(UI_SCALE_STEPS[Math.min(UI_SCALE_STEPS.length - 1, idx + 1)])} disabled={idx >= UI_SCALE_STEPS.length - 1} aria-label="تكبير الواجهة" title="تكبير">
        <Plus size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
