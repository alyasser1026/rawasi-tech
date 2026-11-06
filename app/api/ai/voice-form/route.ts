import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MODAL_SCHEMAS: Record<string, string> = {
  labor_log: `
    - worker_name: اسم العامل أو المهنة (مثال: عمال محارة، أحمد محمود، نجار مسلح)
    - number_of_workers: عدد العمال (افتراضي 1)
    - site_ref: اسم الموقع أو رقم الفيلا (مثال: فيلا 105، عمارة 12)
    - work_item: بند الأعمال (مثال: بياض محارة، مباني، خرسانة مسلحة، عزل)
    - daily_wage: الأجر اليومي للعامل كعدد (مثال: 150)
    - tareeha: الطريحة المستهدفة كعدد (مثال: 25)
    - productivity: الإنتاجية المحققة فعلياً كعدد (مثال: 20)
    - unit: وحدة القياس (مثال: م2، م3، متر طولي، مقطوعية)
    - notes: أي ملاحظات إضافية
  `,
  expense: `
    - amount: المبلغ الإجمالي كعدد (مثال: 450)
    - description: بيان أو وصف المصروف (مثال: شراء بنزين ونثريات موقع)
    - main_category: التصنيف الرئيسي (مثال: خامات، نقل ومشالات، بوفيه ونثريات، وقود)
    - site_ref: اسم الموقع أو رقم الفيلا (مثال: فيلا 102)
    - sub_contractor: اسم المورد أو مقاول الباطن إن وجد
    - payment_method: طريقة الدفع (آجل، نقدي، عهدة)
    - notes: ملاحظات
  `,
  violation: `
    - site_name: اسم الموقع أو الفيلا (مثال: فيلا 204)
    - emp_name: اسم الشخص أو المقاول المخالف
    - violation_type: نوع المخالفة (غرامة، إنذار سلامة، مخالفة مواصفات)
    - amount: قيمة الغرامة كعدد (مثال: 300)
    - reason: سبب وتفاصيل المخالفة (مثال: عدم نظافة الموقع وإلقاء مخلفات)
  `,
  job_order: `
    - project_name: اسم المشروع أو الفيلا
    - contractor_name: اسم مقاول الباطن
    - work_item: اسم بند الشغل
    - assigned_qty: الكمية المسندة كعدد
    - unit_price: سعر الوحدة كعدد
    - notes: شروط أو ملاحظات
  `,
  material_issue: `
    - project_name: اسم الفيلا أو المشروع
    - item_name: اسم الصنف أو الخامة (مثال: أسمنت بورتلاندي، حديد 14، رمل)
    - quantity: الكمية المصروفة كعدد
    - unit: الوحدة (شيكارة، طن، متر مكعب)
    - work_item: البند الذي صُرفت له الخامة
  `,
  purchase_order: `
    - supplier_name: اسم المورد
    - item_name: اسم الصنف
    - quantity: الكمية كعدد
    - unit_price: سعر الوحدة كعدد
    - notes: شروط التوريد
  `,
  payment_voucher: `
    - beneficiary_name: اسم المستفيد (مورد، مقاول، موظف)
    - amount: المبلغ المنصرف كعدد
    - payment_method: نقدي أو تحويل بنكي أو شيك
    - notes: بيان الصرف
  `,
  receipt_voucher: `
    - client_name: اسم العميل أو المسدد
    - amount: المبلغ المحصل كعدد
    - payment_method: نقدي أو تحويل بنكي
    - notes: بيان القبض ورقم الدفعة
  `,
};

export async function POST(req: Request) {
  try {
    const groqKey = process.env.GROQ_API_KEY?.trim();
    const geminiKey = process.env.GEMINI_API_KEY?.trim();

    if (!groqKey) {
      return NextResponse.json(
        { ok: false, error: 'مفتاح GROQ_API_KEY غير مضاف في متغيرات البيئة' },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio') as Blob | null;
    const modalType = (formData.get('modal_type') as string) || 'labor_log';

    if (!audioFile) {
      return NextResponse.json({ ok: false, error: 'لم يتم استلام أي ملف صوتي' }, { status: 400 });
    }

    // Step 1: Transcribe Audio using Groq Whisper Large V3 Turbo (Ultra Fast ~200ms)
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile, 'recording.webm');
    whisperFormData.append('model', 'whisper-large-v3-turbo');
    whisperFormData.append('language', 'ar');

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
      },
      body: whisperFormData,
    });

    const groqJson = await groqRes.json();
    if (!groqRes.ok || !groqJson?.text) {
      console.error('Groq Whisper error:', groqJson);
      return NextResponse.json(
        { ok: false, error: groqJson?.error?.message || 'فشل تحويل الصوت إلى نص عبر Whisper' },
        { status: 500 }
      );
    }

    const transcript = groqJson.text.trim();
    if (!transcript) {
      return NextResponse.json({ ok: false, error: 'لم يتم التعرف على أي كلمات في التسجيل الصوتي' }, { status: 400 });
    }

    // Step 2: Extract Structured Fields using Gemini (or ALLaM) with JSON schema
    const schemaRules = MODAL_SCHEMAS[modalType] || MODAL_SCHEMAS.labor_log;
    const extractionPrompt = `
أنت خبير إدخال بيانات لمنظومة فاي تك للمقاولات والمشاريع.
المستخدم تحدث بالأمر الصوتي التالي:
"${transcript}"

المطلوب:
استخرج البيانات من الكلام المنطوق وضعها داخل كائن JSON يطابق الحقول التالية:
${schemaRules}

شروط صارمة:
1. أعد كائن JSON صالح فقط دون أي شروحات أو كتل كود.
2. إذا ذكر المستخدم أرقاماً حولها لأرقام عددية (Numbers).
3. استنتج اسم المشروع والفيلا والبند بذكاء من السياق.
`;

    let parsedFields: Record<string, any> = {};

    if (geminiKey) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiKey}`;
      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: extractionPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      });

      const geminiJson = await geminiRes.json();
      const rawJson = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawJson) {
        try {
          parsedFields = JSON.parse(rawJson);
        } catch {}
      }
    }

    // Fallback parser if Gemini was not available or JSON parse failed
    if (Object.keys(parsedFields).length === 0) {
      parsedFields = { transcript, raw_speech: transcript };
    }

    return NextResponse.json({
      ok: true,
      transcript,
      modal_type: modalType,
      fields: parsedFields,
    });
  } catch (err: any) {
    console.error('Error in voice-form API:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'خطأ داخلي في الخادم' }, { status: 500 });
  }
}
