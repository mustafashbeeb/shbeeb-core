import { useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowCounterClockwise,
  Cpu,
  Database,
  HardDrives,
  Key,
  Plugs,
  Trash,
} from 'phosphor-react-native';
import SafeView from '@/components/SafeView';
import AwaitableAlert from '@/components/AwaitableAlert';
import useRedirect from '@/hooks/useRedirect';
import useHighjackBackButtonPress from '@/hooks/useHighjackBackButtonPress';
import { database } from '@/database';
import uiStore from '@/store/UIStore';
import { showToast } from '@/utils/Notification';
import { PATHS } from '@/utils/paths';
import DatabaseInspectorView from './views/DatabaseInspectorView';
import LLMManagerView from './views/LLMManagerView';
import StorageInspectorView from './views/StorageInspectorView';
import { Card, DEV_COLORS, DevHeader, Row, Section } from './components';

type DevPage = 'main' | 'database' | 'llm' | 'storage';

export default function DevToolsMenu() {
  useRedirect();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<DevPage>('main');
  const pageRef = useRef<DevPage>('main');

  function goToPage(next: DevPage) {
    pageRef.current = next;
    setPage(next);
  }

  function goHome() {
    navigation.reset({
      index: 0,
      // @ts-ignore
      routes: [{ name: PATHS.home }],
    });
    return true;
  }

  // Sub-views register their own back handlers (mounted later, so they run first).
  // If they fall through, step back to the main menu, then out to Home.
  useHighjackBackButtonPress(() => {
    if (pageRef.current !== 'main') {
      goToPage('main');
      return true;
    }
    return goHome();
  });

  async function resetDatabase() {
    const confirm = await AwaitableAlert(
      'إعادة ضبط قاعدة البيانات',
      'سيحذف هذا نهائياً جميع مساحات العمل والمحادثات والرسائل وسجلات المستندات على الجهاز.',
      { text: 'إلغاء', style: 'cancel' },
      { text: 'إعادة ضبط قاعدة البيانات', style: 'destructive' },
    );
    if (!confirm) return;
    await database.write(async () => {
      const collections = Object.values(database.collections.map);
      for (const collection of collections) {
        await collection.query().destroyAllPermanently();
      }
    });
    showToast('تمت إعادة ضبط قاعدة البيانات');
  }

  async function confirmThen(title: string, message: string, action: () => Promise<void>, done: string) {
    const confirm = await AwaitableAlert(
      title,
      message,
      { text: 'إلغاء', style: 'cancel' },
      { text: title, style: 'destructive' },
    );
    if (!confirm) return;
    await action();
    showToast(done);
  }

  const clearProviderCache = () =>
    confirmThen(
      'مسح الإعدادات المؤقتة',
      'يمسح مفاتيح API والعناوين والنماذج المحفوظة للمزوّدين غير المستخدمين حالياً. تبقى تفضيلات المزوّد النشط كما هي.',
      () => uiStore.removeFromStorage('provider_config_cache'),
      'تم مسح إعدادات المزوّدين المؤقتة',
    );

  const clearExternalConnections = () =>
    confirmThen(
      'مسح الاتصالات',
      'يزيل جميع اتصالات AnythingLLM المحفوظة، بما فيها الاتصال النشط.',
      async () => {
        await uiStore.removeFromStorage('current_anythingllm_external_connection');
        await uiStore.removeFromStorage('anythingllm_external_connections');
      },
      'تم مسح الاتصالات الخارجية',
    );

  const clearToolSettings = () =>
    confirmThen(
      'مسح إعدادات الأدوات',
      'يعيد تفعيل أدوات المساعد وخياراتها إلى القيم الافتراضية.',
      () => uiStore.removeFromStorage('tools'),
      'تم مسح إعدادات الأدوات',
    );

  const resetOnboarding = () =>
    confirmThen(
      'إعادة الإعداد الأولي',
      'يمسح التفضيلات المحفوظة للنماذج والأدوات والاتصالات والإعدادات المؤقتة ليبدأ الإعداد الأولي عند التشغيل المقبل.',
      () => uiStore.resetAllStorage(),
      'تمت إعادة الإعداد الأولي',
    );

  return (
    <SafeView
      scrollable={false}
      safeAreaClassNames="pt-[21px]"
      containerClassNames="flex-1 flex flex-col"
      safeAreaStyle={{ backgroundColor: DEV_COLORS.background }}>
      {page === 'database' && <DatabaseInspectorView onExit={() => goToPage('main')} />}
      {page === 'llm' && <LLMManagerView onExit={() => goToPage('main')} />}
      {page === 'storage' && <StorageInspectorView onExit={() => goToPage('main')} />}
      {page === 'main' && (
        <>
          <DevHeader title="أدوات المطوّر" onBack={goHome} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 8,
              paddingBottom: insets.bottom + 20,
              gap: 24,
              flexGrow: 1,
            }}>
            <Section
              title="الأدوات"
              description="أدوات داخلية لفحص التطبيق وتشخيص مشكلاته على الجهاز.">
              <Card>
                <Row
                  title="مستكشف قاعدة البيانات"
                  subtitle="تصفّح الجداول والسجلات المحلية"
                  icon={<Database size={20} color="#FFF" />}
                  onPress={() => goToPage('database')}
                />
                <Row
                  title="تفضيلات النموذج"
                  subtitle="عرض إعدادات المزوّد المخزّنة وتعديلها"
                  icon={<Cpu size={20} color="#FFF" />}
                  onPress={() => goToPage('llm')}
                />
                <Row
                  title="تخزين التفضيلات"
                  subtitle="فحص مفاتيح الواجهة المحفوظة أو مسحها"
                  icon={<HardDrives size={20} color="#FFF" />}
                  onPress={() => goToPage('storage')}
                  borderBottom={false}
                />
              </Card>
            </Section>

            <Section
              title="إجراءات متقدمة"
              description="لا يمكن التراجع عن هذه الإجراءات. سيطلب كل إجراء تأكيدك.">
              <Card style={{ backgroundColor: DEV_COLORS.dangerBg }}>
                <Row
                  title="مسح إعدادات المزوّدين المؤقتة"
                  subtitle="مسح مفاتيح وعناوين المزوّدين غير النشطين"
                  icon={<Key size={20} color={DEV_COLORS.danger} />}
                  danger
                  onPress={clearProviderCache}
                />
                <Row
                  title="مسح الاتصالات الخارجية"
                  subtitle="إزالة اتصالات AnythingLLM المحفوظة"
                  icon={<Plugs size={20} color={DEV_COLORS.danger} />}
                  danger
                  onPress={clearExternalConnections}
                />
                <Row
                  title="مسح إعدادات الأدوات"
                  subtitle="إعادة تفعيل الأدوات إلى القيم الافتراضية"
                  icon={<ArrowCounterClockwise size={20} color={DEV_COLORS.danger} />}
                  danger
                  onPress={clearToolSettings}
                />
                <Row
                  title="إعادة ضبط قاعدة البيانات"
                  subtitle="Delete all workspaces, threads, chats, and documents"
                  icon={<Trash size={20} color={DEV_COLORS.danger} />}
                  danger
                  onPress={resetDatabase}
                />
                <Row
                  title="إعادة الإعداد الأولي"
                  subtitle="مسح التفضيلات المحفوظة وبدء الإعداد مجدداً"
                  icon={<Trash size={20} color={DEV_COLORS.danger} />}
                  danger
                  onPress={resetOnboarding}
                  borderBottom={false}
                />
              </Card>
            </Section>
          </ScrollView>
        </>
      )}
    </SafeView>
  );
}
