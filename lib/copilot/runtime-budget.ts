/** Shared across all model attempts and tool rounds in a single chat turn. */
export const COPILOT_AI_BUDGET_MS = 16_000;
const MAX_PROVIDER_CALL_MS = 8_000;

export async function fetchCopilotJson(
  url: string,
  init: RequestInit,
  deadline: number,
  options: { now?: () => number; maxCallMs?: number } = {}
): Promise<any | null> {
  const now = options.now || (() => performance.now());
  const remaining = Math.min(options.maxCallMs || MAX_PROVIDER_CALL_MS, deadline - now());
  if (remaining <= 0) return null;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('copilot_response_timeout'));
    }, remaining);
  });
  try {
    // Include body decoding in the same budget, not just receipt of response headers.
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { ...init, signal: controller.signal });
        return response.ok ? await response.json() : null;
      })(),
      expired,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
