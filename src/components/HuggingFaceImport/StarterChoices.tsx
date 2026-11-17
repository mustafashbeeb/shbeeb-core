import React from "react";
import { Linking, Text, TouchableOpacity, View } from "react-native";
import { hfRepoWebUrl } from "@/utils/api/hfGguf";

const choices = [
  {
    id: "unsloth/Qwen3.5-0.8B-GGUF",
    title: "كوين خفيف · Qwen 0.8B",
    detail: "للبدء بنموذج صغير. مثال الحجم: نحو 812 ميغابايت لنسخة Q8_0.",
  },
  {
    id: "unsloth/Qwen3.5-2B-GGUF",
    title: "كوين أكبر · Qwen 2B",
    detail:
      "يحتاج ذاكرة ومساحة أكثر. مثال الحجم: نحو 2.16 غيغابايت لنسخة Q8_0.",
  },
  {
    id: "unsloth/gemma-3-1b-it-GGUF",
    title: "جيما من Google · Gemma 3 1B",
    detail:
      "نسخة GGUF منشورة بواسطة Unsloth. مثال الحجم: نحو 1.07 غيغابايت لنسخة Q8_0.",
  },
];

/** Discovery never starts a download: the user chooses a specific file next. */
export default function StarterChoices({
  onOpen,
}: {
  onOpen: (repoId: string) => void;
}) {
  const [linkError, setLinkError] = React.useState(false);
  const openSource = async (id: string) => {
    setLinkError(false);
    try {
      await Linking.openURL(hfRepoWebUrl(id));
    } catch {
      setLinkError(true);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Text
        style={{
          color: "#F2F6F7",
          fontSize: 18,
          fontWeight: "700",
          textAlign: "right",
        }}>
        اختر نموذجاً بدون البحث عن روابط
      </Text>
      <Text style={{ color: "#9BAFBB", textAlign: "right", lineHeight: 22 }}>
        اضغط «عرض ملفات التنزيل»، ثم اختر نسخة GGUF. سيظهر حجم الملف وتقدير
        ملاءمته لذاكرة هاتفك قبل التنزيل. الأحجام أدناه أمثلة، والأداء يعتمد على
        جهازك والنسخة المختارة.
      </Text>
      {choices.map(choice => (
        <View
          key={choice.id}
          style={{
            backgroundColor: "#122331",
            borderColor: "#294151",
            borderWidth: 1,
            borderRadius: 16,
            padding: 14,
            gap: 10,
          }}>
          <Text
            style={{
              color: "#F2F6F7",
              fontSize: 16,
              fontWeight: "700",
              textAlign: "right",
            }}>
            {choice.title}
          </Text>
          <Text
            style={{ color: "#9BAFBB", textAlign: "right", lineHeight: 22 }}>
            {choice.detail}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`عرض ملفات ${choice.title}`}
            onPress={() => onOpen(choice.id)}
            style={{
              backgroundColor: "#68E0CF",
              borderRadius: 10,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
              padding: 10,
            }}>
            <Text style={{ color: "#09121D", fontWeight: "700" }}>
              عرض ملفات التنزيل
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="link"
            accessibilityLabel={`فتح مصدر ${choice.title}`}
            onPress={() => openSource(choice.id)}
            style={{
              borderColor: "#68E0CF",
              borderWidth: 1,
              borderRadius: 10,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
              padding: 10,
            }}>
            <Text style={{ color: "#68E0CF" }}>
              فتح المصدر على Hugging Face ↗
            </Text>
          </TouchableOpacity>
        </View>
      ))}
      {linkError && (
        <Text
          accessibilityRole="alert"
          style={{ color: "#fca5a5", textAlign: "right" }}>
          تعذر فتح المتصفح. استخدم «عرض ملفات التنزيل» للوصول إلى النموذج داخل
          التطبيق.
        </Text>
      )}
      <Text style={{ color: "#D8B28B", textAlign: "right", lineHeight: 22 }}>
        عندك نموذج محمّل؟ ارجع إلى «مكتبة النماذج المشتركة» واختر «ربط ملف
        موجود» لتستخدمه دون تنزيله مرة ثانية. توفر ملفات GGUF لا يضمن توافق كل
        نسخة مع محرك التطبيق.
      </Text>
    </View>
  );
}
