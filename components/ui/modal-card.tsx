import { StyleSheet, View, type ViewProps } from "react-native";

import { AppTheme } from "@/constants/theme";

export function ModalCard({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.xl,
    padding: AppTheme.spacing.xl,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    ...AppTheme.shadow.md,
  },
});
