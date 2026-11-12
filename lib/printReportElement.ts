/**
 * Prints a specific report DOM container (#printable-dossier, #printable-report, etc.)
 * inside an isolated, pure-white A4 Landscape iframe so the main application shell,
 * theme backgrounds (--bg-canvas: #f7eee2 / #0c0907), and modal scroll containers
 * can never clip or tint the printed pages.
 */
export function printReportElement(elementId: string, documentTitle?: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const sourceEl = document.getElementById(elementId);
  if (!sourceEl) {
    window.print();
    return;
  }

  const prevTitle = document.title;
  const printTitle = documentTitle || prevTitle || 'PHI TECH Official Report';

  try {
    const existingIframe = document.getElementById('phi-report-print-iframe');
    if (existingIframe && existingIframe.parentNode) {
      existingIframe.parentNode.removeChild(existingIframe);
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'phi-report-print-iframe';
    iframe.setAttribute('aria-hidden', 'true');
    // Off-screen with real A4 dimensions and full opacity so Chromium/Edge
    // always computes full layout and never paints a 0x0 / opacity:0 blank frame.
    iframe.style.cssText =
      'position:fixed;left:-10000px;top:0;width:210mm;min-height:297mm;border:0;opacity:1;pointer-events:none;z-index:-1;background:#ffffff;';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    const iframeWin = iframe.contentWindow;
    if (!iframeDoc || !iframeWin) {
      window.print();
      return;
    }

    const clone = sourceEl.cloneNode(true) as HTMLElement;
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
      margin: 10mm 12mm;
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
      line-height: 1.45;
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
      border-collapse: collapse !important;
      page-break-inside: auto !important;
      break-inside: auto !important;
      background: #ffffff !important;
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
    }
    thead th {
      position: static !important;
      top: auto !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
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
