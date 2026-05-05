import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppTheme } from "@/constants/theme";

type Props = {
  title: string;
  hint?: string;
  rightSlot?: ReactNode;
};

export function SectionHeader({ title, hint, rightSlot }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {rightSlot ? <View>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: AppTheme.spacing.md,
    marginBottom: AppTheme.spacing.md,
  },
  copy: {
    flex: 1,
  },
  title: {
    ...AppTheme.typography.titleSm,
  },
  hint: {
    ...AppTheme.typography.bodySm,
    marginTop: AppTheme.spacing.xs,
  },
});
