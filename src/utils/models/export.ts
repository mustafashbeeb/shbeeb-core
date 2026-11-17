import { NativeModules, Platform } from 'react-native';
import { resolveDestinationPathFromGGUFUrl } from './defaults';
import i18n from '@/i18n';

export type ModelExportResult = {
  cancelled: boolean;
  uri?: string;
  filename?: string;
  bytes?: number;
  sha256?: string;
};

/** Original file stays private and unchanged. The user chooses an independent document outside app storage. */
export async function exportInstalledModel(downloadUrl: string): Promise<ModelExportResult> {
  if (Platform.OS !== 'android' || !NativeModules.ModelExportModule?.exportModel) {
    throw new Error(i18n.t('models.export.unavailable'));
  }
  return NativeModules.ModelExportModule.exportModel(resolveDestinationPathFromGGUFUrl(downloadUrl));
}
