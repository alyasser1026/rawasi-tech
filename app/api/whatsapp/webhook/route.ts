import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppTextMessage } from '@/lib/whatsapp';

export const runtime = 'nodejs';

/**
 * GET: Webhook verification by Meta
 * Meta sends hub.mode, hub.challenge, and hub.verify_token to verify the webhook endpoint.
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const myVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() || 'phi_tech_whatsapp_verify_secret_2026';

  if (mode === 'subscribe' && token === myVerifyToken) {
    console.log('✅ WhatsApp Webhook verified successfully by Meta!');
    return new Response(challenge, { status: 200 });
  }

  return new Response('Verification token mismatch', { status: 403 });
}

/**
 * POST: Incoming WhatsApp messages from users
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Verify it's a WhatsApp webhook event
    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      // Could be status updates (sent, delivered, read)
      return NextResponse.json({ status: 'no_messages' }, { status: 200 });
    }

    const message = messages[0];
    const fromNumber = message.from; // e.g. 2010... or 9665...
    const messageType = message.type;

    if (messageType === 'text') {
      const incomingText = message.text?.body?.trim();
      console.log(`📩 New WhatsApp message from ${fromNumber}: "${incomingText}"`);

      // Default acknowledgement / automated assistant response
      // (This can be routed into Gemini + Copilot tools)
      let replyText = `أهلاً بك في منظومة فاي تك لإدارة المشروعات والمحاسبة.\nاستلمت رسالتك: "${incomingText}".\nجاري ربط ومعالجة طلبك عبر المساعد الذكي.`;

      // Simple keywords test
      if (incomingText === '1' || incomingText.toLowerCase() === 'help' || incomingText.includes('مساعدة')) {
        replyText = `منظومة فاي تك الذكية:\n1️⃣ للاستعلام عن عمالة اليوم اكتب: «العمالة اللي نزلت النهارده»\n2️⃣ للاستعلام عن المشاريع اكتب: «المشاريع اللي موجودة كلها»\n3️⃣ للحصول على تقرير اليوم اكتب: «اديني سامري عن اللي حصل النهارده»\n4️⃣ لتسجيل يومية أو مصروف اكتب التفاصيل وسيقوم النظام بتسجيلها كمسودة.`;
      }

      await sendWhatsAppTextMessage(fromNumber, replyText);
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (err: any) {
    console.error('Error handling WhatsApp webhook:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
