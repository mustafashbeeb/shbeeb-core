/**
 * Shbeeb Core local diagnostics.
 * Stores only allowlisted event metadata; never prompts, tokens, paths or raw stack traces.
 * No network requests or automatic GitHub uploads.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'shbeeb_diagnostics_v1';
const LIMIT = 100;
export type DiagnosticCategory = 'crash' | 'microphone' | 'model' | 'network' | 'other';
export type DiagnosticEntry = {
  id: string;
  timestamp: string;
  category: DiagnosticCategory;
  code: string;
  source: string;
  count: number;
};

const clean = (value: string, max = 64): string =>
  value.replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, max);

let queue: Promise<unknown> = Promise.resolve();

/** Serializes read/modify/write so concurrent errors do not overwrite each other. */
export function recordDiagnostic(
  category: DiagnosticCategory,
  code: string,
  source: string,
): Promise<void> {
  const job = queue.catch(() => undefined).then(async () => {
    const raw = await AsyncStorage.getItem(KEY);
    let entries: DiagnosticEntry[] = [];
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) entries = parsed as DiagnosticEntry[];
    } catch {
      entries = [];
    }
    const safeCode = clean(code);
    const safeSource = clean(source);
    const latest = entries[0];
    if (latest && latest.category === category && latest.code === safeCode && latest.source === safeSource) {
      latest.count += 1;
      latest.timestamp = new Date().toISOString();
    } else {
      entries.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        category,
        code: safeCode,
        source: safeSource,
        count: 1,
      });
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(entries.slice(0, LIMIT)));
  });
  queue = job;
  return job.then(() => undefined);
}

export async function getDiagnostics(): Promise<DiagnosticEntry[]> {
  await queue.catch(() => undefined);
  try {
    const value = await AsyncStorage.getItem(KEY);
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed as DiagnosticEntry[] : [];
  } catch {
    return [];
  }
}

export async function clearDiagnostics(): Promise<void> {
  const job = queue.catch(() => undefined).then(() => AsyncStorage.removeItem(KEY));
  queue = job;
  await job;
}
