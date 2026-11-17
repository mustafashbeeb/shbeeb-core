import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearDiagnostics, getDiagnostics, recordDiagnostic } from '../index';

jest.mock('@react-native-async-storage/async-storage', () => {
  const data = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => data.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => { data.set(key, value); }),
      removeItem: jest.fn(async (key: string) => { data.delete(key); }),
    },
  };
});

beforeEach(async () => {
  await clearDiagnostics();
  jest.clearAllMocks();
});

test('stores a sanitized diagnostic without raw messages or secrets', async () => {
  await recordDiagnostic('model', 'Failed: token=secret value', '/private/path');
  const entries = await getDiagnostics();
  expect(entries).toHaveLength(1);
  expect(entries[0].category).toBe('model');
  expect(entries[0].code).not.toContain(' ');
  expect(entries[0].source).not.toContain('/');
  expect(JSON.stringify(entries)).not.toContain('token=secret');
});

test('coalesces repeated consecutive events', async () => {
  await recordDiagnostic('microphone', 'PermissionDenied', 'Voice');
  await recordDiagnostic('microphone', 'PermissionDenied', 'Voice');
  expect((await getDiagnostics())[0].count).toBe(2);
});

test('keeps only the latest 100 entries', async () => {
  for (let i = 0; i < 105; i++) {
    await recordDiagnostic('other', `E${i}`, 'Test');
  }
  expect(await getDiagnostics()).toHaveLength(100);
});

test('serializes concurrent writes and clears the journal', async () => {
  await Promise.all(Array.from({ length: 10 }, () =>
    recordDiagnostic('network', 'Timeout', 'Provider'),
  ));
  expect((await getDiagnostics())[0].count).toBe(10);
  await clearDiagnostics();
  expect(await getDiagnostics()).toEqual([]);
  expect(AsyncStorage.removeItem).toHaveBeenCalled();
});
