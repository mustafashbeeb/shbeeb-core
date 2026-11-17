// Arabic edition release check. Exercises i18next's six Arabic plural categories.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import i18next from 'i18next';
import { flatten, readLocale, expectedKeys } from './translations/lib.mjs';
const ar = readLocale('ar');
const flat = flatten(ar);
const expected = expectedKeys('ar', flatten(readLocale('en')));
assert.equal(Object.keys(flat).length, expected.size);
for (const key of expected.keys()) {
  assert.equal(typeof flat[key], 'string', key);
  assert.ok(flat[key].trim(), key);
}
const instance = i18next.createInstance();
await instance.init({ lng: 'ar', fallbackLng: false, resources: { ar: { translation: ar } }, interpolation: { escapeValue: false } });
for (const count of [0, 1, 2, 3, 11, 100]) {
  const category = new Intl.PluralRules('ar').select(count);
  const result = instance.t('chat.files.deleted', { count });
  assert.equal(result, flat[`chat.files.deleted_${category}`].replace('{{count}}', String(count)));
  assert.ok(!result.includes('{{'), result);
}
assert.equal(instance.t('language.title'), 'اللغة');
assert.equal(instance.t('chat.prompt_input.placeholder'), 'اكتب رسالتك');
assert.equal(instance.t('settings.provider_options.no_tool_calls').includes('<bold>'), true);
// Guard the release defaults and first-launch native layout: a JS-only forceRTL takes another launch.
const native = fs.readFileSync('android/app/src/main/java/com/anythingllm/MainApplication.kt', 'utf8');
assert.ok(native.indexOf('forceRTL(this, true)') < native.indexOf('loadReactNative(this)'));
assert.ok(fs.readFileSync('src/hooks/useSpeechToText.ts', 'utf8').includes("'ar-AE'"));
console.log(`Arabic edition verified: ${Object.keys(flat).length} non-empty translations; all six plural categories resolve.`);
