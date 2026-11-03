import { menuGroups } from './menuData';

export const NAVIGATION_SHORTCUTS = [
  { digit: '1', path: '/Dashboard' }, { digit: '2', path: '/labor_logs' },
  { digit: '3', path: '/expenses' }, { digit: '4', path: '/PaymentVouchers' },
  { digit: '5', path: '/ReceiptVouchers' }, { digit: '6', path: '/invoices' },
  { digit: '7', path: '/audit' }, { digit: '8', path: '/violations' },
  { digit: '9', path: '/statement' }, { digit: '0', path: '/PartnerBalances' },
] as const;

export function workspacePages(role: string, can: (module: string, action: string) => boolean) {
  return menuGroups.flatMap(group => group.items
    .filter(item => role === 'admin' || role === 'super_admin' || ['home', 'profile', 'messages', 'notifications'].includes(item.id) || can(item.id, 'view'))
    .map(item => ({ ...item, group: group.group })));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[\u064B-\u065F\u0640]/g, '');
}

export function searchWorkspacePages(pages: ReturnType<typeof workspacePages>, query: string) {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  return pages.filter(item => terms.every(term => normalize(`${item.title} ${item.group} ${item.path}`).includes(term)));
}
