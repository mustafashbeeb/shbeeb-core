import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import {
  FolderOpen,
  LinkSimple,
  ArrowsClockwise,
  CheckCircle,
  DownloadSimple,
} from "phosphor-react-native";
import { SharedLibrary, type SharedModel } from "@/utils/models/sharedLibrary";
import { core } from "@/components/CoreBrand";
import useLLMPreference from "@/hooks/useLLMPreference";
import { formatBytes } from "@/utils/formatters";
import { sizeToBytes, MEMORY_RESERVE_BYTES } from "@/utils/models/memoryFit";
import { activateKeepAwake, deactivateKeepAwake } from "@/utils/keepAwake";
import MODEL_CARDS from "@/utils/models/defaults";
import { defaultModels } from "@/utils/models";

export default function SharedLibraryPanel({
  onSelected,
}: {
  onSelected?: (model: SharedModel) => Promise<void>;
}) {
  const { llmPreferences, updateLLMPreference } = useLLMPreference();
  const [folder, setFolder] = useState<string | null>(null);
  const [models, setModels] = useState<SharedModel[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  const refresh = async () => {
    const [f, m] = await Promise.all([
      SharedLibrary.folder(),
      SharedLibrary.list(),
    ]);
    if (mounted.current) {
      setFolder(f);
      setModels(m);
    }
  };
  useEffect(() => {
    mounted.current = true;
    refresh().catch(() => {});
    return () => {
      mounted.current = false;
    };
  }, []);
  if (Platform.OS !== "android") return null;
  const run = async (label: string, action: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(label);
    try {
      await action();
      await refresh();
    } catch (e: any) {
      Alert.alert("مكتبة النماذج", e?.message ?? "تعذّر إكمال العملية");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(null);
    }
  };
  const pickFolder = () =>
    run("قراءة المجلد…", async () => {
      if (await SharedLibrary.chooseFolder()) await SharedLibrary.scan();
    });
  const choose = (m: SharedModel) =>
    run("التحقق من الملف…", async () => {
      await SharedLibrary.open(m.modelId);
      await updateLLMPreference("native", {
        ...(llmPreferences.provider === "native" ? llmPreferences.config : {}),
        model: m.modelId,
      });
      await onSelected?.(m);
    });
  const forget = (m: SharedModel) =>
    Alert.alert(
      "إزالة الربط؟",
      "سيبقى الملف الأصلي في مجلده. تُزال إشارته من شبيب نواة فقط.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "إزالة الربط",
          onPress: () =>
            run("إزالة الربط…", async () => {
              if (llmPreferences.config.model === m.modelId)
                await updateLLMPreference("native", {
                  ...llmPreferences.config,
                  model: null,
                });
              await SharedLibrary.forget(m.modelId);
            }),
        },
      ],
    );
  return (
    <View style={styles.panel}>
      <View style={styles.heading}>
        <View style={styles.icon}>
          <FolderOpen size={24} color={core.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>مكتبتك، بمجلدك</Text>
          <Text style={styles.caption}>
            ملف واحد · ربط مباشر · دون نسخ مكرر
          </Text>
        </View>
      </View>
      <Text style={styles.body}>
        اختر مجلداً محلياً للنماذج، أو اربط ملف GGUF موجوداً. التطبيق الآخر
        يحتاج إذن وصول مستقل ومحركاً متوافقاً.
      </Text>
      <View style={styles.row}>
        <TouchableOpacity
          disabled={!!busy}
          onPress={pickFolder}
          style={styles.button}
          accessibilityRole="button">
          <FolderOpen size={18} color={core.accent} />
          <Text style={styles.buttonText}>
            {folder ? "تغيير المجلد" : "اختيار مجلد"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={!!busy}
          onPress={() => run("ربط الملف…", () => SharedLibrary.link())}
          style={styles.button}
          accessibilityRole="button">
          <LinkSimple size={18} color={core.accent} />
          <Text style={styles.buttonText}>ربط ملف موجود</Text>
        </TouchableOpacity>
      </View>
      {folder && (
        <TouchableOpacity
          disabled={!!busy}
          accessibilityRole="button"
          onPress={() => run("فحص المجلد…", () => SharedLibrary.scan())}
          style={styles.folder}>
          <ArrowsClockwise size={16} color={core.copper} />
          <Text numberOfLines={2} style={styles.caption}>
            {decodeURIComponent(folder.split("/tree/")[1] ?? folder)} · إعادة
            الفحص
          </Text>
        </TouchableOpacity>
      )}
      {busy && (
        <View style={styles.folder}>
          <ActivityIndicator size="small" color={core.accent} />
          <Text style={styles.body}>{busy}</Text>
        </View>
      )}
      {busy?.startsWith("تنزيل") && (
        <TouchableOpacity onPress={() => SharedLibrary.cancel()}>
          <Text style={styles.cancel}>إلغاء التنزيل</Text>
        </TouchableOpacity>
      )}
      {models.map(m => (
        <View key={m.modelId} style={styles.model}>
          <Text style={styles.modelName}>{m.name}</Text>
          <Text style={styles.caption}>
            {formatBytes(m.size)} · GGUF · llama.cpp
          </Text>
          <Text style={styles.caption}>
            التوافق النهائي يُفحص عند تحميل النموذج؛ ملفات LiteRT غير مدعومة
            بهذا المحرك.
          </Text>
          <View style={styles.row}>
            <TouchableOpacity
              disabled={!!busy}
              onPress={() => choose(m)}
              style={[styles.button, styles.activeButton]}
              accessibilityRole="button">
              <CheckCircle size={17} color={core.accent} />
              <Text style={styles.buttonText}>
                {llmPreferences.config.model === m.modelId &&
                llmPreferences.provider === "native"
                  ? "النموذج المختار"
                  : "اختيار النموذج"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!!busy}
              onPress={() => forget(m)}
              style={styles.button}
              accessibilityRole="button">
              <Text style={styles.caption}>إزالة الربط</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
      {folder && (
        <View style={{ gap: 9, marginTop: 12 }}>
          <Text style={styles.title}>تنزيل مباشر للمكتبة</Text>
          <Text style={styles.caption}>
            أبقِ التطبيق مفتوحاً. نفحص الحجم وسلامة النسخة قبل اعتمادها. الملف
            الموجود بنفس الاسم والحجم يُعاد استخدامه.
          </Text>
          {MODEL_CARDS.map(preset => {
            const exact = defaultModels.find(m => m.id === preset.modelId);
            const bytes = sizeToBytes(exact?.size ?? preset.size);
            return (
              <TouchableOpacity
                key={preset.id}
                disabled={!!busy}
                style={styles.download}
                accessibilityRole="button"
                onPress={() =>
                  Alert.alert(
                    "تنزيل للمجلد المختار",
                    `${preset.modelId.split("/")[1]}\n${formatBytes(
                      bytes,
                    )}\nيتطلب إنترنت ومساحة كافية.`,
                    [
                      { text: "إلغاء", style: "cancel" },
                      {
                        text: "تنزيل",
                        onPress: () =>
                          run("تنزيل وفحص الملف…", async () => {
                            activateKeepAwake();
                            try {
                              await SharedLibrary.download(
                                preset.tag,
                                preset.tag.split("/").pop()!,
                                bytes,
                              );
                            } finally {
                              deactivateKeepAwake();
                            }
                          }),
                      },
                    ],
                  )
                }>
                <DownloadSimple size={18} color={core.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.buttonText}>
                    {preset.modelId.split("/")[1]}
                  </Text>
                  <Text style={styles.caption}>
                    {formatBytes(bytes)} · GGUF
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      <Text style={[styles.caption, { marginTop: 12 }]}>
        المكتبة المشتركة لا تُحذف عند إزالة التطبيق. النسخ القديمة داخل التطبيق
        تُحفظ خارجَه بزر «تصدير النموذج» أدناه.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  panel: {
    padding: 18,
    gap: 13,
    backgroundColor: core.surface,
    borderColor: core.border,
    borderWidth: 1,
    borderRadius: 22,
    marginBottom: 22,
  },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { padding: 10, borderRadius: 15, backgroundColor: core.raised },
  title: { color: core.text, fontSize: 17, fontWeight: "700" },
  caption: { color: core.muted, fontSize: 11, lineHeight: 19 },
  body: { color: core.muted, fontSize: 13, lineHeight: 23 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: 11,
    minHeight: 44,
    borderWidth: 1,
    borderColor: core.border,
    borderRadius: 12,
  },
  buttonText: { color: core.text, fontSize: 12, fontWeight: "600" },
  folder: { flexDirection: "row", alignItems: "center", gap: 8 },
  model: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: core.border,
    paddingTop: 14,
  },
  modelName: {
    color: core.text,
    fontSize: 14,
    fontWeight: "600",
    writingDirection: "ltr",
    textAlign: "left",
  },
  activeButton: { backgroundColor: "#1A3C40" },
  download: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 12,
    borderRadius: 13,
    backgroundColor: core.raised,
  },
  cancel: { color: "#F6A29A", padding: 10, textAlign: "center" },
});
