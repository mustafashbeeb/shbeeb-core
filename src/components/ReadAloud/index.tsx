import React, { useState } from "react";
import {
  TouchableOpacity,
  Text,
  NativeModules,
  Platform,
  Alert,
} from "react-native";
import { SpeakerHigh, Stop } from "phosphor-react-native";
import { core } from "@/components/CoreBrand";

export default function ReadAloud({ text }: { text: string }) {
  const [reading, setReading] = useState(false);
  if (Platform.OS !== "android" || !NativeModules.CoreSpeech) return null;
  const toggle = async () => {
    if (reading) {
      await NativeModules.CoreSpeech.stop();
      setReading(false);
      return;
    }
    const plain = text
      .replace(/```[\s\S]*?```/g, " مقطع برمجي. ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*#`_>]/g, " ");
    setReading(true);
    try {
      await NativeModules.CoreSpeech.speak(plain);
    } catch (e: any) {
      Alert.alert("قراءة الرد", e?.message ?? "تعذّرت القراءة الصوتية");
    } finally {
      setReading(false);
    }
  };
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={reading ? "إيقاف القراءة" : "قراءة الرد بصوت عربي"}
      onPress={toggle}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        paddingVertical: 10,
        paddingHorizontal: 12,
        alignSelf: "flex-start",
        borderWidth: 1,
        borderColor: core.border,
        borderRadius: 12,
        backgroundColor: core.surface,
      }}>
      {reading ? (
        <Stop size={16} color={core.accent} />
      ) : (
        <SpeakerHigh size={16} color={core.accent} />
      )}
      <Text style={{ color: core.muted, fontSize: 11 }}>
        {reading ? "إيقاف القراءة" : "استمع للرد"}
      </Text>
    </TouchableOpacity>
  );
}
