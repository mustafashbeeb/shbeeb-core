import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";

export const core = {
  bg: "#09121D",
  surface: "#122331",
  raised: "#1A3040",
  border: "#294151",
  accent: "#68E0CF",
  copper: "#D8B28B",
  text: "#F2F6F7",
  muted: "#9BAFBB",
};

export function CoreMark({ size = 38 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      accessibilityElementsHidden>
      <Path
        d="M32 3 58 18v28L32 61 6 46V18Z"
        fill={core.surface}
        stroke={core.accent}
        strokeWidth="2"
      />
      <Path
        d="m32 15 15 9v16l-15 9-15-9V24Z"
        fill="none"
        stroke={core.copper}
        strokeWidth="2"
      />
      <Path d="m32 24 8 8-8 8-8-8Z" fill={core.accent} />
      <Circle cx="32" cy="32" r="3" fill={core.bg} />
    </Svg>
  );
}

export default function CoreBrand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.row} accessibilityLabel="شبيب نواة، Shbeeb Core">
      <CoreMark size={compact ? 32 : 46} />
      <View>
        <Text style={[styles.name, compact && { fontSize: 15 }]}>
          SHBEEB <Text style={{ color: core.accent }}>CORE</Text>
        </Text>
        {!compact && <Text style={styles.arabic}>شبيب نواة</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: {
    color: core.text,
    fontSize: 21,
    fontWeight: "700",
    letterSpacing: 1.2,
    writingDirection: "ltr",
  },
  arabic: { color: core.muted, fontSize: 13, marginTop: 3 },
});
