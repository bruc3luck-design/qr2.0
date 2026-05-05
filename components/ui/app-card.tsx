import { StyleSheet, View, type ViewProps } from "react-native";

import { AppTheme } from "@/constants/theme";

type Props = ViewProps & {
  tone?: "default" | "hero" | "soft" | "muted";
};

export function AppCard({ style, tone = "default", ...props }: Props) {
  return (
    <View
      style={[
        styles.base,
        tone === "hero" ? styles.hero : undefined,
        tone === "soft" ? styles.soft : undefined,
        tone === "muted" ? styles.muted : undefined,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    padding: AppTheme.spacing.xl,
    ...AppTheme.shadow.sm,
  },
  hero: {
    backgroundColor: AppTheme.colors.primary,
    borderColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radius.xl,
    padding: AppTheme.spacing.xl,
    ...AppTheme.shadow.md,
  },
  soft: {
    backgroundColor: AppTheme.colors.surfaceMuted,
  },
  muted: {
    backgroundColor: AppTheme.colors.backgroundMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
});
