import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
      const key = trimmed.slice(0, eqIdx).trim();
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
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!BOT_TOKEN) {
  console.error('❌ خطأ: TELEGRAM_BOT_TOKEN غير موجود في ملف .env.local');
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.warn('⚠️ تحذير: GEMINI_API_KEY غير موجود في .env.local.');
}

console.log('🤖 بدء تشغيل المساعد الذكي لنظام فاي تك (PHI TECH Telegram Copilot)...');

const KNOWLEDGE_PATH = path.join(rootDir, 'config', 'copilot_knowledge.md');
const MEMORY_PATH = path.join(rootDir, 'config', 'copilot_memory.json');

// 📚 تحميل دليل المعرفة الثابت من الملف
function loadKnowledgeBase() {
  try {
    if (fs.existsSync(KNOWLEDGE_PATH)) {
      return fs.readFileSync(KNOWLEDGE_PATH, 'utf8').trim();
    }
  } catch (err) {
    console.error('Error loading knowledge base:', err.message);
  }
  return '';
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

// 🧹 تصفير الذاكرة المكتسبة
function clearAllMemory() {
  try {
    const payload = {
      last_updated: new Date().toISOString(),
      rules: [],
    };
    fs.writeFileSync(MEMORY_PATH, JSON.stringify(payload, null, 2), 'utf8');
    return true;
  } catch (err) {
    return false;
  }
}

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

// Fetch live database context from Supabase (REST API)
async function fetchDatabaseSummary() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return 'قاعدة البيانات غير متصلة مباشرة.';
  try {
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    };

    const [projRes, visitsRes, custRes, posRes, expRes, partRes] = await Promise.allSettled([
      fetch(`${SUPABASE_URL}/rest/v1/projects?select=id,Property,status,client_name&limit=15`, { headers }).then((r) => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/project_site_visits?select=title,stage,status,visit_date,inspector_name&order=created_at.desc&limit=10`, { headers }).then((r) => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/site_custodies?select=title,disbursed_amount,spent_amount,remaining_amount,status&limit=10`, { headers }).then((r) => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/purchase_orders?select=po_number,total_amount,status&order=created_at.desc&limit=10`, { headers }).then((r) => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/expenses?select=description,total_price,exp_date,is_posted&order=created_at.desc&limit=8`, { headers }).then((r) => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/partners?select=name,partner_type,phone&limit=10`, { headers }).then((r) => r.json()),
    ]);

    let summary = '📊 ملخص البيانات الحالية في النظام:\n';
    if (projRes.status === 'fulfilled' && Array.isArray(projRes.value)) {
      summary += `\n🏢 المشاريع (${projRes.value.length}):\n` +
        projRes.value.map((p) => `- ${p.Property || 'بدون اسم'} (الحالة: ${p.status || 'قيد التنفيذ'})`).join('\n');
    }
    if (visitsRes.status === 'fulfilled' && Array.isArray(visitsRes.value)) {
      summary += `\n\n📐 أحدث ملاحظات وزيارات الموقع:\n` +
        visitsRes.value.map((v) => `- ${v.title} (${v.stage || 'عام'} - الحالة: ${v.status} - بتاريخ ${v.visit_date})`).join('\n');
    }
    if (custRes.status === 'fulfilled' && Array.isArray(custRes.value)) {
      summary += `\n\n💼 العُهد المفتوحة:\n` +
        custRes.value.map((c) => `- ${c.title} (المتبقي: ${c.remaining_amount || 0} ر.س - الحالة: ${c.status})`).join('\n');
    }
    if (posRes.status === 'fulfilled' && Array.isArray(posRes.value)) {
      summary += `\n\n🛒 أحدث أوامر الشراء:\n` +
        posRes.value.map((o) => `- ${o.po_number} (الإجمالي: ${o.total_amount} ر.س - الحالة: ${o.status})`).join('\n');
    }
    if (expRes.status === 'fulfilled' && Array.isArray(expRes.value)) {
      summary += `\n\n💸 أحدث المصروفات المسجلة:\n` +
        expRes.value.map((e) => `- ${e.description} (${Number(e.total_price || 0).toLocaleString()} ر.س - بتاريخ ${e.exp_date})`).join('\n');
    }
    if (partRes.status === 'fulfilled' && Array.isArray(partRes.value)) {
      summary += `\n\n🤝 الشركاء والموردين:\n` +
        partRes.value.map((pt) => `- ${pt.name} (${pt.partner_type || 'مورد/مقاول'})`).join('\n');
    }

    return summary;
  } catch (err) {
    return 'تعذر جلب تفاصيل البيانات: ' + err.message;
  }
}

// Call Google Gemini API
async function askGemini(userPrompt, dbContext) {
  if (!GEMINI_API_KEY) {
    return '⚠️ مفتاح <code>GEMINI_API_KEY</code> غير مضاف في ملف <code>.env.local</code>.\nيرجى إضافته لتفعيل ردود الذكاء الاصطناعي الذكية.';
  }

  const knowledge = loadKnowledgeBase();
  const memoryRules = loadMemory();

  let memoryContext = '';
  if (knowledge) {
    memoryContext += `\n\n📖 دليل المعرفة وقواعد العمل الرسمية للشركة:\n${knowledge}`;
  }
  if (memoryRules.length > 0) {
    memoryContext += `\n\n🧠 القواعد والمعلومات المكتسبة من التدريب:\n` +
      memoryRules.map((r, i) => `${i + 1}. [${r.topic}] ${r.text}`).join('\n');
  }

  const fullPrompt = `${BASE_SYSTEM_PROMPT}
${memoryContext}

بيانات النظام وقاعدة البيانات الحالية:
${dbContext}

سؤال المستخدم:
${userPrompt}`;

  const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const body = {
        contents: [
          {
            role: 'user',
            parts: [{ text: fullPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 1400,
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      const json = await res.json();
      if (res.ok && json.candidates?.[0]?.content?.parts?.[0]?.text) {
        return json.candidates[0].content.parts[0].text;
      }
      lastError = json.error?.message || 'Gemini response error';
    } catch (err) {
      lastError = err.message;
    }
  }

  return `عذراً، حدث خطأ أثناء الاتصال بمحرك Gemini: ${lastError}`;
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
  const rawText = (msg.text || msg.caption || '').trim();
  const messageId = msg.message_id;
  const fromName = msg.from?.first_name || msg.chat?.title || 'صديقي';

  if (!rawText) return;

  console.log(`📩 [${new Date().toLocaleTimeString('ar-SA')}] رسالة من ${fromName} (${chatId}): ${rawText}`);

  try {
    // Strip bot username mention if mentioned in group
    let cleanText = rawText.replace(/@phitechbot/gi, '').trim();

    // 1. أمر البداية والمساعدة
    if (cleanText === '/start' || cleanText === '/help') {
      const welcome = `
👋 أهلاً بك يا <b>${fromName}</b>!
أنا <b>المساعد الذكي لمنظومة فاي تك (PHI TECH Copilot)</b> 🤖.

يمكنك محادثتي وتدريبي هنا في أي وقت وكأنك داخل بيئة العمل تماماً:

🧠 <b>أوامر التدريب والذاكرة:</b>
🔹 <code>/train المعلومة</code> أو <code>/learn المعلومة</code> — لتدريبي على قاعدة أو معلومة جديدة.
🔹 <code>/memory</code> — لعرض كل القواعد والمعلومات التي درّبتني عليها.
🔹 <code>/forget رقم_القاعدة</code> — لمسح معلومة معينة.
🔹 <code>/reload</code> — لإعادة قراءة ملف المعرفة <code>config/copilot_knowledge.md</code>.

📊 <b>أوامر الاستعلام عن البيانات:</b>
🔹 <code>/projects</code> — لعرض ملخص فوري بالمشاريع وحالاتها.
🔹 <code>/visits</code> — لعرض أحدث زيارات وملاحظات الشوب دروينج.
🔹 <code>/custodies</code> — لعرض العُهد المفتوحة ومتبقياتها.
🔹 <code>/pos</code> — لعرض أحدث أوامر الشراء وموقف التوريد.

💡 <i>يمكنك أيضاً تدريبي مباشرة بالكلام العادي، مثلاً: "احفظ عندك أن مهندس الموقع هو م. أحمد وله صلاحية اعتماد الصرف حتى 10 آلاف".</i>
`;
      await sendTelegramMessage(chatId, welcome, messageId);
      return;
    }

    // 2. أمر تدريب البوت عبر /train أو /learn
    if (cleanText.startsWith('/train') || cleanText.startsWith('/learn')) {
      const ruleText = cleanText.replace(/^\/(train|learn)\s*/i, '').trim();
      if (!ruleText) {
        await sendTelegramMessage(
          chatId,
          '⚠️ يرجى كتابة المعلومة بعد الأمر، مثلاً:\n<code>/train الحد الأقصى للمصروفات النثرية بدون موافقة هو 3000 ريال</code>',
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
      } else {
        await sendTelegramMessage(chatId, '❌ تعذر حفظ المعلومة في ملف الذاكرة.', messageId);
      }
      return;
    }

    // 3. أمر عرض الذاكرة والقواعد المكتسبة
    if (cleanText === '/memory' || cleanText === '/rules') {
      const rules = loadMemory();
      if (rules.length === 0) {
        await sendTelegramMessage(
          chatId,
          '📭 الذاكرة المكتسبة فارغة حالياً.\nيمكنك تدريبي بكتابة: <code>/train المعلومة</code> أو في ملف <code>config/copilot_knowledge.md</code>.',
          messageId
        );
        return;
      }
      let memText = `🧠 <b>القواعد والمعلومات التي تم تدريبي عليها (${rules.length}):</b>\n\n`;
      rules.forEach((r, idx) => {
        memText += `<b>${idx + 1}.</b> ${toTelegramHtml(r.text)}\n`;
      });
      memText += `\n💡 <i>لحذف أي قاعدة اكتب: <code>/forget رقم_القاعدة</code></i>`;
      await sendTelegramMessage(chatId, memText, messageId);
      return;
    }

    // 4. أمر مسح قاعدة معينة
    if (cleanText.startsWith('/forget')) {
      const target = cleanText.replace(/^\/forget\s*/i, '').trim();
      if (!target) {
        await sendTelegramMessage(chatId, 'يرجى تحديد رقم القاعدة لمسحها، مثلاً: <code>/forget 1</code>', messageId);
        return;
      }
      const ok = deleteRuleFromMemory(target);
      if (ok) {
        await sendTelegramMessage(chatId, `🗑️ تم مسح القاعدة بنجاح وتحديث الذاكرة.`, messageId);
      } else {
        await sendTelegramMessage(chatId, `⚠️ لم يتم العثور على قاعدة برقم أو نص: ${target}`, messageId);
      }
      return;
    }

    // 5. أمر إعادة تحميل ملف المعرفة
    if (cleanText === '/reload') {
      const k = loadKnowledgeBase();
      const m = loadMemory();
      await sendTelegramMessage(
        chatId,
        `🔄 تم إعادة تحميل الذاكرة بنجاح!\n📖 حجم دليل المعرفة: ${k.length} حرف\n🧠 عدد القواعد المكتسبة: ${m.length} قاعدة`,
        messageId
      );
      return;
    }

    // 6. التحقق من العبارات التلقائية للتعلم الطبيعي (مثلاً: "احفظ عندك أن..." أو "تعلم أن...")
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

    // 7. أوامر سريعة للاستعلام
    if (cleanText.startsWith('/projects')) {
      const dbSummary = await fetchDatabaseSummary();
      await sendTelegramMessage(chatId, toTelegramHtml(dbSummary), messageId);
      return;
    }

    // إزالة بادئة /ask إن وجدت
    if (cleanText.startsWith('/ask')) {
      cleanText = cleanText.replace(/^\/ask\s*/i, '').trim();
    }

    if (!cleanText) {
      cleanText = rawText;
    }

    // 8. الإجابة الذكية عبر Gemini بالاعتماد على الذاكرة وقاعدة البيانات
    const dbContext = await fetchDatabaseSummary();
    const aiReply = await askGemini(cleanText, dbContext);
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

// Handle termination gracefully
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
