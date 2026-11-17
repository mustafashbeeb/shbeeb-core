import { NativeModules, Platform } from 'react-native';

export type PickedSharedGguf = {
  uri: string;
  name: string;
  sizeBytes: number;
};

export type OpenedSharedGguf = {
  token: string;
  path: string;
  sizeBytes: number;
};

type SharedGgufNativeModule = {
  pickGGUF: () => Promise<PickedSharedGguf | null>;
  openGGUF: (uri: string) => Promise<OpenedSharedGguf>;
  closeGGUF: (token: string) => Promise<boolean>;
  releaseGGUF: (uri: string) => Promise<boolean>;
};

const nativeModule = NativeModules.SharedGgufAccess as SharedGgufNativeModule | undefined;

function getNativeModule(): SharedGgufNativeModule {
  if (Platform.OS !== 'android' || !nativeModule) {
    throw new Error('استيراد ملف GGUF مشترك متاح في إصدار Android فقط.');
  }
  return nativeModule;
}

export function pickSharedGguf(): Promise<PickedSharedGguf | null> {
  return getNativeModule().pickGGUF();
}

export function openSharedGguf(uri: string): Promise<OpenedSharedGguf> {
  return getNativeModule().openGGUF(uri);
}

export async function closeSharedGguf(token: string): Promise<void> {
  await getNativeModule().closeGGUF(token);
}

export async function releaseSharedGguf(uri: string): Promise<void> {
  await getNativeModule().releaseGGUF(uri);
}

/** Stable per-document id. The selected content URI is stored separately and can be re-opened after restart. */
export function sharedGgufModelId(uri: string, filename: string): string {
  let hash = 5381;
  for (let index = 0; index < uri.length; index += 1) {
    hash = (hash * 33 + uri.charCodeAt(index)) % 0xFFFFFFFF;
  }
  const modelName = filename
    .replace(/\.gguf$/i, '')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .slice(0, 40) || 'model';
  return `shared-saf/${modelName}-${hash.toString(36)}.gguf`;
}
