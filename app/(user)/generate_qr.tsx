import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import QRCode from "react-native-qrcode-svg";

import { AppButton } from "../../components/ui/app-button";
import { AppCard } from "../../components/ui/app-card";
import { InfoCard } from "../../components/ui/info-card";
import { PageHeader } from "../../components/ui/page-header";
import { ScreenShell } from "../../components/ui/screen-shell";
import { UserBottomNav } from "../../components/user-bottom-nav";
import { AppTheme } from "../../constants/theme";
import { useFeatureBack } from "../../hooks/use-feature-back";
import { saveImageToGallery, writeBase64ImageToCache } from "../../lib/device-files";
import { supabase } from "../../lib/supabase";

type Profile = {
  id: string;
  nama: string;
  kelas: string;
};

export default function GenerateQR() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const qrCodeRef = useRef<any>(null);
  const handleBack = useFeatureBack({ fallbackRoute: "/user" });

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id,nama,kelas")
          .eq("id", user.id)
          .single();
        if (error) throw error;
        setProfile(data);
      }
    } catch {
      setProfile(null);
    }
    setLoading(false);
  };

  const downloadQR = async () => {
    if (!qrCodeRef.current) {
      Alert.alert("QR belum siap");
      return;
    }

    try {
      setDownloading(true);

      const qrBase64 = await new Promise<string>((resolve, reject) => {
        try {
          qrCodeRef.current?.toDataURL?.((data: string) => {
            if (!data) {
              reject(new Error("QR kosong"));
              return;
            }

            resolve(data);
          });
        } catch (error) {
          reject(error);
        }
      });

      if (!qrBase64) {
        Alert.alert("Gagal mengambil QR");
        return;
      }

      if (Platform.OS === "web") {
        const response = await fetch(`data:image/png;base64,${qrBase64}`);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `qr_${profile?.nama?.replace(/\s+/g, "_").toLowerCase() || "siswa"}.png`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      } else {
        const uri = await writeBase64ImageToCache(
          `qr_${profile?.nama?.replace(/\s+/g, "_").toLowerCase() || "siswa"}.png`,
          qrBase64
        );
        await saveImageToGallery(uri);
      }

      Alert.alert("Berhasil", "QR berhasil disimpan ke galeri.");
    } catch {
      Alert.alert("Gagal menyimpan QR");
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    fetchProfile();

    let subscription: any = null;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      subscription = supabase
        .channel("realtime-profile-" + user.id)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`
          },
          () => fetchProfile()
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, []);

  if (loading)
    return <ActivityIndicator size="large" style={styles.centered} color={AppTheme.colors.primary} />;

  if (!profile)
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Data QR belum tersedia</Text>
        <Text style={styles.emptyCaption}>Akun ini belum memiliki profil siswa yang dapat dicetak.</Text>
      </View>
    );

  return (
    <ScreenShell scroll footer={<UserBottomNav activeKey="generate_qr" />}>
      <View style={styles.shell}>
        <PageHeader eyebrow="Kartu QR siswa" title="Kode QR" onBackPress={handleBack} />

        <InfoCard
          title="Kartu QR digital"
          description="Simpan QR ini ke galeri untuk dicetak atau ditunjukkan saat pemindaian absensi harian."
        />

        <AppCard style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardEyebrow}>QRensi card</Text>
            <Text style={styles.name}>{profile.nama}</Text>
            <Text style={styles.className}>Kelas {profile.kelas}</Text>
          </View>

          <View style={styles.qrFrame}>
            <QRCode
              value={profile.id}
              size={208}
              getRef={(ref) => {
                qrCodeRef.current = ref;
              }}
            />
          </View>
          <Text style={styles.caption}>
            Cetak kartu ini dan simpan di holder siswa agar proses scan setiap hari lebih cepat dan konsisten.
          </Text>
        </AppCard>

        <AppButton
          label={downloading ? "Mengunduh..." : "Unduh QR"}
          onPress={downloadQR}
          disabled={downloading}
          icon="download-outline"
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: AppTheme.spacing.sm,
    paddingHorizontal: AppTheme.spacing["3xl"],
    backgroundColor: AppTheme.colors.background,
  },
  emptyTitle: {
    ...AppTheme.typography.titleSm,
    textAlign: "center",
  },
  emptyCaption: {
    ...AppTheme.typography.body,
    textAlign: "center",
    color: AppTheme.colors.textMuted,
  },
  shell: {
    gap: AppTheme.spacing.lg,
  },
  card: {
    alignItems: "center",
    gap: AppTheme.spacing.xl,
  },
  cardHeader: {
    alignItems: "center",
    gap: AppTheme.spacing.xs,
  },
  cardEyebrow: {
    ...AppTheme.typography.eyebrow,
    color: AppTheme.colors.primary,
  },
  name: {
    ...AppTheme.typography.title,
    textAlign: "center",
  },
  className: {
    ...AppTheme.typography.body,
    color: AppTheme.colors.textMuted,
  },
  qrFrame: {
    padding: AppTheme.spacing.lg,
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  caption: {
    ...AppTheme.typography.bodySm,
    textAlign: "center",
  },
});
