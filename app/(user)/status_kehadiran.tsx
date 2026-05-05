import { useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppCard } from "../../components/ui/app-card";
import { InfoCard } from "../../components/ui/info-card";
import { PageHeader } from "../../components/ui/page-header";
import { ScreenShell } from "../../components/ui/screen-shell";
import { UserBottomNav } from "../../components/user-bottom-nav";
import { AppTheme } from "../../constants/theme";
import { useFeatureBack } from "../../hooks/use-feature-back";
import { getLocalDateValue } from "../../lib/date";
import { getDefaultAttendanceStatus } from "../../lib/pengajuan";
import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export default function StatusKehadiran() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const handleBack = useFeatureBack({ fallbackRoute: "/user" });

  const refreshFallbackStatus = () => {
    setStatus((prev) =>
      prev === "Belum Absen" || prev === "Tidak Hadir" ? getDefaultAttendanceStatus() : prev
    );
  };

  useEffect(() => {
    getStatus();

    let subscription: any = null;

    const setupRealtime = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) return;

      const today = getLocalDateValue();

      subscription = supabase
        .channel(`public:absensi:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "absensi",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const nextRow = payload.new as { status?: string; tanggal?: string } | undefined
            if (nextRow?.tanggal === today) {
              setStatus(nextRow.status || getDefaultAttendanceStatus());
            }
          }
        )
        .subscribe();
    };

    setupRealtime();
    const cutoffWatcher = setInterval(refreshFallbackStatus, 30000);

    return () => {
      clearInterval(cutoffWatcher);
      if (subscription) supabase.removeChannel(subscription);
    };
  }, []);

  const getStatus = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (!userId) {
      setStatus("User tidak ditemukan");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const today = getLocalDateValue();

    const { data, error } = await supabaseAdmin
      .from("absensi")
      .select("*")
      .eq("user_id", userId)
      .eq("tanggal", today)
      .maybeSingle()

    setStatus(error || !data ? getDefaultAttendanceStatus() : data.status || getDefaultAttendanceStatus());

    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    getStatus();
  };

  const normalizedStatus = status.toLowerCase();
  const statusTheme =
    normalizedStatus === "hadir"
      ? {
          background: AppTheme.colors.successSoft,
          foreground: AppTheme.colors.success,
          icon: "checkmark-circle-outline" as const,
          note: "Kehadiranmu sudah tercatat hari ini.",
        }
      : normalizedStatus === "izin" || normalizedStatus === "sakit"
        ? {
            background: AppTheme.colors.warningSoft,
            foreground: AppTheme.colors.warning,
            icon: "document-text-outline" as const,
            note: "Status ketidakhadiran sudah diperbarui.",
          }
        : normalizedStatus === "tidak hadir"
          ? {
              background: AppTheme.colors.dangerSoft,
              foreground: AppTheme.colors.danger,
              icon: "alert-circle-outline" as const,
              note: "Batas absensi sudah lewat dan belum ada kehadiran atau izin yang disetujui.",
            }
          : {
              background: AppTheme.colors.primarySoft,
              foreground: AppTheme.colors.primary,
              icon: "qr-code-outline" as const,
              note: "Silakan lakukan scan QR untuk mencatat kehadiran.",
            };

  return (
    <ScreenShell
      scroll
      footer={<UserBottomNav activeKey="status_kehadiran" />}
      scrollProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />,
      }}
    >
      <View style={styles.shell}>
        <PageHeader eyebrow="Presensi hari ini" title="Status Kehadiran" onBackPress={handleBack} />

        <InfoCard
          title="Ringkasan status harian"
          description="Halaman ini menampilkan hasil presensi terbaru yang tersimpan untuk hari ini secara realtime."
        />

        <AppCard style={styles.card}>
          <Text style={styles.dateLabel}>
            {new Date().toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>

          {loading ? (
            <ActivityIndicator size="large" color={AppTheme.colors.primary} style={styles.loader} />
          ) : (
            <>
              <View style={[styles.statusBlock, { backgroundColor: statusTheme.background }]}>
                <View style={[styles.statusIcon, { backgroundColor: `${statusTheme.foreground}18` }]}>
                  <Ionicons name={statusTheme.icon} size={22} color={statusTheme.foreground} />
                </View>
                <Text style={[styles.statusText, { color: statusTheme.foreground }]}>{status}</Text>
              </View>
              <Text style={styles.note}>{statusTheme.note}</Text>
            </>
          )}

          <View style={styles.detailCard}>
            <Row label="Kelas" value="Siswa Aktif" />
            <Row label="Metode" value="Scan QR" />
            <Row label="Sinkronisasi" value="Realtime" />
          </View>
        </AppCard>
      </View>
    </ScreenShell>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  shell: {
    gap: AppTheme.spacing.lg,
  },
  card: {
    gap: AppTheme.spacing.xl,
  },
  dateLabel: {
    ...AppTheme.typography.bodySm,
    textAlign: "center",
  },
  loader: {
    marginVertical: AppTheme.spacing.lg,
  },
  statusBlock: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: AppTheme.spacing["2xl"],
    borderRadius: AppTheme.radius.xl,
    gap: AppTheme.spacing.md,
  },
  statusIcon: {
    width: 52,
    height: 52,
    borderRadius: AppTheme.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    fontFamily: AppTheme.fonts.extrabold,
    fontSize: 24,
    lineHeight: 32,
    textTransform: "capitalize",
    textAlign: "center",
  },
  note: {
    ...AppTheme.typography.body,
    textAlign: "center",
    color: AppTheme.colors.textMuted,
  },
  detailCard: {
    backgroundColor: AppTheme.colors.backgroundMuted,
    borderRadius: AppTheme.radius.lg,
    padding: AppTheme.spacing.lg,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: AppTheme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.colors.border,
  },
  rowLabel: {
    ...AppTheme.typography.bodySm,
  },
  rowValue: {
    ...AppTheme.typography.bodyStrong,
  },
});
