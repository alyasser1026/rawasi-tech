import { NextResponse } from 'next/server';
import puppeteer, { type Browser } from 'puppeteer';

export async function POST(request: Request) {
    let browser: Browser | undefined;
    try {
        const { htmlContent } = await request.json();

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

        // 🚀 إرسال الملف
        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename=statement.pdf',
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
