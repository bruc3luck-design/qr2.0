import { Platform, StyleSheet, type TextStyle, type ViewStyle } from "react-native";

export const AppPalette = {
  primary: "#102A43",
  primarySoft: "#E8EFF7",
  primaryMuted: "#36597C",
  primaryStrong: "#0A1C2E",
  background: "#FFFFFF",
  backgroundMuted: "#F5F8FC",
  surface: "#FFFFFF",
  surfaceMuted: "#F8FBFF",
  border: "#D7E1EC",
  borderStrong: "#BDCBDA",
  text: "#0F2238",
  textMuted: "#5F7388",
  textSoft: "#90A1B4",
  success: "#1F8F65",
  successSoft: "#E1F7EF",
  warning: "#C17A17",
  warningSoft: "#FFF3DF",
  danger: "#C24D4D",
  dangerSoft: "#FCE9E9",
  info: "#173B60",
  white: "#FFFFFF",
  overlay: "rgba(15, 34, 56, 0.55)",
  shadow: "#08131F",
};

export const AppSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
} as const;

export const AppRadius = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const AppFonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
  extrabold: "Poppins_800ExtraBold",
} as const;

const createType = (
  fontFamily: string,
  fontSize: number,
  lineHeight: number,
  color = AppPalette.text,
  extra?: TextStyle
) =>
  ({
    fontFamily,
    fontSize,
    lineHeight,
    color,
    ...extra,
  }) satisfies TextStyle;

export const AppTypography = {
  eyebrow: createType(AppFonts.semibold, 12, 18, AppPalette.textMuted, {
    letterSpacing: 0.6,
    textTransform: "uppercase",
  }),
  label: createType(AppFonts.medium, 12, 18, AppPalette.textMuted),
  bodySm: createType(AppFonts.regular, 13, 20, AppPalette.textMuted),
  body: createType(AppFonts.regular, 14, 22, AppPalette.text),
  bodyStrong: createType(AppFonts.semibold, 14, 22, AppPalette.text),
  titleSm: createType(AppFonts.semibold, 18, 26),
  title: createType(AppFonts.bold, 24, 32),
  display: createType(AppFonts.extrabold, 32, 40, AppPalette.text, {
    letterSpacing: -0.8,
  }),
  metric: createType(AppFonts.extrabold, 28, 34),
  button: createType(AppFonts.semibold, 15, 22, AppPalette.white),
} as const;

export const AppShadow = {
  sm: Platform.select<ViewStyle>({
    ios: {
      shadowColor: AppPalette.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.06,
      shadowRadius: 18,
    },
    android: {
      elevation: 3,
    },
    default: {},
  }) as ViewStyle,
  md: Platform.select<ViewStyle>({
    ios: {
      shadowColor: AppPalette.shadow,
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.1,
      shadowRadius: 28,
    },
    android: {
      elevation: 6,
    },
    default: {},
  }) as ViewStyle,
} as const;

export const AppTheme = {
  colors: AppPalette,
  spacing: AppSpacing,
  radius: AppRadius,
  typography: AppTypography,
  fonts: AppFonts,
  shadow: AppShadow,
} as const;

export const AppSurface = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppPalette.background,
  },
  page: {
    paddingHorizontal: AppSpacing["2xl"],
    paddingTop: AppSpacing.lg,
    paddingBottom: AppSpacing["3xl"],
  },
  card: {
    backgroundColor: AppPalette.surface,
    borderRadius: AppRadius.lg,
    borderWidth: 1,
    borderColor: AppPalette.border,
    padding: AppSpacing.lg,
    ...AppShadow.sm,
  },
  cardMuted: {
    backgroundColor: AppPalette.backgroundMuted,
    borderRadius: AppRadius.lg,
    borderWidth: 1,
    borderColor: AppPalette.border,
    padding: AppSpacing.lg,
  },
  heroCard: {
    backgroundColor: AppPalette.primary,
    borderRadius: AppRadius.xl,
    padding: AppSpacing.xl,
    ...AppShadow.md,
  },
  input: {
    backgroundColor: AppPalette.surface,
    borderRadius: AppRadius.md,
    borderWidth: 1,
    borderColor: AppPalette.border,
    paddingHorizontal: AppSpacing.lg,
    paddingVertical: 16,
    color: AppPalette.text,
  },
});

export const Colors = {
  light: {
    text: AppPalette.text,
    background: AppPalette.background,
    tint: AppPalette.primary,
    icon: AppPalette.textMuted,
    tabIconDefault: AppPalette.textSoft,
    tabIconSelected: AppPalette.primary,
  },
  dark: {
    text: AppPalette.text,
    background: AppPalette.background,
    tint: AppPalette.primary,
    icon: AppPalette.textMuted,
    tabIconDefault: AppPalette.textSoft,
    tabIconSelected: AppPalette.primary,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: AppFonts.regular,
    serif: "Times New Roman",
    rounded: AppFonts.medium,
    mono: "Menlo",
  },
  android: {
    sans: AppFonts.regular,
    serif: "serif",
    rounded: AppFonts.medium,
    mono: "monospace",
  },
  default: {
    sans: AppFonts.regular,
    serif: "serif",
    rounded: AppFonts.medium,
    mono: "monospace",
  },
  web: {
    sans: AppFonts.regular,
    serif: "Georgia, serif",
    rounded: AppFonts.medium,
    mono: "'SFMono-Regular', Consolas, monospace",
  },
});
