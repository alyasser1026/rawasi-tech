import { buildDocumentFileName, sanitizeFileNameSegment, type DocumentFileNameOptions } from './documentFileName';

/**
 * Prints a specific report DOM container (#printable-dossier, #printable-report, etc.)
 * inside an isolated, pure-white A4 Landscape iframe so the main application shell,
 * theme backgrounds (--bg-canvas: #f7eee2 / #0c0907), and modal scroll containers
 * can never clip or tint the printed pages.
 */
export function printReportElement(
  elementId: string,
  documentTitle?: string,
  namingOptions?: Partial<DocumentFileNameOptions>
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const sourceEl = document.getElementById(elementId);
  if (!sourceEl) {
    window.print();
    return;
  }

  const prevTitle = document.title;
  const headerMetaEl = sourceEl.querySelector('[data-phi-doc-title]');
  const domTitle = headerMetaEl?.getAttribute('data-phi-doc-title')?.trim() || '';
  const domRef = headerMetaEl?.getAttribute('data-phi-doc-ref')?.trim() || '';

  let printTitle = '';
  if (namingOptions?.docType) {
    printTitle = buildDocumentFileName({
      docType: namingOptions.docType,
      docNumber: namingOptions.docNumber ?? (domRef || undefined),
      subject: namingOptions.subject,
      prefix: namingOptions.prefix,
      issueDate: namingOptions.issueDate,
      seedParts: namingOptions.seedParts,
    }).baseName;
  } else if (documentTitle) {
    const cleanRequested = sanitizeFileNameSegment(documentTitle, 80);
    if (domRef && !cleanRequested.includes(sanitizeFileNameSegment(domRef, 48))) {
      printTitle = buildDocumentFileName({
        docType: documentTitle,
        docNumber: domRef,
      }).baseName;
    } else if (domRef || /\d{3,}/.test(cleanRequested)) {
      printTitle = cleanRequested;
    } else {
      printTitle = buildDocumentFileName({
        docType: documentTitle,
        prefix: 'REP',
      }).baseName;
    }
  } else if (domTitle) {
    printTitle = domTitle;
  } else {
    printTitle = buildDocumentFileName({
      docType: prevTitle || 'تقرير_فاي_تك',
      prefix: 'REP',
    }).baseName;
  }

  try {
    const existingIframe = document.getElementById('phi-report-print-iframe');
    if (existingIframe && existingIframe.parentNode) {
      existingIframe.parentNode.removeChild(existingIframe);
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'phi-report-print-iframe';
    iframe.setAttribute('aria-hidden', 'true');
    // In-viewport behind UI so Chromium/Edge never culls off-screen iframes into blank print pages.
    iframe.style.cssText =
      'position:fixed;left:0;top:0;width:277mm;height:194mm;border:0;opacity:0.001;pointer-events:none;z-index:-9999;background:#ffffff;';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    const iframeWin = iframe.contentWindow;
    if (!iframeDoc || !iframeWin) {
      window.print();
      return;
    }

    const clone = sourceEl.cloneNode(true) as HTMLElement;
    clone.classList.add('phi-print-root');
    clone.removeAttribute('aria-hidden');
    clone.style.display = 'block';
    clone.style.visibility = 'visible';
    clone.style.opacity = '1';
    clone.style.overflow = 'visible';
    clone.style.overflowY = 'visible';
    clone.style.overflowX = 'visible';
    clone.style.maxHeight = 'none';
    clone.style.height = 'auto';
    clone.style.background = '#ffffff';
    clone.style.color = '#0f172a';
    clone.style.padding = '0';
    clone.style.margin = '0';

    const origin = window.location.origin;
    const safeTitle = printTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <base href="${origin}/" />
  <title>${safeTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap" media="print" onload="this.media='all'" />
  <style>
    :root {
      --fs-2xs: 10px;
      --fs-xs: 11.5px;
      --fs-sm: 13px;
      --fs-md: 14.5px;
      --fs-lg: 16px;
      --fs-xl: 18px;
      --fs-2xl: 21px;
      --fs-3xl: 25px;
      --bg-canvas: #ffffff;
      --bg-canvas-secondary: #ffffff;
      --bg-main: #ffffff;
      --text-primary: #0f172a;
      --text-secondary: #334155;
      --text-muted: #64748b;
    }
    @page {
      size: A4 landscape;
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      overflow: visible !important;
      background: #ffffff !important;
      background-color: #ffffff !important;
      background-image: none !important;
      color: #0f172a !important;
      font-family: 'Cairo', 'Tajawal', system-ui, -apple-system, sans-serif !important;
      direction: rtl !important;
      line-height: 1.4;
    }
    body > *,
    body > .phi-print-root {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      overflow-x: visible !important;
    }
    .no-print, .dossier-no-print {
      display: none !important;
    }
    .dossier-keep-together {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .phi-print-unclip {
      overflow: visible !important;
      max-height: none !important;
      height: auto !important;
    }
    h1, h2, h3, h4 {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    table {
      width: 100% !important;
      max-width: 100% !important;
      table-layout: fixed !important;
      border-collapse: separate !important;
      border-spacing: 0 !important;
      border: 0 !important;
      page-break-inside: auto !important;
      break-inside: auto !important;
      background: #ffffff !important;
      word-wrap: break-word !important;
      overflow-wrap: break-word !important;
    }
    thead {
      display: table-header-group !important;
    }
    tfoot {
      display: table-footer-group !important;
    }
    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      border: 0 !important;
    }
    thead th, tbody td, tfoot td {
      position: static !important;
      top: auto !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      border: 0 !important;
      border-top: 0 !important;
      border-bottom: 0 !important;
      border-left: 0 !important;
      border-right: 0 !important;
      word-wrap: break-word !important;
      overflow-wrap: break-word !important;
      white-space: normal !important;
    }
    div, section, header, footer {
      border: 0 !important;
    }
  </style>
</head>
<body>
  ${clone.outerHTML}
</body>
</html>`;

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    let cleanupDone = false;
    const cleanup = () => {
      if (cleanupDone) return;
      cleanupDone = true;
      document.title = prevTitle;
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 250);
    };

    const triggerPrint = () => {
      try {
        document.title = printTitle;
        iframeWin.addEventListener('afterprint', cleanup, { once: true });
        setTimeout(cleanup, 60000);
        iframeWin.focus();
        iframeWin.print();
      } catch {
        window.print();
      } finally {
        setTimeout(() => {
          document.title = prevTitle;
        }, 1000);
      }
    };

    const images = Array.from(iframeDoc.images || []);
    const pendingImages = images.filter((img) => !img.complete);

    const scheduleTrigger = () => {
      const fontsReady = (iframeDoc as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
      const fontsGate = fontsReady
        ? Promise.race([fontsReady, new Promise<void>((r) => setTimeout(r, 350))])
        : Promise.resolve();
      Promise.resolve(fontsGate).finally(() => {
        iframeWin.requestAnimationFrame(() => {
          iframeWin.requestAnimationFrame(() => {
            setTimeout(triggerPrint, 60);
          });
        });
      });
    };

    if (pendingImages.length === 0) {
      scheduleTrigger();
    } else {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        scheduleTrigger();
      };
      const timeoutId = setTimeout(done, 700);
      Promise.all(
        pendingImages.map(
          (img) =>
            new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            })
        )
      ).then(() => {
        clearTimeout(timeoutId);
        done();
      });
    }
  } catch {
    window.print();
  }
}
