import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCopilotTools } from './copilot-tools.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables from .env.local without external dependencies
function loadEnvLocal() {
  const envPath = path.join(rootDir, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim().replace(/^\uFEFF/, '');
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
  }
  return env;
}

const env = loadEnvLocal();
const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
const GEMINI_API_KEY = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const SUPABASE_URL =
  env.SUPABASE_URL ||
  env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env['\uFEFFNEXT_PUBLIC_SUPABASE_URL'];
const SUPABASE_ANON_KEY =
  env.SUPABASE_SERVICE_ROLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!BOT_TOKEN) {
  console.error('❌ خطأ: TELEGRAM_BOT_TOKEN غير موجود في ملف .env.local');
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.warn('⚠️ تحذير: GEMINI_API_KEY غير موجود في .env.local.');
}

console.log('🤖 بدء تشغيل المساعد الذكي لنظام فاي تك (PHI TECH Telegram Copilot)...');

const KNOWLEDGE_PATH = path.join(rootDir, 'config', 'copilot_knowledge.md');
const SCENARIOS_PATH = path.join(rootDir, 'config', 'copilot_page_scenarios.md');
const MEMORY_PATH = path.join(rootDir, 'config', 'copilot_memory.json');

// Initialize database & PDF tools
const copilotTools = createCopilotTools({
  supabaseUrl: SUPABASE_URL,
  supabaseKey: SUPABASE_ANON_KEY,
  botToken: BOT_TOKEN,
});

// 📚 تحميل دليل المعرفة الثابت وسيناريوهات الشاشات
function loadKnowledgeBase() {
  let combined = '';
  try {
    if (fs.existsSync(KNOWLEDGE_PATH)) {
      combined += fs.readFileSync(KNOWLEDGE_PATH, 'utf8').trim() + '\n\n';
    }
    if (fs.existsSync(SCENARIOS_PATH)) {
      combined += fs.readFileSync(SCENARIOS_PATH, 'utf8').trim() + '\n\n';
    }
  } catch (err) {
    console.error('Error loading knowledge base:', err.message);
  }
  return combined.trim();
}

// 🧠 تحميل الذاكرة الديناميكية والقواعد المكتسبة
function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
      return Array.isArray(parsed?.rules) ? parsed.rules : [];
    }
  } catch (err) {
    console.error('Error loading memory:', err.message);
  }
  return [];
}

// 💾 حفظ قاعدة جديدة في الذاكرة
function saveRuleToMemory(ruleText, topic = 'تدريب مخصص') {
  try {
    const rules = loadMemory();
    const newRule = {
      id: String(rules.length + 1),
      topic,
      text: ruleText.trim(),
      added_at: new Date().toISOString(),
    };
    rules.push(newRule);
    const payload = {
      last_updated: new Date().toISOString(),
      rules,
    };
    fs.mkdirSync(path.dirname(MEMORY_PATH), { recursive: true });
    fs.writeFileSync(MEMORY_PATH, JSON.stringify(payload, null, 2), 'utf8');
    return newRule;
  } catch (err) {
    console.error('Error saving rule to memory:', err.message);
    return null;
  }
}

// 🗑️ حذف قاعدة من الذاكرة
function deleteRuleFromMemory(idOrKeyword) {
  try {
    const rules = loadMemory();
    const filtered = rules.filter(
      (r) => String(r.id) !== String(idOrKeyword) && !r.text.includes(String(idOrKeyword))
    );
    if (filtered.length === rules.length) return false;
    const payload = {
      last_updated: new Date().toISOString(),
      rules: filtered.map((r, idx) => ({ ...r, id: String(idx + 1) })),
    };
    fs.writeFileSync(MEMORY_PATH, JSON.stringify(payload, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error deleting rule:', err.message);
    return false;
  }
}

// تعريف الأدوات لـ Gemini (Function Declarations)
const FUNCTION_DECLARATIONS = [
  {
    name: 'get_labor_daily_logs',
    description: 'الاستعلام عن عدد وأسماء وتفاصيل العمال الذين اشتغلوا اليوم أو في تاريخ معين أو فترة من تاريخ إلى تاريخ مع أجورهم ومواقعهم',
    parameters: {
      type: 'OBJECT',
      properties: {
        date: { type: 'STRING', description: 'تاريخ محدد بصيغة YYYY-MM-DD أو كلمة today للبحث في يومية اليوم' },
        start_date: { type: 'STRING', description: 'تاريخ بداية الفترة بصيغة YYYY-MM-DD' },
        end_date: { type: 'STRING', description: 'تاريخ نهاية الفترة بصيغة YYYY-MM-DD' },
        worker_name: { type: 'STRING', description: 'اسم عامل معين إذا كان السؤال يخصه فقط' },
      },
    },
  },
  {
    name: 'get_tareeha_deficits',
    description: 'كشف وحصر العمال الذين عجزوا في الطريحة (الإنتاجية المنفذة أقل من الطريحة المطلوبة للبند) مع بيان مقدار العجز لكل عامل',
    parameters: {
      type: 'OBJECT',
      properties: {
        date: { type: 'STRING', description: 'تاريخ اليوم أو تاريخ محدد YYYY-MM-DD' },
        start_date: { type: 'STRING', description: 'تاريخ بداية الفترة YYYY-MM-DD' },
        end_date: { type: 'STRING', description: 'تاريخ نهاية الفترة YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'get_villa_and_budget_details',
    description: 'استعلام عن تفاصيل وبيانات وميزانية وتكاليف فيلا أو مشروع معين برقم الفيلا أو الكود أو الاسم',
    parameters: {
      type: 'OBJECT',
      properties: {
        villa_identifier: { type: 'STRING', description: 'رقم أو اسم الفيلا مثل 101 أو فيلا 204 أو كود المشروع' },
      },
      required: ['villa_identifier'],
    },
  },
  {
    name: 'get_model_villas_and_specs',
    description: 'استعلام عن عدد الفلل المسجلة تحت نموذج معين وقائمة أسمائها ومواصفات النموذج والمساحة',
    parameters: {
      type: 'OBJECT',
      properties: {
        model_name: { type: 'STRING', description: 'اسم أو رمز النموذج مثل A أو B أو دوبلكس أو نموذج 1' },
      },
      required: ['model_name'],
    },
  },
  {
    name: 'get_boq_and_materials',
    description: 'الاستعلام عن كمية بند معين في فيلا محددة (بالمتر والمنفذ)، أو الاستعلام عن البند موجود في كم فيلا، أو استهلاك الماتيريال والخامات للبند',
    parameters: {
      type: 'OBJECT',
      properties: {
        work_item: { type: 'STRING', description: 'اسم البند مثل خرسانة مسلحة، مباني، لياسة، عزل، دهانات' },
        villa_identifier: { type: 'STRING', description: 'رقم أو اسم الفيلا إذا كان السؤال عن كمية البند أو مواده في فيلا محددة' },
      },
      required: ['work_item'],
    },
  },
  {
    name: 'get_contractors_summary',
    description: 'استعلام عن مقاولي الباطن الذين معهم شغل جاري حالياً أو المقاولين الذين لهم مستحقات وفلوس واجبة السداد',
    parameters: {
      type: 'OBJECT',
      properties: {
        filter_type: {
          type: 'STRING',
          enum: ['active_work', 'with_balances'],
          description: 'active_work للمقاولين الذين معهم شغل جاري، with_balances للمقاولين الذين لهم فلوس ومستحقات',
        },
      },
      required: ['filter_type'],
    },
  },
  {
    name: 'get_pending_subclaims',
    description: 'الاستعلام عن المستخلصات المعلقة أو غير المعتمدة لمقاولي الباطن وتفاصيل مبالغها',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'get_financial_transaction_details',
    description: 'البحث واستخراج تفاصيل أي عملية مالية أو سند صرف أو سند قبض أو فاتورة أو قيد يومية بالرقم أو الاسم أو البيان',
    parameters: {
      type: 'OBJECT',
      properties: {
        search_query: { type: 'STRING', description: 'رقم السند أو الفاتورة أو اسم المورد أو بيان العملية' },
      },
      required: ['search_query'],
    },
  },
  {
    name: 'generate_and_send_worker_statement_pdf',
    description: 'إصدار وتوليد كشف حساب وسجل يوميات وإنتاجية عامل بصيغة PDF وإرساله مباشرة كمستند في التلجرام',
    parameters: {
      type: 'OBJECT',
      properties: {
        worker_name: { type: 'STRING', description: 'اسم العامل المطلوب إصدار الكشف له' },
        start_date: { type: 'STRING', description: 'تاريخ بداية الفترة بصيغة YYYY-MM-DD اختياري' },
        end_date: { type: 'STRING', description: 'تاريخ نهاية الفترة بصيغة YYYY-MM-DD اختياري' },
      },
      required: ['worker_name'],
    },
  },
  {
    name: 'get_site_violations',
    description: 'استعلام عن مخالفات الموقع الهندسية والسلامة المهنية وصور المخالفات والغرامات المسجلة',
    parameters: {
      type: 'OBJECT',
      properties: {
        site_name: { type: 'STRING', description: 'اسم الموقع أو الفيلا اختياري' },
        violation_type: { type: 'STRING', description: 'نوع المخالفة مثل غرامة أو إنذار اختياري' },
      },
    },
  },
  {
    name: 'get_custodies_and_closings',
    description: 'استعلام عن موقف العهد النثرية المفتوحة للمهندسين وإقفال الصناديق اليومية وفروقات النقدية',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'get_inventory_status',
    description: 'استعلام عن أرصدة المخازن والمستودع، الخامات المتاحة، والأصناف التي وصلت لحد الطلب',
    parameters: {
      type: 'OBJECT',
      properties: {
        item_name: { type: 'STRING', description: 'اسم الصنف أو جزء منه مثل أسمنت، حديد، دهانات' },
      },
    },
  },
  {
    name: 'get_vat_and_invoices_summary',
    description: 'استعلام عن فواتير المبيعات الضريبية المصدرة للعملاء وضريبة القيمة المضافة 15% وموقف الإقرار الضريبي',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'get_company_notifications',
    description: 'استعلام عن رادار التنبيهات والوثائق التي قاربت على الانتهاء (إقامات العمال، السجلات، الرخص، الضمانات)',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'get_fixed_assets_summary',
    description: 'استعلام عن أصول الشركة الثابتة ومعداتها والسيارات والآلات وتكلفة الشراء ومجمع الإهلاك والقيمة الدفترية',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
];

const BASE_SYSTEM_PROMPT = `
أنت المساعد الذكي الخبير لمنظومة فاي تك (PHI TECH) لإدارة المشروعات والمقاولات والمحاسبة المالية.
تتحدث باللغة العربية بأسلوب هندسي ومحاسبي محترف وودود وواضح، وتستخدم الإيموجي المناسب لتنسيق إجاباتك.

أنت خبير في:
1. محاسبة المقاولات (القيود المزدوجة المتوازنة، مراكز التكلفة للمشاريع، العهد وتصفيتها، المستخلصات، والمخالفات).
2. إدارة المواقع والمشروعات (المقايسات BOQ، أوامر الشغل، مخططات الشوب دروينج، زيارات فحص الجودة وعلامات الـ Pins، وتوثيق الكاميرا بالـ GPS قبل وبعد).
3. المشتريات ومطابقة التوريد الثلاثي (3-Way Matching بين أوامر الشراء، سندات الاستلام، وفواتير الموردين الضريبية).
4. استخراج الأرقام والإحصائيات الحقيقية من قاعدة بيانات سوبابيز المرفقة بالسياق أدناه بدقة متناهية.

قواعد صارمة:
- التزم دائماً بالقواعد والمعلومات المكتسبة والخاصة بشركة المستخدم الواردة في قسم (دليل المعرفة والذاكرة المكتسبة).
- أجب باختصار وترتيب ودقة.
`;

// Helper to send message to Telegram
async function sendTelegramMessage(chatId, text, replyToMessageId = null) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: text.slice(0, 4000), // Telegram message character limit
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };
    if (replyToMessageId) {
      payload.reply_to_message_id = replyToMessageId;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.error('Telegram send error:', err.message);
  }
}

// Send typing action
async function sendChatAction(chatId, action = 'typing') {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch {}
}

// Call Google Gemini API with smart tool routing
async function processUserPromptWithGemini(userPrompt, chatId) {
  if (!GEMINI_API_KEY) {
    return '⚠️ مفتاح <code>GEMINI_API_KEY</code> غير مضاف في ملف <code>.env.local</code>.';
  }

  const knowledge = loadKnowledgeBase();
  const memoryRules = loadMemory();

  let memoryContext = '';
  if (knowledge) {
    memoryContext += `\n\n📖 دليل المعرفة وقواعد العمل الهندسية والمحاسبية:\n${knowledge}`;
  }
  if (memoryRules.length > 0) {
    memoryContext += `\n\n🧠 القواعد والمعلومات المكتسبة من التدريب المباشر:\n` +
      memoryRules.map((r, i) => `${i + 1}. [${r.topic}] ${r.text}`).join('\n');
  }

  const systemInstructions = `${BASE_SYSTEM_PROMPT}
${memoryContext}
تاريخ اليوم الحالي: ${new Date().toISOString().split('T')[0]}
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

  // Step 1: Call Gemini with Tool Declarations
  const toolCheckBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemInstructions}\n\nطلب المستخدم:\n${userPrompt}` }],
      },
    ],
    tools: [{ function_declarations: FUNCTION_DECLARATIONS }],
    generationConfig: {
      temperature: 0.1,
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toolCheckBody),
      signal: AbortSignal.timeout(15000),
    });

    const json = await res.json();
    const candidate = json.candidates?.[0];
    const functionCall = candidate?.content?.parts?.[0]?.functionCall;

    // If Gemini decided to call a database / PDF tool
    if (functionCall && functionCall.name && typeof copilotTools[functionCall.name] === 'function') {
      console.log(`🔧 [Tool Call]: ${functionCall.name}`, functionCall.args);
      await sendChatAction(chatId, functionCall.name.includes('pdf') ? 'upload_document' : 'typing');

      const toolArgs = { ...functionCall.args, chatId };
      const toolOutput = await copilotTools[functionCall.name](toolArgs);

      // If PDF was generated and sent directly, we synthesize a confirmation message
      if (functionCall.name === 'generate_and_send_worker_statement_pdf') {
        if (toolOutput.success) {
          return `📄 <b>تم إصدار وإرسال كشف حساب العامل (${toolOutput.worker_name}) بصيغة PDF بنجاح إلى المحادثة أعلاه!</b>\n\n📊 <b>ملخص الكشف:</b>\n- عدد السجلات واليوميات: ${toolOutput.records_count} يومية\n- إجمالي الأجر المستحق: <b>${toolOutput.total_wages.toLocaleString()} ر.س</b>\n\nهل تحتاج إلى الاستعلام عن إنتاجية عامل آخر أو مقارنتها بالطريحة؟`;
        } else {
          return `⚠️ تعذر إصدار ملف الـ PDF: ${toolOutput.message || toolOutput.error}`;
        }
      }

      // Step 2: Synthesize the tool result into a rich, structured Arabic engineering report
      const synthesisPrompt = `أنت المساعد الذكي لنظام فاي تك.
المستخدم سأل: "${userPrompt}"
بيانات الاستعلام الحقيقية المستخرجة من قاعدة البيانات:
${JSON.stringify(toolOutput, null, 2)}

قم بصياغة إجابة باللغة العربية بأسلوب هندسي ومحاسبي محترف وواضح، مع إبراز الأرقام والأسماء في نقاط وتوضيح الموقف بدقة مع الإيموجي المناسب.`;

      const synthRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: synthesisPrompt }] }],
          generationConfig: { temperature: 0.25, maxOutputTokens: 1400 },
        }),
      });

      const synthJson = await synthRes.json();
      const answer = synthJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (answer) return answer;
    }

    // Direct response if no tool was required
    const directText = candidate?.content?.parts?.[0]?.text;
    if (directText) return directText;

    if (json.error) {
      return `⚠️ تنبيه من Gemini: ${json.error.message}`;
    }
  } catch (err) {
    console.error('Error in Gemini processing:', err);
    return `⚠️ حدث استثناء أثناء معالجة الطلب: ${err.message}`;
  }

  return 'عذراً، لم أتمكن من صياغة الإجابة بدقة، يرجى إعادة كتابة السؤال بصيغة أخرى.';
}

// Format markdown/plain text to Telegram HTML safe
function toTelegramHtml(text) {
  if (!text) return '';
  let formatted = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  formatted = formatted.replace(/\*(.*?)\*/g, '<i>$1</i>');
  formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');
  formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre>$1</pre>');

  return formatted;
}

// Process incoming Telegram update
async function handleUpdate(update) {
  const msg = update.message || update.channel_post || update.edited_message;
  if (!msg) return;

  const chatId = msg.chat?.id;
  let rawText = (msg.text || msg.caption || '').trim();
  const messageId = msg.message_id;
  const fromName = msg.from?.first_name || msg.chat?.title || 'صديقي';

  // 🎙️ معالجة الرسائل الصوتية (Voice Notes) فورياً عبر Groq Whisper Large V3
  if ((msg.voice || msg.audio) && BOT_TOKEN) {
    const fileId = msg.voice?.file_id || msg.audio?.file_id;
    const groqKey = env.GROQ_API_KEY || process.env.GROQ_API_KEY;

    if (fileId && groqKey) {
      try {
        await sendChatAction(chatId, 'record_voice');
        const fileInfoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
        const fileInfo = await fileInfoRes.json();

        if (fileInfo.ok && fileInfo.result?.file_path) {
          const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.result.file_path}`;
          const audioRes = await fetch(downloadUrl);
          const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

          const whisperForm = new FormData();
          whisperForm.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'telegram_voice.oga');
          whisperForm.append('model', 'whisper-large-v3-turbo');
          whisperForm.append('language', 'ar');

          const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${groqKey}` },
            body: whisperForm,
          });

          const whisperJson = await whisperRes.json();
          if (whisperJson?.text) {
            rawText = whisperJson.text.trim();
            console.log(`🎙️ [Voice Transcribed]: "${rawText}"`);
            await sendTelegramMessage(chatId, `🎙️ <i>سمعتك تقول: "${toTelegramHtml(rawText)}"</i>\n\n⏳ <i>جاري معالجة طلبك...</i>`, messageId);
          }
        }
      } catch (voiceErr) {
        console.error('Voice processing error in Telegram bot:', voiceErr);
      }
    }
  }

  if (!rawText) return;

  console.log(`📩 [${new Date().toLocaleTimeString('ar-SA')}] رسالة من ${fromName} (${chatId}): ${rawText}`);

  try {
    let cleanText = rawText.replace(/@phitechbot/gi, '').trim();

    // 1. أمر البداية والترحيب
    if (cleanText === '/start' || cleanText === '/help') {
      const welcome = `
👋 أهلاً بك يا <b>${fromName}</b>!
أنا <b>المساعد الذكي الاحترافي لمنظومة فاي تك (PHI TECH Copilot)</b> 🤖👷‍♂️.

أنا مدرب على **جميع شاشات وصفحات المنظومة الـ 34** ومتصل لحظياً بقاعدة البيانات الحية:

🏗️ <b>1. المشروعات والميدان والشوب دروينج:</b>
• <i>"إيه مخططات الشوب دروينج لفيلا 105؟"</i>
• <i>"ملاحظات فحص الجودة وعلامات الـ Pins"</i>
• <i>"مقارنة صور الموقع قبل وبعد بالـ GPS"</i>
• <i>"أحدث المخالفات الهندسية وغرامات الموقع"</i>

📊 <b>2. المقايسات وبنود الأعمال والميزانيات:</b>
• <i>"بيانات وميزانية فيلا 105 وهامش ربحها"</i>
• <i>"عدد الفلل نموذج A ومساحته ومواصفاته"</i>
• <i>"بند الخرسانة في كام فيلا وكميته الإجمالية؟"</i>
• <i>"كمية بياض المحارة في فيلا 102 والخامات المستهلكة"</i>

👷 <b>3. العمالة والطريحة وكشوف الحساب:</b>
• <i>"في كام عامل اشتغل النهارده ومجموع أجورهم؟"</i>
• <i>"العمال من تاريخ كذا لتاريخ كذا"</i>
• <i>"مين عجز في الطريحة النهارده ومقدار العجز؟"</i>
• <i>"ابعت كشف حساب العامل فلان بي دي اف من تاريخ كذا لتاريخ كذا"</i> 📄

💼 <b>4. المقاولون والمستخلصات وأوامر الشغل:</b>
• <i>"المقاولين اللي معاهم شغل جاري حالياً"</i>
• <i>"المقاولين اللي ليهم فلوس ومستحقات واجبة السداد"</i>
• <i>"المستخلصات المعلقة ومبالغ الاستقطاعات"</i>

🛒 <b>5. المشتريات والمخازن والصناديق:</b>
• <i>"أوامر الشراء المفتوحة وموقف التوريد"</i>
• <i>"رصيد الأسمنت أو الحديد في المستودع"</i>
• <i>"العهد المفتوحة وإقفال الصناديق اليومية"</i>

💰 <b>6. المالية والضرائب والقوائم الختامية:</b>
• <i>"موقف الإقرار الضريبي وضريبة الـ 15%"</i>
• <i>"ملخص قائمة الدخل وصافي أرباح الشركة"</i>
• <i>"رادار الوثائق والإقامات التي قاربت على الانتهاء"</i>

🧠 <b>أوامر التدريب السريع:</b>
🔹 <code>/train المعلومة</code> أو <code>احفظ عندك أن...</code>
🔹 <code>/memory</code> — لمراجعة ذاكرة القواعد.
🔹 <code>/reload</code> — لقراءة ملف السيناريوهات والدليل المحدث.
`;
      await sendTelegramMessage(chatId, welcome, messageId);
      return;
    }

    // 2. أمر تدريب البوت
    if (cleanText.startsWith('/train') || cleanText.startsWith('/learn')) {
      const ruleText = cleanText.replace(/^\/(train|learn)\s*/i, '').trim();
      if (!ruleText) {
        await sendTelegramMessage(
          chatId,
          '⚠️ يرجى كتابة المعلومة بعد الأمر، مثلاً:\n<code>/train طريحة بياض المحارة المعتمدة للفيلا هي 25 م² يومياً</code>',
          messageId
        );
        return;
      }
      const saved = saveRuleToMemory(ruleText, 'تدريب مباشر من المحادثة');
      if (saved) {
        await sendTelegramMessage(
          chatId,
          `✅ <b>تم التدريب والحفظ بنجاح!</b> 🧠\n\n📌 <b>القاعدة الجديدة (#${saved.id}):</b>\n"${toTelegramHtml(saved.text)}"\n\n<i>سألتزم بهذه القاعدة وأضعها في اعتباري في جميع الإجابات القادمة.</i>`,
          messageId
        );
      }
      return;
    }

    // 3. عرض الذاكرة
    if (cleanText === '/memory' || cleanText === '/rules') {
      const rules = loadMemory();
      if (rules.length === 0) {
        await sendTelegramMessage(chatId, '📭 الذاكرة المكتسبة فارغة حالياً. اكتب <code>/train المعلومة</code> لتدريبي.', messageId);
        return;
      }
      let memText = `🧠 <b>القواعد والمعلومات المكتسبة من التدريب (${rules.length}):</b>\n\n`;
      rules.forEach((r, idx) => {
        memText += `<b>${idx + 1}.</b> ${toTelegramHtml(r.text)}\n`;
      });
      memText += `\n💡 <i>لحذف أي قاعدة اكتب: <code>/forget رقم_القاعدة</code></i>`;
      await sendTelegramMessage(chatId, memText, messageId);
      return;
    }

    // 4. حذف قاعدة
    if (cleanText.startsWith('/forget')) {
      const target = cleanText.replace(/^\/forget\s*/i, '').trim();
      const ok = deleteRuleFromMemory(target);
      if (ok) {
        await sendTelegramMessage(chatId, `🗑️ تم مسح القاعدة بنجاح من الذاكرة.`, messageId);
      } else {
        await sendTelegramMessage(chatId, `⚠️ لم يتم العثور على قاعدة برقم: ${target}`, messageId);
      }
      return;
    }

    // 5. إعادة تحميل دليل المعرفة
    if (cleanText === '/reload') {
      const k = loadKnowledgeBase();
      const m = loadMemory();
      await sendTelegramMessage(
        chatId,
        `🔄 تم تحديث وقراءة ملف المعرفة بنجاح!\n📖 حجم دليل المعرفة: ${k.length} حرف\n🧠 عدد القواعد المكتسبة: ${m.length} قاعدة`,
        messageId
      );
      return;
    }

    // 6. عبارات التعلم الطبيعي
    const naturalLearnMatch = cleanText.match(/^(?:احفظ عندك|تعلم أن|خليك عارف إن|سجل عندك|قاعدة جديدة)\s*[:،,-]?\s*(.+)$/i);
    if (naturalLearnMatch && naturalLearnMatch[1]) {
      const learned = naturalLearnMatch[1].trim();
      const saved = saveRuleToMemory(learned, 'تعلم تلقائي من المحادثة');
      if (saved) {
        await sendTelegramMessage(
          chatId,
          `✅ <b>فهمت وحفظت هذه القاعدة فوراً!</b> 🧠\n\n📌 "${toTelegramHtml(saved.text)}"\n\n<i>تمت إضافتها لذاكرتي الدائمة، وسأعتمدها في كل حساباتي وردودي.</i>`,
          messageId
        );
        return;
      }
    }

    await sendChatAction(chatId, 'typing');

    // إزالة بادئة /ask إن وجدت
    if (cleanText.startsWith('/ask')) {
      cleanText = cleanText.replace(/^\/ask\s*/i, '').trim();
    }

    if (!cleanText) {
      cleanText = rawText;
    }

    // 7. المعالجة الذكية بالذكاء الاصطناعي واستدعاء الأدوات الحية
    const aiReply = await processUserPromptWithGemini(cleanText, chatId);
    const formattedReply = toTelegramHtml(aiReply);

    await sendTelegramMessage(chatId, formattedReply, messageId);
    console.log(`✅ [${new Date().toLocaleTimeString('ar-SA')}] تم إرسال الرد بنجاح إلى ${fromName}`);
  } catch (err) {
    console.error('Error handling message:', err);
    await sendTelegramMessage(chatId, `⚠️ حدث استثناء أثناء معالجة السؤال: ${err.message}`, messageId);
  }
}

// Long-polling loop
let offset = 0;
let isPolling = true;

async function pollUpdates() {
  console.log('📡 بدء الاستماع المباشر لرسائل تيليجرام (Long Polling)...');
  while (isPolling) {
    try {
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=25`;
      const res = await fetch(url, { signal: AbortSignal.timeout(35000) });
      const data = await res.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          await handleUpdate(update);
        }
      } else if (!data.ok) {
        console.warn('Telegram poll notice:', data.description || data);
        await new Promise((r) => setTimeout(r, 4000));
      }
    } catch (err) {
      if (err.name !== 'TimeoutError') {
        console.warn('Telegram poll loop notice:', err.message);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

process.on('SIGINT', () => {
  console.log('Stopping bot...');
  isPolling = false;
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Stopping bot...');
  isPolling = false;
  process.exit(0);
});

pollUpdates();
