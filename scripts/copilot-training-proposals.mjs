import { randomUUID } from 'node:crypto';
import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { normalizeTelegramChatId } from './copilot-telegram-auth.mjs';

const FORMAT_VERSION = 1;
const MAX_PROPOSALS = 100;
const MAX_TEXT_LENGTH = 2000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const UUID = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const CONTROL_CHARACTER = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;
const CREDENTIAL_FORMAT = /\b(?:sk-[\w-]{16,}|gsk_[\w-]{24,}|sb_secret_[\w-]{20,}|AIza[\w-]{30,}|gh[pousr]_[\w-]{18,}|eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}|\d{5,}:[\w-]{20,})\b/u;
const CREDENTIAL_ASSIGNMENT = /(?:\b(?:password|passwd|secret|(?:[A-Z0-9]+_)*(?:api[_ ]?key|access[_ ]?token|bot[_ ]?token|service[_ ]?role[_ ]?key))\b|كلمة\s*(?:المرور|السر)|رمز\s*التحقق)\s*(?:=|:|(?:هو|هي)\s+)\s*["']?[^\s"']{3,}|\bbearer\s+[\w.-]{12,}/iu;

function queueError(code, message) {
  return Object.assign(new Error(message), { code });
}

function normalizeOwner(telegramUserId) {
  const id = normalizeTelegramChatId(telegramUserId);
  if (id === null) {
    throw queueError('COPILOT_PROPOSAL_INVALID_USER', 'يلزم حساب تيليجرام متحقق منه لإدارة مقترحات التدريب.');
  }
  return String(id);
}

function normalizeCompany(companyId) {
  if (companyId === null || companyId === undefined) return null;
  if (typeof companyId !== 'string' || !UUID.test(companyId)) {
    throw queueError('COPILOT_PROPOSAL_INVALID_COMPANY', 'تعذّر تحديد الشركة لمقترح التدريب.');
  }
  return companyId.toLowerCase();
}

function normalizeText(text) {
  if (typeof text !== 'string' || CONTROL_CHARACTER.test(text)) {
    throw queueError('COPILOT_PROPOSAL_INVALID_TEXT', 'أدخل نصًا عاديًا لمقترح التدريب.');
  }
  const cleaned = text.trim();
  if (cleaned.length === 0 || cleaned.length > MAX_TEXT_LENGTH) {
    throw queueError('COPILOT_PROPOSAL_INVALID_TEXT', 'اكتب مقترحًا من حرف واحد إلى 2000 حرف.');
  }
  if (CREDENTIAL_FORMAT.test(cleaned) || CREDENTIAL_ASSIGNMENT.test(cleaned)) {
    throw queueError('COPILOT_PROPOSAL_SENSITIVE_TEXT', 'احذف بيانات الدخول والمفاتيح من المقترح ثم أرسله مجددًا.');
  }
  return cleaned;
}

function isPendingRecord(record) {
  return record !== null && typeof record === 'object'
    && typeof record.id === 'string' && UUID.test(record.id)
    && record.status === 'pending' && record.source === 'telegram'
    && typeof record.telegramUserId === 'string' && normalizeOwner(record.telegramUserId) === record.telegramUserId
    && normalizeCompany(record.companyId) === record.companyId
    && typeof record.createdAt === 'string' && Number.isFinite(Date.parse(record.createdAt))
    && normalizeText(record.text) === record.text;
}

function storageError() {
  return queueError('COPILOT_PROPOSAL_STORAGE', 'تعذّر الوصول إلى قائمة مقترحات التدريب. حاول لاحقًا.');
}

/** Local pending queue for one bot worker. Proposals are never loaded as model instructions. */
export function createCopilotTrainingProposals(filePath) {
  const target = resolve(filePath);
  const directory = dirname(target);

  function readQueue() {
    try {
      const stats = lstatSync(target);
      if (!stats.isFile() || stats.size > MAX_FILE_BYTES) throw storageError();
      const data = JSON.parse(readFileSync(target, 'utf8'));
      if (data?.version !== FORMAT_VERSION || !Array.isArray(data.proposals)
        || data.proposals.length > MAX_PROPOSALS || !data.proposals.every(isPendingRecord)) {
        throw storageError();
      }
      return data.proposals;
    } catch (error) {
      if (error?.code === 'ENOENT') return [];
      throw storageError();
    }
  }

  function writeQueue(proposals) {
    const temporary = target + '.' + randomUUID() + '.tmp';
    let created = false;
    try {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const fd = openSync(temporary, 'wx', 0o600);
      created = true;
      try {
        writeFileSync(fd, JSON.stringify({ version: FORMAT_VERSION, proposals }, null, 2) + '\n', 'utf8');
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      renameSync(temporary, target);
      created = false;
    } catch {
      throw storageError();
    } finally {
      if (created) {
        try { unlinkSync(temporary); } catch {}
      }
    }
  }

  return {
    list(telegramUserId) {
      const owner = normalizeOwner(telegramUserId);
      return readQueue().filter((proposal) => proposal.telegramUserId === owner);
    },

    submit(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw queueError('COPILOT_PROPOSAL_INVALID_TEXT', 'أدخل نصًا عاديًا لمقترح التدريب.');
      }
      const { text, telegramUserId, companyId = null } = input;
      const owner = normalizeOwner(telegramUserId);
      const normalizedCompany = normalizeCompany(companyId);
      const cleaned = normalizeText(text);
      const proposals = readQueue();
      if (proposals.length >= MAX_PROPOSALS) {
        throw queueError('COPILOT_PROPOSAL_QUEUE_FULL', 'قائمة مقترحات التدريب ممتلئة. اسحب مقترحًا قديمًا أو انتظر المراجعة.');
      }

      const proposal = {
        id: randomUUID(),
        text: cleaned,
        telegramUserId: owner,
        companyId: normalizedCompany,
        status: 'pending',
        source: 'telegram',
        createdAt: new Date().toISOString(),
      };
      writeQueue([proposal, ...proposals]);
      return proposal;
    },

    withdraw(id, telegramUserId) {
      const owner = normalizeOwner(telegramUserId);
      if (typeof id !== 'string' || !UUID.test(id)) return false;
      const proposals = readQueue();
      const remaining = proposals.filter((proposal) => proposal.id !== id || proposal.telegramUserId !== owner);
      if (remaining.length === proposals.length) return false;
      writeQueue(remaining);
      return true;
    },
  };
}
