import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Lightning, Wrench } from "phosphor-react-native";
import useCoreMode from "@/hooks/useCoreMode";
import { useChatHandlerContext } from "@/hooks/useChatHandler";
import useLLMPreference from "@/hooks/useLLMPreference";
import { core } from "@/components/CoreBrand";

export default function CoreModeBar() {
  const { quick, setQuick } = useCoreMode();
  const { isWorking } = useChatHandlerContext();
  const { llmPreferences } = useLLMPreference();
  return (
    <View style={styles.wrap}>
      <View style={styles.segment}>
        {[
          { value: true, label: "محادثة سريعة", Icon: Lightning },
          { value: false, label: "مساعد بالأدوات", Icon: Wrench },
        ].map(({ value, label, Icon }) => (
          <TouchableOpacity
            key={label}
            accessibilityRole="button"
            accessibilityState={{
              selected: quick === value,
              disabled: isWorking,
            }}
            disabled={isWorking}
            onPress={() => setQuick(value)}
            style={[
              styles.option,
              quick === value && styles.selected,
              isWorking && { opacity: 0.5 },
            ]}>
            <Icon
              size={15}
              color={quick === value ? core.accent : core.muted}
            />
            <Text
              style={{
                color: quick === value ? core.text : core.muted,
                fontSize: 12,
              }}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.hint}>
        {quick
          ? "بدون أدوات أو بحث على الويب"
          : llmPreferences.provider === "native"
          ? "على الهاتف · تُستخدم الأدوات المفعّلة عند الحاجة"
          : "مزود خارجي · تُرسل المحادثة للمزود المختار"}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { paddingTop: 8, paddingBottom: 6, gap: 7 },
  segment: {
    flexDirection: "row",
    padding: 4,
    backgroundColor: core.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: core.border,
  },
  option: {
    flex: 1,
    minHeight: 36,
    borderRadius: 12,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  selected: { backgroundColor: core.raised },
  hint: { color: core.muted, fontSize: 11, textAlign: "center" },
});
