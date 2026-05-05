import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useState } from "react";

import { AdminBottomNav } from "../../components/admin-bottom-nav";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { useFeatureBack } from "../../hooks/use-feature-back";
import { getLocalDateValue } from "../../lib/date";
import { AppTheme } from "../../constants/theme";
import { AppButton } from "../../components/ui/app-button";
import { AppCard } from "../../components/ui/app-card";
import { InfoCard } from "../../components/ui/info-card";
import { PageHeader } from "../../components/ui/page-header";
import { ScreenShell } from "../../components/ui/screen-shell";
import { getSubmissionCutoffLabel, isPastSubmissionCutoff } from "../../lib/pengajuan";

export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [statusColor, setStatusColor] = useState("");
  const handleBack = useFeatureBack({ fallbackRoute: "/admin" });
  const attendanceClosed = isPastSubmissionCutoff();

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <AppCard style={styles.permissionCard}>
          <View style={styles.permissionIcon}>
            <Ionicons name="camera-outline" size={34} color={AppTheme.colors.primary} />
          </View>
          <Text style={styles.permissionTitle}>Akses kamera diperlukan</Text>
          <Text style={styles.permissionText}>
            Izinkan kamera agar admin dapat memindai kartu QR siswa secara langsung dari dashboard.
          </Text>
          <AppButton label="Izinkan Kamera" onPress={requestPermission} style={styles.permissionButton} />
        </AppCard>
      </View>
    );
  }

  const handleScan = async ({ data }: any) => {
    setScanned(true);

    if (attendanceClosed) {
      setStatusText(`Waktu kehadiran sudah habis. Scan hanya tersedia sampai jam ${getSubmissionCutoffLabel()}.`);
      setStatusColor(AppTheme.colors.danger);
      return;
    }

    const uid = String(data || "").trim();

    if (!uid) {
      setStatusText("QR tidak valid");
      setStatusColor(AppTheme.colors.danger);
      return;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();

    if (profileError || !profile) {
      setStatusText("User tidak ditemukan");
      setStatusColor(AppTheme.colors.danger);
      return;
    }

    const today = getLocalDateValue();

    const { data: cek, error: cekError } = await supabaseAdmin
      .from("absensi")
      .select("*")
      .eq("user_id", uid)
      .eq("tanggal", today)
      .maybeSingle();

    if (cekError) {
      setStatusText("Gagal memeriksa absensi");
      setStatusColor(AppTheme.colors.danger);
      return;
    }

    if (cek) {
      if (cek.status === "hadir") {
        setStatusText(profile.nama + " sudah hadir hari ini");
        setStatusColor(AppTheme.colors.warning);
        return;
      }

      const waktu = new Date().toTimeString().split(" ")[0];
      const { error: updateError } = await supabaseAdmin
        .from("absensi")
        .update({ status: "hadir", waktu })
        .eq("id", cek.id);

      if (updateError) {
        setStatusText("Gagal memperbarui absensi");
        setStatusColor(AppTheme.colors.danger);
        return;
      }

      setStatusText(profile.nama + " berhasil diubah menjadi hadir");
      setStatusColor(AppTheme.colors.success);
      return;
    }

    const waktu = new Date().toTimeString().split(" ")[0];

    const { error } = await supabaseAdmin
      .from("absensi")
      .insert({
        user_id: uid,
        nama: profile.nama,
        kelas: profile.kelas,
        tanggal: today,
        waktu,
        status: "hadir"
      });

    if (error) {
      setStatusText("Gagal menyimpan absensi");
      setStatusColor(AppTheme.colors.danger);
    } else {
      setStatusText(profile.nama + " berhasil absen");
      setStatusColor(AppTheme.colors.success);
    }
  };

  return (
    <ScreenShell viewProps={{ style: styles.container }} footer={<AdminBottomNav activeKey="scanner" />}>
      <View style={styles.shell}>
        <PageHeader eyebrow="Pemindaian cepat" title="Scan QR Absensi" onBackPress={handleBack} />

        <InfoCard
          title="Arahkan kamera ke kartu QR siswa"
          description={
            attendanceClosed
              ? `Waktu kehadiran sudah habis. Pemindaian QR ditutup setelah jam ${getSubmissionCutoffLabel()}.`
              : `Sistem akan membaca kode dan langsung mencatat kehadiran bila data valid sebelum jam ${getSubmissionCutoffLabel()}.`
          }
        />

        <View style={styles.cameraContainer}>
          {attendanceClosed ? (
            <View style={styles.closedState}>
              <Ionicons name="time-outline" size={54} color={AppTheme.colors.danger} />
              <Text style={styles.closedTitle}>Waktu Kehadiran Sudah Habis</Text>
              <Text style={styles.closedText}>
                Pemindaian QR untuk absensi hari ini ditutup setelah jam {getSubmissionCutoffLabel()}.
              </Text>
            </View>
          ) : (
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{
                barcodeTypes: ["qr"]
              }}
              onBarcodeScanned={scanned ? undefined : handleScan}
            />
          )}
          {!attendanceClosed ? <View style={styles.scanFrame} /> : null}
        </View>

        {statusText !== "" && (
          <View style={[styles.statusBox, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        )}

        {scanned && (
          <AppButton
            label="Scan Lagi"
            style={styles.button}
            onPress={() => {
              setScanned(false);
              setStatusText("");
            }}
          />
        )}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: AppTheme.spacing.lg,
  },
  shell: {
    flex: 1,
    gap: AppTheme.spacing.lg,
  },
  cameraContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderRadius: AppTheme.radius.xl,
    backgroundColor: AppTheme.colors.surface,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    ...AppTheme.shadow.sm,
  },
  camera: {
    width: "100%",
    height: "100%",
    borderRadius: AppTheme.radius.xl,
  },
  scanFrame: {
    position: "absolute",
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: AppTheme.colors.primarySoft,
    borderRadius: AppTheme.radius.lg,
  },
  closedState: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  closedTitle: {
    ...AppTheme.typography.title,
    marginTop: AppTheme.spacing.lg,
    textAlign: "center",
  },
  closedText: {
    ...AppTheme.typography.body,
    marginTop: AppTheme.spacing.sm,
    textAlign: "center",
  },
  statusBox: {
    padding: AppTheme.spacing.lg,
    borderRadius: AppTheme.radius.md,
    alignItems: "center",
    ...AppTheme.shadow.sm,
  },
  statusText: {
    color: AppTheme.colors.white,
    fontFamily: AppTheme.fonts.semibold,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  button: {
    marginTop: "auto",
  },
  permissionButton: {
    alignSelf: "stretch",
  },
  permissionScreen: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
    padding: AppTheme.spacing.xl,
    justifyContent: "center",
  },
  permissionCard: {
    alignItems: "center",
    gap: AppTheme.spacing.md,
  },
  permissionIcon: {
    width: 68,
    height: 68,
    borderRadius: AppTheme.radius.lg,
    backgroundColor: AppTheme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionTitle: {
    ...AppTheme.typography.titleSm,
    textAlign: "center",
  },
  permissionText: {
    ...AppTheme.typography.body,
    color: AppTheme.colors.textMuted,
    textAlign: "center",
  },
});
