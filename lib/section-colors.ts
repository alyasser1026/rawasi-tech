import type { CSSProperties } from 'react';
import { menuGroups } from './menuData';

// Color identifies a workspace section, never a balance or transaction status.
const SECTION_COLORS = {
  overview: { accent: '#4f46e5', tint: '#eef2ff', border: '#c7d2fe' },
  finance: { accent: '#c2410c', tint: '#fff7ed', border: '#fed7aa' },
  projects: { accent: '#0369a1', tint: '#f0f9ff', border: '#bae6fd' },
  people: { accent: '#0f766e', tint: '#f0fdfa', border: '#99f6e4' },
  communication: { accent: '#7e22ce', tint: '#faf5ff', border: '#e9d5ff' },
  system: { accent: '#475569', tint: '#f1f5f9', border: '#cbd5e1' },
} as const;

const GROUP_TONES: Record<string, keyof typeof SECTION_COLORS> = {
  'الداشبورد والملخصات': 'overview',
  'الحسابات المالية': 'finance',
  'المشاريع والشركاء': 'projects',
  'العمالة والموارد البشرية': 'people',
  'التواصل الداخلي': 'communication',
  'النظام والتقارير': 'system',
};

export function getSectionColors(pathname: string) {
  const group = menuGroups.find(group => group.items.some(item => item.path === pathname || (item.path !== '/' && pathname.startsWith(`${item.path}/`))));
  return SECTION_COLORS[GROUP_TONES[group?.group || ''] || 'system'];
}

export function getSectionStyle(pathname: string): CSSProperties & Record<'--section-accent' | '--section-tint' | '--section-border', string> {
  const colors = getSectionColors(pathname);
  return { '--section-accent': colors.accent, '--section-tint': colors.tint, '--section-border': colors.border };
}
