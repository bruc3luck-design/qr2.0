import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View, type TouchableOpacityProps } from "react-native";

import { AppTheme } from "@/constants/theme";

type Props = TouchableOpacityProps & {
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  icon?: keyof typeof Ionicons.glyphMap;
};

export function AppButton({ label, variant = "primary", icon, style, ...props }: Props) {
  const secondary = variant === "secondary";
  const danger = variant === "danger";
  const ghost = variant === "ghost";
  const iconColor = secondary || ghost ? AppTheme.colors.primary : AppTheme.colors.white;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[
        styles.base,
        secondary ? styles.secondary : undefined,
        danger ? styles.danger : undefined,
        ghost ? styles.ghost : undefined,
        props.disabled ? styles.disabled : undefined,
        style,
      ]}
      {...props}
    >
      <View style={styles.content}>
        {icon ? (
          <Ionicons name={icon} size={18} color={iconColor} />
        ) : null}
        <Text
          style={[
            styles.label,
            (secondary || ghost) ? styles.labelSecondary : undefined,
          ]}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: AppTheme.spacing.xl,
    borderWidth: 1,
    borderColor: AppTheme.colors.primary,
    ...AppTheme.shadow.sm,
  },
  secondary: {
    backgroundColor: AppTheme.colors.primarySoft,
    borderColor: AppTheme.colors.primarySoft,
  },
  danger: {
    backgroundColor: AppTheme.colors.danger,
    borderColor: AppTheme.colors.danger,
  },
  ghost: {
    backgroundColor: AppTheme.colors.white,
    borderColor: AppTheme.colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  disabled: {
    opacity: 0.55,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: AppTheme.spacing.sm,
  },
  label: {
    ...AppTheme.typography.button,
  },
  labelSecondary: {
    color: AppTheme.colors.primary,
  },
});
