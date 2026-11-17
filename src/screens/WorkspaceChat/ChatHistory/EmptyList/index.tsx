import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from "react-native";
import {
  ChatCircleDots,
  FileText,
  Lightbulb,
  PenNib,
  ArrowUpLeft,
  ShieldCheck,
} from "phosphor-react-native";
import { useChatHandlerContext } from "@/hooks/useChatHandler";
import { useAttachmentsContext } from "@/hooks/useAttachments";
import useCoreMode from "@/hooks/useCoreMode";
import { core, CoreMark } from "@/components/CoreBrand";

const starters = [
  {
    title: "نفكّر سوا",
    note: "حوّل الفكرة لخطة واضحة",
    prompt: "ساعدني أحوّل فكرتي إلى خطة عملية. اسألني أولاً عن الفكرة والهدف.",
    Icon: Lightbulb,
    color: core.copper,
  },
  {
    title: "اكتب باحتراف",
    note: "رسالة، قصة أو محتوى",
    prompt:
      "أريد كتابة نص احترافي. اسألني عن نوع النص والجمهور والأسلوب المناسب.",
    Icon: PenNib,
    color: core.accent,
  },
  {
    title: "بسّط لي",
    note: "شرح يفهمه الجميع",
    prompt:
      "ساعدني أفهم موضوعاً خطوة بخطوة، مع أمثلة بسيطة. اسألني عن الموضوع.",
    Icon: ChatCircleDots,
    color: "#A5B9FC",
  },
  {
    title: "اقرأ ملفاتي",
    note: "أرفق ملفاً من زر الإضافة",
    prompt:
      "سأرفق مستنداً. أريد تلخيصه وتحديد أهم النقاط فيه دون اختلاق معلومات.",
    Icon: FileText,
    color: "#E4B6CE",
  },
];

/** No location request, background network lookup, or silent tool-preference changes on an empty chat. */
export default function EmptyList({ height }: { height: number }) {
  const chat = useChatHandlerContext();
  const attachments = useAttachmentsContext();
  const { quick } = useCoreMode();
  const hasAttachments = !!attachments?.attachments.length;
  const processing = attachments?.attachments.some(a => a.processing);
  return (
    <ScrollView
      style={{ height: Math.max(200, height - 66) }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <View style={styles.eyebrow}>
        <View style={styles.dot} />
        <Text style={styles.eyebrowText}>مساحة لأفكارك</Text>
      </View>
      <View style={styles.hero}>
        <CoreMark size={58} />
        <Text style={styles.title}>
          من فكرة…{"\n"}إلى <Text style={{ color: core.accent }}>خطوة.</Text>
        </Text>
      </View>
      <Text style={styles.subtitle}>
        {hasAttachments
          ? "ملفاتك جاهزة للسؤال. اختر البداية المناسبة."
          : "اسأل، اكتب، واكتشف. اختر بدايةً أو اكتب بطريقتك."}
      </Text>
      {hasAttachments ? (
        <TouchableOpacity
          disabled={processing || chat.promptDisabled}
          onPress={() =>
            chat.setPrompt(
              "لخّص المرفقات وحدّد أهم النقاط، مع ذكر ما لا يمكن التحقق منه.",
              true,
            )
          }
          style={styles.attachment}
          accessibilityRole="button">
          <FileText color={core.accent} size={24} />
          <Text style={styles.cardTitle}>
            {processing ? "جارٍ تجهيز المرفقات…" : "تلخيص المرفقات"}
          </Text>
          {processing && <ActivityIndicator color={core.accent} />}
        </TouchableOpacity>
      ) : (
        <View style={styles.grid}>
          {starters.map(({ title, note, prompt, Icon, color }) => (
            <TouchableOpacity
              key={title}
              disabled={chat.promptDisabled}
              accessibilityRole="button"
              accessibilityLabel={`${title}، ${note}`}
              onPress={() => chat.setPrompt(prompt, true)}
              activeOpacity={0.75}
              style={styles.card}>
              <View style={styles.cardTop}>
                <Icon size={23} color={color} />
                <ArrowUpLeft size={16} color={core.muted} />
              </View>
              <Text style={styles.cardTitle}>{title}</Text>
              <Text style={styles.cardNote}>{note}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <View style={styles.footer}>
        <ShieldCheck size={15} color={core.muted} />
        <Text style={styles.cardNote}>
          {quick
            ? "الوضع السريع يتجاوز الأدوات؛ الملفات المرفقة تبقى ضمن السياق."
            : "الأدوات تحت تحكمك. غيّرها من إعدادات المحادثة."}
        </Text>
      </View>
    </ScrollView>
  );
}
export function EmptyListLoading({ height }: { height: number }) {
  return (
    <View
      style={{
        height,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
      }}>
      <ActivityIndicator color={core.accent} />
      <Text style={styles.subtitle}>جارٍ فتح محادثاتك…</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: 8, paddingTop: 20, paddingBottom: 30 },
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 20,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: core.accent },
  eyebrowText: { color: core.copper, fontSize: 12 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    flex: 1,
    color: core.text,
    fontSize: 33,
    fontWeight: "700",
    lineHeight: 47,
    textAlign: "left",
  },
  subtitle: {
    color: core.muted,
    fontSize: 14,
    lineHeight: 25,
    marginTop: 12,
    marginBottom: 22,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    width: "48%",
    flexGrow: 1,
    padding: 15,
    minHeight: 128,
    backgroundColor: core.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: core.border,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: { color: core.text, fontSize: 15, fontWeight: "600" },
  cardNote: {
    flexShrink: 1,
    color: core.muted,
    fontSize: 11,
    lineHeight: 20,
    marginTop: 4,
  },
  footer: { flexDirection: "row", gap: 7, alignItems: "center", marginTop: 16 },
  attachment: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: core.border,
    backgroundColor: core.surface,
    gap: 12,
    flexDirection: "row",
    alignItems: "center",
  },
});
