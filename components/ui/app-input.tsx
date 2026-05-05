import { Ionicons } from "@expo/vector-icons";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from "react-native";

import { AppTheme } from "@/constants/theme";

type Props = TextInputProps & {
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  onTrailingPress?: () => void;
};

export function AppInput({ style, trailingIcon, onTrailingPress, ...props }: Props) {
  return (
    <View style={styles.wrap}>
      <TextInput
        placeholderTextColor={AppTheme.colors.textSoft}
        style={[styles.input, style]}
        {...props}
      />
      {trailingIcon ? (
        <TouchableOpacity onPress={onTrailingPress} hitSlop={10}>
          <Ionicons name={trailingIcon} size={20} color={AppTheme.colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.sm,
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    paddingHorizontal: AppTheme.spacing.lg,
    ...AppTheme.shadow.sm,
  },
  input: {
    flex: 1,
    minHeight: 58,
    color: AppTheme.colors.text,
    fontFamily: AppTheme.fonts.medium,
    fontSize: 15,
    lineHeight: 22,
  },
});
