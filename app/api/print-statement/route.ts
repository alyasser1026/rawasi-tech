import { NextResponse } from 'next/server';
import puppeteer, { type Browser } from 'puppeteer';
import { buildContentDispositionAttachment, buildDocumentFileName } from '@/lib/documentFileName';

export async function POST(request: Request) {
    let browser: Browser | undefined;
    try {
        const { htmlContent, fileName } = await request.json();

        // 🚀 تشغيل متصفح سيرفر مخفي
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        
        const page = await browser.newPage();
        
        // 🚀 حقن كود الـ HTML
        await page.setContent(htmlContent, { waitUntil: 'load' });
        await page.waitForNetworkIdle();
        
        // 🚀 إصدار ملف الـ PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
        });

        const defaultName = buildDocumentFileName({
            docType: 'كشف_حساب_تفصيلي',
            prefix: 'STM',
            ext: 'pdf',
        }).fileName;
        const resolvedFileName = typeof fileName === 'string' && fileName.trim() ? fileName.trim() : defaultName;

        // 🚀 إرسال الملف
        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': buildContentDispositionAttachment(resolvedFileName),
            },
        });

    } catch (error: any) {
        // 🔥 طباعة الخطأ في تيرمينال الـ VS Code
        console.error("🔥 PDF Generation Error (Backend): ", error);
        
        // 🔥 إرسال الخطأ الحقيقي للـ Frontend
        return NextResponse.json({ error: error.message || "Unknown Server Error" }, { status: 500 });
    } finally {
        await browser?.close();
    }
}
