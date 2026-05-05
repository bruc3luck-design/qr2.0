import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppTheme } from "../constants/theme";

const items = [
  { key: "status_kehadiran", label: "Status", icon: "checkmark-done-outline", route: "/status_kehadiran" },
  { key: "riwayat_kehadiran", label: "Riwayat", icon: "time-outline", route: "/riwayat_kehadiran" },
  { key: "user", label: "Home", icon: "home", route: "/user" },
  { key: "ajuan", label: "Izin", icon: "document-text-outline", route: "/ajuan" },
  { key: "generate_qr", label: "Kode QR", icon: "qr-code-outline", route: "/generate_qr" },
];

type Props = {
  activeKey: string
}

export function UserBottomNav({ activeKey }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      {items.map((item) => {
        const active = item.key === activeKey;
        const isHome = item.key === "user";

        return (
          <TouchableOpacity
            key={item.key}
            style={styles.item}
            onPress={() => router.replace(item.route as any)}
            activeOpacity={0.9}
          >
            <View
              style={[
                styles.iconWrap,
                active && styles.iconWrapActive,
                isHome && active && styles.homeIconWrap,
              ]}
            >
              <Ionicons
                name={item.icon as keyof typeof Ionicons.glyphMap}
                size={18}
                color={
                  isHome && active
                    ? AppTheme.colors.white
                    : active
                      ? AppTheme.colors.primary
                      : AppTheme.colors.textSoft
                }
              />
            </View>
            <Text
              style={[
                styles.label,
                active && styles.labelActive,
                isHome && active && styles.homeLabelActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: AppTheme.spacing.sm,
    paddingTop: AppTheme.spacing.md,
    backgroundColor: AppTheme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: AppTheme.colors.border,
    ...AppTheme.shadow.sm,
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: AppTheme.spacing.xs,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: AppTheme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  iconWrapActive: {
    backgroundColor: AppTheme.colors.primarySoft,
    borderColor: AppTheme.colors.primarySoft,
  },
  homeIconWrap: {
    backgroundColor: AppTheme.colors.primary,
    borderColor: AppTheme.colors.primary,
  },
  label: {
    fontFamily: AppTheme.fonts.medium,
    fontSize: 10,
    lineHeight: 16,
    color: AppTheme.colors.textSoft,
  },
  labelActive: {
    color: AppTheme.colors.primary,
  },
  homeLabelActive: {
    color: AppTheme.colors.primary,
    fontFamily: AppTheme.fonts.bold,
  },
});
