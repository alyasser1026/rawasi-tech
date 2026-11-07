import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const MEMORY_FILE = path.join(rootDir, 'config', 'copilot_learned_memory.json');
const KNOWLEDGE_DOCS_DIR = path.join(rootDir, 'knowledge_docs');

// Ensure knowledge directory exists
if (!fs.existsSync(KNOWLEDGE_DOCS_DIR)) {
  fs.mkdirSync(KNOWLEDGE_DOCS_DIR, { recursive: true });
}

/**
 * Loads all learned rules from copilot_learned_memory.json
 */
export function getLearnedRules() {
  try {
    if (!fs.existsSync(MEMORY_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(MEMORY_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.rules) ? data.rules : [];
  } catch (err) {
    console.warn('Could not read learned memory:', err.message);
    return [];
  }
}

/**
 * Adds a new learned rule to the bot's permanent memory
 */
export function addLearnedRule(ruleText, author = 'المستخدم', topic = 'تفضيلات وقواعد عامة') {
  const cleanRule = String(ruleText || '').trim();
  if (!cleanRule || cleanRule.length < 5) return null;

  try {
    const rules = getLearnedRules();
    // Avoid exact duplicates
    const exists = rules.some(r => r.rule.toLowerCase() === cleanRule.toLowerCase());
    if (exists) return { alreadyExists: true, rule: cleanRule };

    const newEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      topic,
      rule: cleanRule,
      author,
      createdAt: new Date().toISOString(),
    };

    rules.push(newEntry);

    // Keep max 200 high-priority active rules
    const trimmedRules = rules.slice(-200);

    fs.writeFileSync(MEMORY_FILE, JSON.stringify({
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      rules: trimmedRules,
    }, null, 2), 'utf8');

    return { success: true, entry: newEntry };
  } catch (err) {
    console.error('Error saving learned rule:', err);
    return null;
  }
}

/**
 * Loads all documents placed inside `knowledge_docs/` (.md, .txt, .json, .csv)
 */
export function loadCustomKnowledgeDocs() {
  if (!fs.existsSync(KNOWLEDGE_DOCS_DIR)) return '';

  let combined = '';
  try {
    const files = fs.readdirSync(KNOWLEDGE_DOCS_DIR);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (['.md', '.txt', '.json', '.csv'].includes(ext)) {
        const fullPath = path.join(KNOWLEDGE_DOCS_DIR, file);
        const stat = fs.statSync(fullPath);
        // Limit max file size to 500KB to avoid memory blowup
        if (stat.size <= 500 * 1024) {
          const content = fs.readFileSync(fullPath, 'utf8').trim();
          if (content) {
            combined += `\n\n### 📄 مستند تدريبي [${file}]:\n${content}\n`;
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error reading knowledge_docs directory:', err.message);
  }
  return combined;
}

/**
 * Formats learned rules as a markdown block for Gemini system prompt
 */
export function formatLearnedRulesForPrompt() {
  const rules = getLearnedRules();
  const customDocs = loadCustomKnowledgeDocs();

  let output = '';

  if (rules.length > 0) {
    output += `\n\n## 🧠 القواعد والمعلومات التي تعلمها المساعد ذاتياً من المستخدمين:\n` +
      rules.map((r, idx) => `${idx + 1}. [${r.topic || 'قاعدة'}] ${r.rule}`).join('\n') + '\n';
  }

  if (customDocs) {
    output += `\n\n## 📚 مستندات المعرفة التخصصية والملفات التدريبية الإضافية:\n${customDocs}\n`;
  }

  return output;
}

/**
 * Detects if the user prompt is intentionally teaching the bot a new rule or preference
 */
export function detectAutoLearningTrigger(text) {
  const t = String(text || '').trim();
  
  // Patterns like:
  // "احفظ عندك: فيلا 10 تابعة لمشروع الياسمين"
  // "قاعدة: مورد الأسمنت الأساسي هو لافارج"
  // "افتكر ان: المهندس أحمد هو المسؤول عن فيلا 5"
  // "خلي في بالك دايما ان نسبة الهالك 5%"
  const match = t.match(/^(?:احفظ\s*عندك|خلّي\s*في\s*بالك|خلي\s*في\s*بالك|اتعلم\s*ان|قاعدة|قاعده|افتكر\s*ان|تذكر\s*ان|دايما\s*اعتبر\s*ان)\s*[:،,-]?\s*(.+)$/i);
  if (match && match[1]?.trim().length >= 6) {
    return match[1].trim();
  }

  return null;
}
