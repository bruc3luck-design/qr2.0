import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { AppTheme } from "@/constants/theme";

type Props = {
  title: string;
  eyebrow?: string;
  onBackPress?: () => void;
  rightSlot?: ReactNode;
};

export function PageHeader({ title, eyebrow, onBackPress, rightSlot }: Props) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBackPress || (() => (router.canGoBack() ? router.back() : null))}
      >
        <Ionicons name="arrow-back" size={18} color={AppTheme.colors.primary} />
      </TouchableOpacity>

      <View style={styles.textWrap}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>

      {rightSlot ? <View>{rightSlot}</View> : <View style={styles.placeholder} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.lg,
    marginBottom: AppTheme.spacing["2xl"],
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: AppTheme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.colors.backgroundMuted,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  textWrap: {
    flex: 1,
  },
  eyebrow: {
    ...AppTheme.typography.eyebrow,
    marginBottom: AppTheme.spacing.xs,
  },
  title: {
    ...AppTheme.typography.title,
  },
  placeholder: {
    width: 44,
    height: 44,
  },
});
