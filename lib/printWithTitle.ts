/**
 * Coordinates browser print / Save-as-PDF filenames by syncing `document.title`
 * with the active document or report's structured `<Type>_<Number>` identifier.
 */

import {
  buildDocumentFileName,
  sanitizeFileNameSegment,
  type DocumentFileNameOptions,
} from './documentFileName';

export interface PrintableDocMeta {
  title: string;
  refCode?: string;
  docType?: string;
}

export interface PrintWithTitleOptions extends Partial<DocumentFileNameOptions> {
  explicitTitle?: string;
}

const PRINT_CONTAINER_SELECTORS = [
  '.print-modal-overlay',
  '.phi-boq-report-overlay',
  '.phi-dossier-overlay',
  '.custody-settlement-modal',
  '#printable-a4-sheet',
  '#printable-area',
  '#printable-report',
  '#printable-dossier',
  '.ecs-print-src',
  '.print-wrapper',
  '.print-area',
  '.print-only',
  '.cl-print-head',
  '.enterprise-page > .phi-print-masthead',
];

function extractMetaFromNode(el: Element | null): PrintableDocMeta | null {
  if (!el) return null;
  const title = el.getAttribute('data-phi-doc-title')?.trim();
  if (!title) return null;
  return {
    title,
    refCode: el.getAttribute('data-phi-doc-ref')?.trim() || undefined,
    docType: el.getAttribute('data-phi-doc-type')?.trim() || undefined,
  };
}

/**
 * Finds the active printable document metadata in priority order:
 * open print modals/overlays take precedence over background page mastheads.
 */
export function resolveActivePrintableDocMeta(): PrintableDocMeta | null {
  if (typeof document === 'undefined') return null;

  for (const selector of PRINT_CONTAINER_SELECTORS) {
    const containers = document.querySelectorAll(selector);
    for (let i = containers.length - 1; i >= 0; i--) {
      const container = containers[i];
      if (container.closest('.no-print')) continue;
      if (container.matches('[data-phi-doc-title]')) {
        const meta = extractMetaFromNode(container);
        if (meta) return meta;
      }
      const nested = container.querySelector('[data-phi-doc-title]');
      const meta = extractMetaFromNode(nested);
      if (meta) return meta;
    }
  }

  return extractMetaFromNode(document.querySelector('[data-phi-doc-title]'));
}

let explicitPrintActive = false;
let globalSyncRefCount = 0;
let globalSavedTitle: string | null = null;
let globalRestoreTimer: ReturnType<typeof setTimeout> | null = null;

function onGlobalBeforePrint() {
  if (typeof document === 'undefined' || explicitPrintActive) return;
  const meta = resolveActivePrintableDocMeta();
  if (!meta?.title) return;

  if (globalSavedTitle === null) {
    globalSavedTitle = document.title;
  }
  document.title = meta.title;

  if (globalRestoreTimer) clearTimeout(globalRestoreTimer);
  globalRestoreTimer = setTimeout(() => {
    if (globalSavedTitle !== null && !explicitPrintActive) {
      document.title = globalSavedTitle;
      globalSavedTitle = null;
    }
  }, 60000);
}

function onGlobalAfterPrint() {
  if (globalRestoreTimer) {
    clearTimeout(globalRestoreTimer);
    globalRestoreTimer = null;
  }
  if (typeof document !== 'undefined' && globalSavedTitle !== null && !explicitPrintActive) {
    document.title = globalSavedTitle;
    globalSavedTitle = null;
  }
}

/**
 * Installs a reference-counted `beforeprint`/`afterprint` listener on `window`
 * so even native Ctrl+P or raw `window.print()` calls propose `<Type>_<Number>.pdf`.
 */
export function installGlobalPrintTitleSync(): () => void {
  if (typeof window === 'undefined') return () => {};

  if (globalSyncRefCount === 0) {
    window.addEventListener('beforeprint', onGlobalBeforePrint);
    window.addEventListener('afterprint', onGlobalAfterPrint);
  }
  globalSyncRefCount += 1;

  return () => {
    globalSyncRefCount = Math.max(0, globalSyncRefCount - 1);
    if (globalSyncRefCount === 0) {
      window.removeEventListener('beforeprint', onGlobalBeforePrint);
      window.removeEventListener('afterprint', onGlobalAfterPrint);
      onGlobalAfterPrint();
    }
  };
}

/**
 * Temporarily sets `document.title` to `<Type>_<Number>` while calling `window.print()`,
 * restoring the previous title cleanly on `afterprint` or timeout.
 */
export function printWithDocumentTitle(options?: PrintWithTitleOptions): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const activeMeta = resolveActivePrintableDocMeta();
  let targetTitle = '';

  if (options?.explicitTitle) {
    targetTitle = sanitizeFileNameSegment(options.explicitTitle, 96);
  } else if (options?.docType) {
    targetTitle = buildDocumentFileName({
      docType: options.docType,
      docNumber: options.docNumber ?? activeMeta?.refCode,
      subject: options.subject,
      prefix: options.prefix,
      issueDate: options.issueDate,
      seedParts: options.seedParts,
    }).baseName;
  } else if (activeMeta?.title) {
    targetTitle = activeMeta.title;
  }

  if (!targetTitle) {
    window.print();
    return;
  }

  const prevTitle = document.title;
  explicitPrintActive = true;
  document.title = targetTitle;

  let restored = false;
  let safetyTimer: ReturnType<typeof setTimeout> | null = null;
  const restore = () => {
    if (restored) return;
    restored = true;
    explicitPrintActive = false;
    if (safetyTimer) clearTimeout(safetyTimer);
    document.title = prevTitle;
  };

  window.addEventListener('afterprint', restore, { once: true });
  safetyTimer = setTimeout(restore, 15000);

  window.print();
}
