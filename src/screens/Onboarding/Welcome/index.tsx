import React from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import SafeView from "@/components/SafeView";
import CoreBrand, { core, CoreMark } from "@/components/CoreBrand";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import uiStore from "@/store/UIStore";
import { PATHS } from "@/utils/paths";
import { Cpu, FolderOpen, ShieldCheck, ArrowLeft } from "phosphor-react-native";
import useHighjackBackButtonPress from "@/hooks/useHighjackBackButtonPress";
import { showToast } from "@/utils/Notification";

export default function OnboardingWelcome() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  useHighjackBackButtonPress(() => {
    showToast("أكمل الإعداد للبدء", "short");
    return true;
  });
  return (
    <SafeView
      scrollable
      safeAreaStyle={{ backgroundColor: core.bg }}
      containerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
        minHeight: "100%",
      }}>
      <CoreBrand />
      <View style={styles.hero}>
        <CoreMark size={120} />
        <Text style={styles.title}>
          ذكاء قريب.{"\n"}وخيارات{" "}
          <Text style={{ color: core.accent }}>أوسع.</Text>
        </Text>
        <Text style={styles.subtitle}>
          أفكارك ومحادثاتك وملفاتك في مساحة واحدة، بالعربية ومن اليمين لليسار.
        </Text>
      </View>
      <View style={styles.features}>
        {[
          {
            Icon: Cpu,
            title: "على الهاتف أو مع مزوّدك",
            body: "اختر نموذجاً محلياً، أو اربط مزوّداً خارجياً من إعداداتك.",
          },
          {
            Icon: FolderOpen,
            title: "مكتبة نماذج بمجلد تختاره",
            body: "اربط ملفات GGUF الموجودة دون إعادة تنزيل أو نسخ.",
          },
          {
            Icon: ShieldCheck,
            title: "أنت تتحكم بالأدوات",
            body: "محادثة مباشرة، أو مساعد يستخدم الأدوات المفعّلة.",
          },
        ].map(({ Icon, title, body }) => (
          <View key={title} style={styles.feature}>
            <View style={styles.icon}>
              <Icon size={22} color={core.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>{title}</Text>
              <Text style={styles.body}>{body}</Text>
            </View>
          </View>
        ))}
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={async () => {
          await uiStore.setToStorage("onboarding_welcome_completed", true);
          navigation.navigate(PATHS.onboarding.model_selection as never);
        }}
        style={styles.start}>
        <Text style={styles.startText}>ابدأ رحلتك</Text>
        <ArrowLeft size={21} color={core.bg} />
      </TouchableOpacity>
      <Text style={styles.credit}>Shbeeb Core · مبني على AnythingLLM</Text>
    </SafeView>
  );
}
const styles = StyleSheet.create({
  hero: { alignItems: "center", marginTop: 40, marginBottom: 30 },
  title: {
    fontSize: 35,
    lineHeight: 50,
    fontWeight: "700",
    color: core.text,
    textAlign: "center",
    marginTop: 25,
  },
  subtitle: {
    color: core.muted,
    lineHeight: 25,
    fontSize: 14,
    textAlign: "center",
    marginTop: 16,
    maxWidth: 320,
  },
  features: { gap: 18, marginBottom: 30 },
  feature: { flexDirection: "row", alignItems: "center", gap: 14 },
  icon: { padding: 13, backgroundColor: core.surface, borderRadius: 16 },
  featureTitle: { color: core.text, fontSize: 15, fontWeight: "600" },
  body: { color: core.muted, lineHeight: 22, fontSize: 12, marginTop: 4 },
  start: {
    backgroundColor: core.accent,
    minHeight: 54,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 12,
  },
  startText: { color: core.bg, fontWeight: "700", fontSize: 16 },
  credit: {
    color: core.muted,
    fontSize: 10,
    textAlign: "center",
    marginTop: 17,
  },
});
