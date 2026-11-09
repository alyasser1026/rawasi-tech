"use client";

import React, { useMemo, useState } from 'react';
import {
  CATEGORIES, convert, fmt, rebarKgPerMeter, REBAR_DIAMETERS,
  concreteEstimate, ELEMENT_DEFAULTS, roomEstimate, type ConcreteElement,
} from './eng-math';

type Tab = 'convert' | 'concrete' | 'room' | 'rebar';
const TABS: { id: Tab; label: string }[] = [
  { id: 'convert', label: 'محوّل الوحدات' },
  { id: 'concrete', label: 'خرسانة وحديد' },
  { id: 'room', label: 'بلاط ودهان' },
  { id: 'rebar', label: 'أوزان الحديد' },
];

const num = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(',', '.')));

function Field({ label, value, onChange, unit, step = 'any' }: { label: string; value: string; onChange: (v: string) => void; unit?: string; step?: string }) {
  return (
    <label className="pw-field">
      <span>{label}</span>
      <div className="pw-input">
        <input inputMode="decimal" step={step} value={value} onChange={e => onChange(e.target.value)} dir="ltr" />
        {unit && <em>{unit}</em>}
      </div>
    </label>
  );
}

function Result({ items }: { items: { label: string; value: string; unit?: string; strong?: boolean }[] }) {
  return (
    <dl className="pw-results">
      {items.map(i => (
        <div key={i.label} className={i.strong ? 'is-strong' : ''}>
          <dt>{i.label}</dt>
          <dd><span dir="ltr">{i.value}</span>{i.unit && <small>{i.unit}</small>}</dd>
        </div>
      ))}
    </dl>
  );
}

function Converter() {
  const [catId, setCatId] = useState(CATEGORIES[0].id);
  const cat = CATEGORIES.find(c => c.id === catId)!;
  const [value, setValue] = useState('1');
  const [from, setFrom] = useState(cat.units[0].id);
  const [to, setTo] = useState(cat.units[1].id);

  const pick = (id: string) => {
    const c = CATEGORIES.find(x => x.id === id)!;
    setCatId(id); setFrom(c.units[0].id); setTo(c.units[1].id);
  };
  const out = convert(catId, num(value), from, to);
  const table = cat.units.map(u => ({ u, v: convert(catId, num(value), from, u.id) }));

  return (
    <div className="pw-tool">
      <div className="pw-seg" role="tablist" aria-label="نوع الكمية">
        {CATEGORIES.map(c => (
          <button key={c.id} type="button" role="tab" aria-selected={c.id === catId} className={c.id === catId ? 'is-on' : ''} onClick={() => pick(c.id)}>{c.label}</button>
        ))}
      </div>
      <div className="pw-conv">
        <Field label="القيمة" value={value} onChange={setValue} />
        <label className="pw-field">
          <span>من</span>
          <select value={from} onChange={e => setFrom(e.target.value)}>{cat.units.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}</select>
        </label>
        <button type="button" className="pw-swap" aria-label="عكس الوحدتين" onClick={() => { setFrom(to); setTo(from); }}>⇄</button>
        <label className="pw-field">
          <span>إلى</span>
          <select value={to} onChange={e => setTo(e.target.value)}>{cat.units.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}</select>
        </label>
      </div>
      <div className="pw-answer" aria-live="polite">
        <span>النتيجة</span>
        <strong dir="ltr">{fmt(out, 4)}</strong>
        <small>{cat.units.find(u => u.id === to)?.label}</small>
      </div>
      <table className="pw-table">
        <caption>نفس القيمة بكل وحدات {cat.label}</caption>
        <tbody>
          {table.map(r => (<tr key={r.u.id}><th scope="row">{r.u.label}</th><td dir="ltr">{fmt(r.v, 4)}</td></tr>))}
        </tbody>
      </table>
      {cat.note && <p className="pw-note">{cat.note}</p>}
    </div>
  );
}

function Concrete() {
  const [el, setEl] = useState<ConcreteElement>('slab');
  const [L, setL] = useState('10');
  const [Wd, setWd] = useState('8');
  const [Th, setTh] = useState('0.2');
  const [count, setCount] = useState('1');
  const [waste, setWaste] = useState('5');
  const [steel, setSteel] = useState(String(ELEMENT_DEFAULTS.slab.steel));
  const [cement, setCement] = useState('350');

  const r = useMemo(() => concreteEstimate({
    length: num(L), width: num(Wd), thickness: num(Th), count: num(count), wastePct: num(waste),
    steelKgPerM3: num(steel), cementKgPerM3: num(cement),
  }), [L, Wd, Th, count, waste, steel, cement]);

  return (
    <div className="pw-tool">
      <div className="pw-seg" role="tablist" aria-label="نوع العنصر">
        {(Object.keys(ELEMENT_DEFAULTS) as ConcreteElement[]).map(k => (
          <button key={k} type="button" role="tab" aria-selected={k === el} className={k === el ? 'is-on' : ''} onClick={() => { setEl(k); setSteel(String(ELEMENT_DEFAULTS[k].steel)); }}>{ELEMENT_DEFAULTS[k].label}</button>
        ))}
      </div>
      <div className="pw-grid-fields">
        <Field label="الطول" value={L} onChange={setL} unit="م" />
        <Field label="العرض" value={Wd} onChange={setWd} unit="م" />
        <Field label="السُّمك / الارتفاع" value={Th} onChange={setTh} unit="م" />
        <Field label="العدد" value={count} onChange={setCount} />
        <Field label="هالك وزيادة" value={waste} onChange={setWaste} unit="%" />
        <Field label="حديد تسليح (استرشادي)" value={steel} onChange={setSteel} unit="كجم/م³" />
        <Field label="أسمنت لكل م³" value={cement} onChange={setCement} unit="كجم" />
      </div>
      {r ? (
        <Result items={[
          { label: 'حجم الخرسانة الصافي', value: fmt(r.netM3), unit: 'م³' },
          { label: 'الكمية المطلوبة بعد الهالك', value: fmt(r.orderM3), unit: 'م³', strong: true },
          { label: 'حديد التسليح', value: fmt(r.steelTon, 3), unit: 'طن', strong: true },
          { label: 'الأسمنت', value: fmt(r.cementBags50, 0), unit: 'كيس 50 كجم' },
          { label: 'الرمل', value: fmt(r.sandM3), unit: 'م³' },
          { label: 'الزلط', value: fmt(r.gravelM3), unit: 'م³' },
        ]} />
      ) : <p className="pw-note">أدخل أرقامًا أكبر من صفر في الطول والعرض والسُّمك.</p>}
      <p className="pw-note">تقدير أولي للاسترشاد. نسب الحديد والأسمنت قابلة للتعديل وتتحدد في المشروع من الحسابات الإنشائية والمواصفات، والمقايسة النهائية بعد المعاينة.</p>
    </div>
  );
}

function Room() {
  const [L, setL] = useState('5');
  const [Wd, setWd] = useState('4');
  const [H, setH] = useState('3');
  const [ops, setOps] = useState('4');
  const [tl, setTl] = useState('60');
  const [tw, setTw] = useState('60');
  const [tWaste, setTWaste] = useState('10');
  const [coats, setCoats] = useState('2');
  const [cover, setCover] = useState('10');

  const r = useMemo(() => roomEstimate({
    length: num(L), width: num(Wd), height: num(H), openingsM2: Number.isFinite(num(ops)) ? num(ops) : 0,
    tileLength: num(tl), tileWidth: num(tw), tileWastePct: Number.isFinite(num(tWaste)) ? num(tWaste) : 0,
    paintCoats: num(coats), paintCoverageM2PerL: num(cover),
  }), [L, Wd, H, ops, tl, tw, tWaste, coats, cover]);

  return (
    <div className="pw-tool">
      <div className="pw-grid-fields">
        <Field label="طول الغرفة" value={L} onChange={setL} unit="م" />
        <Field label="عرض الغرفة" value={Wd} onChange={setWd} unit="م" />
        <Field label="ارتفاع الغرفة" value={H} onChange={setH} unit="م" />
        <Field label="مساحة الفتحات (أبواب وشبابيك)" value={ops} onChange={setOps} unit="م²" />
        <Field label="طول البلاطة" value={tl} onChange={setTl} unit="سم" />
        <Field label="عرض البلاطة" value={tw} onChange={setTw} unit="سم" />
        <Field label="هالك البلاط" value={tWaste} onChange={setTWaste} unit="%" />
        <Field label="عدد أوجه الدهان" value={coats} onChange={setCoats} />
        <Field label="تغطية اللتر (استرشادي)" value={cover} onChange={setCover} unit="م²/لتر" />
      </div>
      {r ? (
        <Result items={[
          { label: 'مساحة الأرضية', value: fmt(r.floorM2), unit: 'م²' },
          { label: 'مساحة الجدران (بعد الفتحات)', value: fmt(r.wallM2), unit: 'م²' },
          { label: 'عدد قطع البلاط بعد الهالك', value: fmt(r.tilesCount, 0), unit: 'قطعة', strong: true },
          { label: 'مساحة الدهان (جدران + سقف)', value: fmt(r.paintableM2), unit: 'م²' },
          { label: 'كمية الدهان', value: fmt(r.paintLitres), unit: 'لتر', strong: true },
        ]} />
      ) : <p className="pw-note">أدخل أبعادًا أكبر من صفر.</p>}
      <p className="pw-note">{r?.tileBoxesNote ?? ''} تغطية الدهان تختلف حسب النوع وحالة السطح، فراجع بيانات المنتج.</p>
    </div>
  );
}

function Rebar() {
  const [d, setD] = useState(16);
  const [len, setLen] = useState('12');
  const [qty, setQty] = useState('10');
  const kg = rebarKgPerMeter(d);
  const total = Number.isFinite(num(len)) && Number.isFinite(num(qty)) ? kg * num(len) * num(qty) : NaN;
  return (
    <div className="pw-tool">
      <div className="pw-grid-fields">
        <label className="pw-field">
          <span>قطر السيخ</span>
          <select value={d} onChange={e => setD(Number(e.target.value))}>{REBAR_DIAMETERS.map(x => <option key={x} value={x}>{x} مم</option>)}</select>
        </label>
        <Field label="طول السيخ" value={len} onChange={setLen} unit="م" />
        <Field label="العدد" value={qty} onChange={setQty} />
      </div>
      <Result items={[
        { label: 'وزن المتر الطولي', value: fmt(kg, 3), unit: 'كجم/م', strong: true },
        { label: 'وزن الكمية', value: fmt(total), unit: 'كجم' },
        { label: 'بالطن', value: fmt(total / 1000, 3), unit: 'طن' },
      ]} />
      <table className="pw-table">
        <caption>وزن المتر الطولي للأقطار الشائعة</caption>
        <tbody>
          {REBAR_DIAMETERS.map(x => (<tr key={x}><th scope="row">{x} مم</th><td dir="ltr">{fmt(rebarKgPerMeter(x), 3)} كجم/م</td></tr>))}
        </tbody>
      </table>
      <p className="pw-note">الوزن = القطر² ÷ 162 (القطر بالمليمتر)، وهو تقريب هندسي معروف.</p>
    </div>
  );
}

export default function EngTools() {
  const [tab, setTab] = useState<Tab>('convert');
  return (
    <div className="pw-tools">
      <div className="pw-tools-tabs" role="tablist" aria-label="الأدوات الهندسية">
        {TABS.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="pw-tools-body" role="tabpanel">
        {tab === 'convert' && <Converter />}
        {tab === 'concrete' && <Concrete />}
        {tab === 'room' && <Room />}
        {tab === 'rebar' && <Rebar />}
      </div>
    </div>
  );
}
