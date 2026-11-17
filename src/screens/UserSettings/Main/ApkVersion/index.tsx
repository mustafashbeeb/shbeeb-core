import DeviceInfo from 'react-native-device-info';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

/** Personal builds have a different signing identity from Google Play. Never offer an incompatible store update. */
export default function ApkVersion() {
  const { t } = useTranslation();
  const version = DeviceInfo.getVersion();
  const build = DeviceInfo.getBuildNumber();
  return (
    <View className="flex flex-row items-end justify-between">
      <Text style={{ color: '#9F9FA0' }} className="text-sm">{t('settings.version.about')}</Text>
      <TouchableOpacity onPress={() => Alert.alert(
        t('settings.version.personal_title'),
        t('settings.version.personal_details', { version, build, package: DeviceInfo.getBundleId() }),
      )} accessibilityLabel={t('settings.version.build_label', { build })}>
        <Text style={{ color: '#888' }} className="text-sm">v{version} · {build}</Text>
      </TouchableOpacity>
    </View>
  );
}
