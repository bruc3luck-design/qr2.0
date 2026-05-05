import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { AdminBottomNav } from "../../components/admin-bottom-nav";
import { useFeatureBack } from "../../hooks/use-feature-back";
import { AppTheme } from "../../constants/theme";
import { InfoCard } from "../../components/ui/info-card";
import { ModalCard } from "../../components/ui/modal-card";
import { PageHeader } from "../../components/ui/page-header";
import { ScreenShell } from "../../components/ui/screen-shell";
import {
  formatSubmissionDateTime,
  formatSubmissionTime,
  getSubmissionDisplayNote,
  getSubmissionDisplayType,
  getSubmissionStatusLabel,
  isPasswordRequest,
  PASSWORD_REQUEST_TYPE,
  parsePasswordRequestNote,
} from "../../lib/pengajuan";

type Pengajuan = {
  id: string;
  user_id: string;
  nama: string;
  kelas: string;
  jenis: string;
  keterangan: string;
  status: string;
  created_at: string;
  buktiUrl?: string | null;
};

const getStatusColor = (status: string) => {
  if (status === "approved") return AppTheme.colors.success;
  if (status === "rejected") return AppTheme.colors.danger;
  return AppTheme.colors.warning;
};

export default function PengajuanAdmin() {
  const [pengajuanList, setPengajuanList] = useState<Pengajuan[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const handleBack = useFeatureBack({
    fallbackRoute: "/admin",
    beforeBack: () => {
      if (previewUrl) {
        setPreviewUrl(null);
        return true;
      }

      return false;
    },
  });

  const getProofUrl = async (pengajuanId: string) => {
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from("bukti-ajuan")
      .list("pengajuan", {
        search: pengajuanId,
      });

    if (listError) {
      return null;
    }

    const proofFile = files?.find(
      (file) => file.name === pengajuanId || file.name.startsWith(`${pengajuanId}.`)
    );

    if (!proofFile) {
      return null;
    }

    const filePath = `pengajuan/${proofFile.name}`;
    const { data, error } = await supabaseAdmin.storage
      .from("bukti-ajuan")
      .createSignedUrl(filePath, 3600);

    if (error) {
      return null;
    }

    return data?.signedUrl || null;
  };

  const fetchPengajuan = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseAdmin
        .from("pengajuan")
        .select("*")
        .eq("status", "pending")
        .neq("jenis", PASSWORD_REQUEST_TYPE)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const withProof = await Promise.all(
        (data || []).map(async (item) => ({
          ...item,
          buktiUrl: isPasswordRequest(item.jenis) ? null : await getProofUrl(item.id),
        }))
      );

      setPengajuanList(withProof);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let realtimeChannel: any;

    const setupRealtime = async () => {
      await fetchPengajuan();
      realtimeChannel = supabase
        .channel("public:pengajuan")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "pengajuan" },
          () => {
            fetchPengajuan();
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    };
  }, [fetchPengajuan]);

  const approvePengajuan = async (item: Pengajuan) => {
    Alert.alert(
      "Konfirmasi Persetujuan",
      `Setujui pengajuan "${getSubmissionDisplayType(item.jenis)}" untuk ${item.nama}?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Iya",
          onPress: async () => {
            try {
              setProcessingId(item.id);

              if (isPasswordRequest(item.jenis)) {
                const passwordPayload = parsePasswordRequestNote(item.keterangan);
                if (!passwordPayload?.password) {
                  throw new Error("Data password baru tidak ditemukan.");
                }

                const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
                  item.user_id,
                  { password: passwordPayload.password }
                );

                if (passwordError) throw passwordError;
              } else {
                const today = new Date();
                const tanggal = today.toISOString().split("T")[0];
                const waktu = today.toTimeString().split(" ")[0];

                const { data: existingAbsensi, error: absensiError } = await supabaseAdmin
                  .from("absensi")
                  .select("*")
                  .eq("user_id", item.user_id)
                  .eq("tanggal", tanggal)
                  .maybeSingle();

                if (absensiError) throw absensiError;

                if (existingAbsensi) {
                  await supabaseAdmin
                    .from("absensi")
                    .update({ status: item.jenis, waktu })
                    .eq("id", existingAbsensi.id)
                    .throwOnError();
                } else {
                  await supabaseAdmin
                    .from("absensi")
                    .insert([
                      {
                        user_id: item.user_id,
                        nama: item.nama,
                        kelas: item.kelas,
                        tanggal,
                        waktu,
                        status: item.jenis,
                      },
                    ])
                    .throwOnError();
                }
              }

              await supabaseAdmin
                .from("pengajuan")
                .update({ status: "approved" })
                .eq("id", item.id)
                .throwOnError();

              setPengajuanList((prev) => prev.filter((submission) => submission.id !== item.id));
              Alert.alert("Berhasil", "Pengajuan berhasil disetujui.");
            } catch (err: any) {
              Alert.alert("Error", err.message);
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const rejectPengajuan = async (item: Pengajuan) => {
    Alert.alert(
      "Konfirmasi Penolakan",
      `Tolak pengajuan "${getSubmissionDisplayType(item.jenis)}" untuk ${item.nama}?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Iya",
          onPress: async () => {
            try {
              setProcessingId(item.id);
              await supabaseAdmin
                .from("pengajuan")
                .update({ status: "rejected" })
                .eq("id", item.id)
                .throwOnError();

              setPengajuanList((prev) => prev.filter((submission) => submission.id !== item.id));
              Alert.alert("Berhasil", "Pengajuan berhasil ditolak.");
            } catch (err: any) {
              Alert.alert("Error", err.message);
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPengajuan();
    setRefreshing(false);
  };

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} color={AppTheme.colors.primary} />;

  return (
    <ScreenShell
      scroll
      footer={<AdminBottomNav activeKey="pengajuan" />}
      scrollProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />,
      }}
    >
      <View style={styles.shell}>
        <PageHeader eyebrow="Review admin" title="Daftar Pengajuan" onBackPress={handleBack} />

        <InfoCard
          title="Permintaan yang menunggu persetujuan"
          description="Admin bisa menyetujui izin, sakit, dan permintaan ganti password dari halaman ini."
        />

        {pengajuanList.length === 0 && (
          <Text style={styles.noDataText}>Tidak ada pengajuan pending.</Text>
        )}

        {pengajuanList.map((item) => {
          const statusColor = getStatusColor(item.status);

          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.topBadgeRow}>
                <Text style={styles.userName}>{item.nama}</Text>
                <View style={styles.typePill}>
                  <Text style={styles.typePillText}>{getSubmissionDisplayType(item.jenis)}</Text>
                </View>
              </View>

              <Text style={styles.userInfo}>Kelas {item.kelas}</Text>
              <Text style={styles.userInfo}>Tanggal pengajuan: {formatSubmissionDateTime(item.created_at)}</Text>
              <Text style={styles.userInfoStrong}>Jam pengajuan: {formatSubmissionTime(item.created_at)}</Text>
              <Text style={styles.keterangan}>{getSubmissionDisplayNote(item.jenis, item.keterangan)}</Text>

              <View style={[styles.statusPill, { backgroundColor: `${statusColor}22` }]}>
                <Text style={[styles.statusPillText, { color: statusColor }]}>
                  {getSubmissionStatusLabel(item.status)}
                </Text>
              </View>

              {item.buktiUrl ? (
                <TouchableOpacity style={styles.proofButton} onPress={() => setPreviewUrl(item.buktiUrl || null)}>
                  <Ionicons name="image-outline" size={16} color="#16324f" />
                  <Text style={styles.proofButtonText}>Lihat Bukti Foto</Text>
                </TouchableOpacity>
              ) : isPasswordRequest(item.jenis) ? (
                <Text style={styles.noProofText}>Tidak memerlukan bukti foto.</Text>
              ) : (
                <Text style={styles.noProofText}>Belum ada bukti foto.</Text>
              )}

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.approveButton, processingId === item.id && styles.disabledButton]}
                  onPress={() => approvePengajuan(item)}
                  disabled={processingId === item.id}
                >
                  <Text style={styles.buttonText}>Approve</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.rejectButton, processingId === item.id && styles.disabledButton]}
                  onPress={() => rejectPengajuan(item)}
                  disabled={processingId === item.id}
                >
                  <Text style={styles.buttonText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      <Modal transparent animationType="fade" visible={!!previewUrl} onRequestClose={() => setPreviewUrl(null)}>
        <View style={styles.modalOverlay}>
          <ModalCard>
            <TouchableOpacity style={styles.modalClose} onPress={() => setPreviewUrl(null)}>
              <Ionicons name="close" size={18} color="#16324f" />
            </TouchableOpacity>
            {previewUrl ? <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="contain" /> : null}
          </ModalCard>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  shell: { gap: AppTheme.spacing.lg },
  noDataText: { ...AppTheme.typography.body, textAlign: "center", color: AppTheme.colors.textMuted },
  card: {
    backgroundColor: AppTheme.colors.surface,
    padding: AppTheme.spacing.xl,
    borderRadius: AppTheme.radius.lg,
    gap: AppTheme.spacing.sm,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    ...AppTheme.shadow.sm,
  },
  topBadgeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: AppTheme.spacing.sm },
  userName: { ...AppTheme.typography.titleSm, flex: 1 },
  typePill: { backgroundColor: AppTheme.colors.primarySoft, paddingHorizontal: AppTheme.spacing.md, paddingVertical: AppTheme.spacing.sm, borderRadius: AppTheme.radius.pill },
  typePillText: { ...AppTheme.typography.bodyStrong, color: AppTheme.colors.primary },
  userInfo: { ...AppTheme.typography.bodySm, color: AppTheme.colors.textMuted },
  userInfoStrong: { ...AppTheme.typography.bodyStrong, marginBottom: AppTheme.spacing.xs },
  keterangan: { ...AppTheme.typography.body, marginBottom: AppTheme.spacing.sm },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: AppTheme.radius.pill,
    marginBottom: AppTheme.spacing.sm,
  },
  statusPillText: {
    fontFamily: AppTheme.fonts.semibold,
    fontSize: 12,
    lineHeight: 18,
  },
  proofButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.sm,
    backgroundColor: AppTheme.colors.primarySoft,
    alignSelf: "flex-start",
    paddingHorizontal: AppTheme.spacing.md,
    paddingVertical: AppTheme.spacing.md,
    borderRadius: AppTheme.radius.sm,
    marginBottom: AppTheme.spacing.sm,
  },
  proofButtonText: { ...AppTheme.typography.bodyStrong, color: AppTheme.colors.primary },
  noProofText: { ...AppTheme.typography.bodySm, marginBottom: AppTheme.spacing.sm },
  buttonRow: { flexDirection: "row", justifyContent: "space-between" },
  approveButton: {
    flex: 1,
    backgroundColor: AppTheme.colors.success,
    paddingVertical: AppTheme.spacing.md,
    borderRadius: AppTheme.radius.sm,
    alignItems: "center",
    marginRight: AppTheme.spacing.xs,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: AppTheme.colors.danger,
    paddingVertical: AppTheme.spacing.md,
    borderRadius: AppTheme.radius.sm,
    alignItems: "center",
    marginLeft: AppTheme.spacing.xs,
  },
  buttonText: { ...AppTheme.typography.button },
  disabledButton: { backgroundColor: AppTheme.colors.textSoft },
  modalOverlay: {
    flex: 1,
    backgroundColor: AppTheme.colors.overlay,
    justifyContent: "center",
    padding: AppTheme.spacing.xl,
  },
  modalClose: {
    alignSelf: "flex-end",
    width: 36,
    height: 36,
    borderRadius: AppTheme.radius.sm,
    backgroundColor: AppTheme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: AppTheme.spacing.md,
  },
  previewImage: {
    width: "100%",
    height: 360,
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.colors.background,
  },
});
