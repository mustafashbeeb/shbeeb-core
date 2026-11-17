import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import uiStore from '@/store/UIStore';
import { showToast } from '@/utils/Notification';
import { Button, Card, DEV_COLORS, DevHeader, Section } from '../../components';

type StoredLLMPreference = {
  provider: string;
  config: { model: string; [key: string]: any };
};

const DEFAULT_PREFERENCE: StoredLLMPreference = {
  provider: 'openai',
  config: { model: 'gpt-4' },
};

const inputStyle = {
  backgroundColor: DEV_COLORS.input,
  padding: 16,
  textAlignVertical: 'center' as const,
};

export default function LLMManagerView({ onExit }: { onExit: () => void }) {
  const insets = useSafeAreaInsets();
  const [stored, setStored] = useState<StoredLLMPreference | null>(null);
  const [draft, setDraft] = useState<StoredLLMPreference | null>(null);

  useEffect(() => {
    uiStore.getFromStorage('llmPreference', DEFAULT_PREFERENCE).then(value => {
      setStored(value);
      setDraft(value);
    });
  }, []);

  const dirty =
    !!draft &&
    !!stored &&
    (draft.provider !== stored.provider || draft.config.model !== stored.config.model);

  async function save() {
    if (!draft) return;
    const next = {
      ...draft,
      provider: draft.provider.trim(),
      config: { ...draft.config, model: draft.config.model.trim() },
    };
    await uiStore.setToStorage('llmPreference', next);
    setStored(next);
    setDraft(next);
    showToast('LLM preference saved');
  }

  return (
    <>
      <DevHeader title="تفضيلات النموذج" onBack={onExit} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{
            paddingHorizontal: 8,
            paddingBottom: insets.bottom + 20,
            gap: 24,
            flexGrow: 1,
          }}>
          <Section
            title="تعديل مباشر"
            description="يعدّل التفضيل المخزّن مباشرة مع إبقاء مفاتيح الإعداد الأخرى. استخدم الإعدادات للاستخدام المعتاد.">
            <View className="flex flex-col" style={{ gap: 12 }}>
              <View className="flex flex-col" style={{ gap: 8 }}>
                <Text style={{ color: DEV_COLORS.muted }} className="text-sm uppercase">
                  المزوّد
                </Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={inputStyle}
                  className="rounded-lg text-white placeholder:text-white/50"
                  placeholder="مثلاً openai"
                  value={draft?.provider ?? ''}
                  onChangeText={text =>
                    setDraft(prev => (prev ? { ...prev, provider: text } : prev))
                  }
                />
              </View>
              <View className="flex flex-col" style={{ gap: 8 }}>
                <Text style={{ color: DEV_COLORS.muted }} className="text-sm uppercase">
                  النموذج
                </Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={inputStyle}
                  className="rounded-lg text-white placeholder:text-white/50"
                  placeholder="مثلاً gpt-4"
                  value={draft?.config?.model ?? ''}
                  onChangeText={text =>
                    setDraft(prev =>
                      prev ? { ...prev, config: { ...prev.config, model: text } } : prev,
                    )
                  }
                />
              </View>
              <Button label="حفظ التفضيل" disabled={!dirty} onPress={save} />
            </View>
          </Section>

          <Section title="القيمة المخزّنة">
            <Card>
              <Text selectable className="text-white text-sm font-mono">
                {stored ? JSON.stringify(stored, null, 2) : 'جارٍ التحميل…'}
              </Text>
            </Card>
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
