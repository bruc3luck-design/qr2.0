import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View, type ScrollViewProps, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { AppTheme } from "@/constants/theme";

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
  scrollProps?: Omit<ScrollViewProps, "contentContainerStyle">;
  viewProps?: ViewProps;
};

export function ScreenShell({
  children,
  footer,
  scroll = false,
  edges = ["top"],
  contentContainerStyle,
  scrollProps,
  viewProps,
}: Props) {
  const { style: viewStyle, ...restViewProps } = viewProps || {};

  return (
    <SafeAreaView edges={edges} style={styles.screen}>
      <>
        {scroll ? (
          <ScrollView
            style={styles.screen}
            contentContainerStyle={[styles.content, contentContainerStyle]}
            showsVerticalScrollIndicator={false}
            {...scrollProps}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, { flex: 1 }, viewStyle]} {...restViewProps}>
            {children}
          </View>
        )}
        {footer}
      </>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
  },
  content: {
    paddingHorizontal: AppTheme.spacing["2xl"],
    paddingTop: AppTheme.spacing.lg,
    paddingBottom: AppTheme.spacing["3xl"],
  },
});
