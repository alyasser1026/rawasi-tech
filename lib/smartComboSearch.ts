/**
 * Pure search, Arabic normalization, coarse Supabase OR-filter generation,
 * and client-side relevance ranking helpers for `SmartCombo`.
 *
 * Framework-agnostic so both UI components and Node unit tests share one source of truth.
 */

export interface SmartComboFilterSpec {
  query?: string;
  searchCols?: string;
  displayCol?: string;
  displayFormat?: (item: any) => string;
  customFilter?: string;
  filterColumn?: string;
  filterValue?: any;
  table?: string;
  maxResults?: number;
}

export interface EffectiveQuerySpec {
  query: string;
  isUserTyping: boolean;
  lastSelected?: any;
  initialDisplay?: string | null;
  displayCol?: string;
  displayFormat?: (item: any) => string;
}

const ARABIC_DIACRITICS_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const PURE_PUNCTUATION_RE = /^[\s/\\|•·.,:;()[\]{}\-_+*=?!'"«»]+$/;
const TRIM_EDGE_PUNCT_RE = /^[()[\]{},.;:«»'"]+|[()[\]{},.;:«»'"]+$/g;
const NATURAL_COLLATOR = new Intl.Collator('ar', { numeric: true, sensitivity: 'base' });

/**
 * Normalizes Arabic and Latin text for tolerant search comparison.
 * Unifies alef forms (`أإآٱ` -> `ا`), taa marbuta (`ة` -> `ه`), alef maksura /
 * hamza-yaa (`ىئ` -> `ي`), `ؤ` -> `و`, `ڤ` -> `ف`, converts Arabic-Indic
 * digits to ASCII `0-9`, strips diacritics/tatweel, and collapses whitespace.
 */
export function normalizeComboText(text: unknown): string {
  return String(text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(ARABIC_DIACRITICS_RE, '')
    .replace(/[\u0660-\u0669]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48))
    .replace(/[\u06F0-\u06F9]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x06F0 + 48))
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىئ]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ڤ/g, 'ف')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits a search query into normalized tokens so multi-word queries like
 * `"سقف الرابع"` match `"سقف فلات الدور الرابع"` without failing on punctuation.
 */
export function tokenizeComboQuery(query: unknown): string[] {
  const norm = normalizeComboText(query);
  if (!norm) return [];

  const rawParts = norm.split(/\s+/).filter(Boolean);
  const cleaned = rawParts
    .map((part) => (PURE_PUNCTUATION_RE.test(part) ? '' : part.replace(TRIM_EDGE_PUNCT_RE, '')))
    .filter(Boolean);

  if (cleaned.length > 0) {
    return Array.from(new Set(cleaned));
  }
  return Array.from(new Set(rawParts));
}

/**
 * Converts a single query token into a PostgREST `ilike` wildcard pattern that
 * tolerates Arabic orthography differences (`أ/إ/آ/ا`, `ة/ه`, `ى/ي/ئ`, `ڤ/ف`) via `_`
 * only when sufficient anchor characters remain, and strips PostgREST delimiter chars.
 */
export function toSqlWildcardToken(token: string): string {
  const cleaned = String(token || '')
    .normalize('NFKC')
    .replace(ARABIC_DIACRITICS_RE, '')
    .replace(/[\u0660-\u0669]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48))
    .replace(/[\u06F0-\u06F9]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x06F0 + 48))
    .replace(/[,()*%"'\\]+/g, '')
    .trim();

  if (!cleaned) return '';
  if (cleaned.length === 1) return cleaned;

  const tier1 = cleaned.replace(/[أإآٱا]/g, '_').replace(/[ةه]/g, '_');
  const tier1Fixed = tier1.replace(/_/g, '').length;

  const tier2 = tier1.replace(/[ىيئ]/g, '_').replace(/[ڤف]/g, '_');
  const tier2Fixed = tier2.replace(/_/g, '').length;

  if (cleaned.length >= 4 ? tier2Fixed >= 2 : tier2Fixed >= 1 && cleaned.length >= 3) {
    return tier2;
  }
  if (cleaned.length >= 3 ? tier1Fixed >= 2 : tier1Fixed >= 1) {
    return tier1;
  }
  return cleaned;
}

/**
 * Builds up to 4 per-token PostgREST `.or(...)` clauses so multiple query words
 * are combined with SQL logical AND across the searchable columns.
 */
export function buildSupabaseTokenOrQueries(searchCols: string, query: string): string[] {
  const cols = searchCols
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  if (cols.length === 0) return [];

  const tokens = tokenizeComboQuery(query);
  if (tokens.length === 0) return [];

  const prioritized = [...tokens]
    .sort((a, b) => b.length - a.length)
    .slice(0, 4);

  const clauses: string[] = [];
  for (const tok of prioritized) {
    const pattern = toSqlWildcardToken(tok);
    if (!pattern) continue;
    clauses.push(cols.map((col) => `${col}.ilike.%${pattern}%`).join(','));
  }
  return clauses;
}

/**
 * Returns the primary display label for an option or row.
 */
export function getComboItemLabel(
  item: any,
  displayCol = 'name',
  displayFormat?: (item: any) => string
): string {
  if (item === null || item === undefined) return '';
  if (typeof item !== 'object') return String(item);
  if (displayFormat) {
    try {
      const formatted = displayFormat(item);
      if (formatted !== undefined && formatted !== null && formatted !== '') {
        return String(formatted);
      }
    } catch {
      // Fall back cleanly if custom displayFormat fails on partial objects.
    }
  }
  return String(
    item[displayCol] ||
      item.Property ||
      item.project_name ||
      item.item_name ||
      item.name ||
      item.description ||
      ''
  );
}

/**
 * Returns the code field for an option/row if present.
 */
export function getComboItemCode(item: any): string {
  if (!item || typeof item !== 'object') return '';
  return String(item.project_code || item.item_code || item.code || '');
}

/**
 * Determines the query string sent to search APIs.
 * Active typing (`isUserTyping: true`) ALWAYS preserves `query` so `freeText` parents
 * echoing `initialDisplay` never wipe out the live search term.
 */
export function resolveComboEffectiveQuery({
  query,
  isUserTyping,
  lastSelected,
  initialDisplay,
  displayCol = 'name',
  displayFormat,
}: EffectiveQuerySpec): string {
  if (isUserTyping || !query) return query;

  const matchesLastSelected =
    lastSelected !== undefined &&
    lastSelected !== null &&
    (typeof lastSelected !== 'object'
      ? String(lastSelected) === query
      : (displayFormat && displayFormat(lastSelected) === query) ||
        lastSelected[displayCol] === query ||
        lastSelected.name === query ||
        lastSelected.Property === query);

  const matchesInitialDisplay =
    initialDisplay !== undefined &&
    initialDisplay !== null &&
    initialDisplay !== '' &&
    String(initialDisplay) === query;

  return matchesLastSelected || matchesInitialDisplay ? '' : query;
}

function matchesCustomFilter(row: any, customFilter?: string): boolean {
  if (!customFilter) return true;
  const match = /^([^=]+)=([a-z]+)\.(.*)$/.exec(customFilter);
  if (!match) return true;
  const [, col, op, val] = match;
  if (op === 'eq') return String(row[col]) === val;
  if (op === 'neq') return String(row[col]) !== val;
  if (op === 'ilike') {
    const needle = normalizeComboText(val.replace(/%/g, ''));
    return normalizeComboText(row[col]).includes(needle);
  }
  return true;
}

function computeRelevanceTier(
  item: any,
  normFullQuery: string,
  tokens: string[],
  cols: string[],
  displayCol: string,
  displayFormat?: (item: any) => string
): number | null {
  const isObj = item !== null && typeof item === 'object';
  const primaryText = normalizeComboText(getComboItemLabel(item, displayCol, displayFormat));
  const codeText = normalizeComboText(getComboItemCode(item));
  const rawDisplay = isObj
    ? normalizeComboText(item[displayCol] || item.item_name || item.Property || item.name || item.description || '')
    : primaryText;

  const colTexts = isObj
    ? cols.map((col) => normalizeComboText(item[col])).filter(Boolean)
    : [];

  const allFieldTexts = Array.from(new Set([primaryText, rawDisplay, codeText, ...colTexts].filter(Boolean)));
  if (allFieldTexts.length === 0) return null;

  const allTokensMatch = tokens.every((tok) => allFieldTexts.some((txt) => txt.includes(tok)));
  if (!allTokensMatch) return null;

  if (primaryText === normFullQuery || rawDisplay === normFullQuery || (codeText && codeText === normFullQuery)) {
    return 0;
  }
  if (codeText && codeText.startsWith(normFullQuery)) {
    return 1;
  }
  if (primaryText.startsWith(normFullQuery) || rawDisplay.startsWith(normFullQuery)) {
    return 2;
  }
  if (
    primaryText.includes(normFullQuery) ||
    rawDisplay.includes(normFullQuery) ||
    (codeText && codeText.includes(normFullQuery))
  ) {
    return 3;
  }
  if (tokens.every((tok) => primaryText.includes(tok) || rawDisplay.includes(tok) || codeText.includes(tok))) {
    return primaryText.startsWith(tokens[0]) || rawDisplay.startsWith(tokens[0]) ? 4 : 5;
  }
  if (colTexts.some((txt) => txt.includes(normFullQuery))) {
    return 6;
  }
  return 7;
}

/**
 * Filters rows/options using normalized multi-token matching and ranks results
 * so exact/label/code matches come first and codes/names stay naturally ordered.
 */
export function filterAndRankComboRows<T>(rows: T[], spec: SmartComboFilterSpec): T[] {
  const {
    query = '',
    searchCols = 'name,code',
    displayCol = 'name',
    displayFormat,
    customFilter,
    filterColumn,
    filterValue,
    table,
    maxResults = 30,
  } = spec;

  const cols = searchCols
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  const tokens = tokenizeComboQuery(query);
  const normFullQuery = tokens.join(' ');
  const seenKeys = new Set<string>();
  const ranked: Array<{ row: T; tier: number; sortKey: string; index: number }> = [];

  (rows || []).forEach((row: any, index: number) => {
    if (row === null || row === undefined || row === '') return;

    const isObj = typeof row === 'object';
    if (isObj) {
      if (table === 'accounts' && row.is_transactional === false) return;
      if (filterColumn && filterValue && String(row[filterColumn]) !== String(filterValue)) return;
      if (!matchesCustomFilter(row, customFilter)) return;
    }

    const dedupeKey = isObj && row.id !== undefined ? `id:${String(row.id)}` : `raw:${index}:${getComboItemLabel(row, displayCol, displayFormat)}`;
    if (seenKeys.has(dedupeKey)) return;
    seenKeys.add(dedupeKey);

    let tier = 0;
    if (tokens.length > 0) {
      const computedTier = computeRelevanceTier(row, normFullQuery, tokens, cols, displayCol, displayFormat);
      if (computedTier === null) return;
      tier = computedTier;
    }

    const code = getComboItemCode(row);
    const label = getComboItemLabel(row, displayCol, displayFormat);
    const sortKey = code ? `${code} ${label}` : label;
    ranked.push({ row, tier, sortKey, index });
  });

  if (tokens.length > 0 || table === 'boq_items') {
    ranked.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      const cmp = NATURAL_COLLATOR.compare(a.sortKey, b.sortKey);
      return cmp !== 0 ? cmp : a.index - b.index;
    });
  }

  return ranked.slice(0, maxResults).map((entry) => entry.row);
}
