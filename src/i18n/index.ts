// Arabic personal edition: use Arabic consistently, including when updating an English install.
import "intl-pluralrules";
import i18n, { type Resource } from "i18next";
import { initReactI18next } from "react-i18next";
import { I18nManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { defaultNS, resources } from "@/locales/resources";
import LANGUAGE_LIST from "@/locales/languages.json";

export type Language = { code: string; nativeName: string; englishName: string };
export const FALLBACK_LANGUAGE = "ar";
const STORAGE_KEY = "app_language";
// This APK is an Arabic edition. Keep the picker consistent with its native RTL layout.
export const LANGUAGES: Language[] = (LANGUAGE_LIST as Language[]).filter(lang => lang.code === "ar");
export function matchLanguage(locale: string): string | null {
  return locale.toLowerCase().split(/[-_]/)[0] === "ar" ? "ar" : null;
}
export function detectDeviceLanguage(): string { return FALLBACK_LANGUAGE; }

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);
I18nManager.swapLeftAndRightInRTL(true);

i18n.use(initReactI18next).init({
  resources: resources as unknown as Resource,
  defaultNS,
  lng: FALLBACK_LANGUAGE,
  fallbackLng: FALLBACK_LANGUAGE,
  returnNull: false,
  returnEmptyString: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

let hydration: Promise<void> | null = null;
export function hydrateLanguage(): Promise<void> {
  if (!hydration) {
    hydration = AsyncStorage.setItem(STORAGE_KEY, FALLBACK_LANGUAGE)
      .then(async () => { await i18n.changeLanguage(FALLBACK_LANGUAGE); })
      .catch(() => {});
  }
  return hydration;
}
export async function setLanguage(code: string) {
  if (code !== FALLBACK_LANGUAGE) throw new Error("هذه النسخة مخصّصة للواجهة العربية");
  await AsyncStorage.setItem(STORAGE_KEY, code);
  await i18n.changeLanguage(code);
}
export const tKey = (key: string) => key;
export function currentLanguage(): string { return i18n.resolvedLanguage ?? FALLBACK_LANGUAGE; }
export default i18n;
