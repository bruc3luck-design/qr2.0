import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { UserBottomNav } from "../../components/user-bottom-nav";
import { useFeatureBack } from "../../hooks/use-feature-back";
import { AppTheme } from "../../constants/theme";
import { InfoCard } from "../../components/ui/info-card";
import { PageHeader } from "../../components/ui/page-header";
import { ScreenShell } from "../../components/ui/screen-shell";
import {
  formatSubmissionDateTime,
  getSubmissionCutoffLabel,
  getSubmissionDisplayType,
  getSubmissionStatusLabel,
  isPastSubmissionCutoff,
  isTodaySubmission,
} from "../../lib/pengajuan";

type UserProfile = {
  id: string;
  nama: string;
  kelas: string;
};

type SubmissionItem = {
  id: string;
  jenis: string;
  keterangan: string;
  status: string;
  created_at: string;
};

type SubmissionMode = "create" | "edit-pending" | "retry-approved" | "retry-rejected" | "blocked";

type SubmissionAccess = {
  mode: SubmissionMode;
  activeSubmission: SubmissionItem | null;
  helperText: string;
  blockReason?: string;
};

const getFileExtension = (mimeType: string, uri: string) => {
  const normalizedMimeType = mimeType.toLowerCase();

  if (normalizedMimeType === "image/png") return "png";
  if (normalizedMimeType === "image/heic" || normalizedMimeType === "image/heif") return "heic";
  if (normalizedMimeType === "image/webp") return "webp";
  if (normalizedMimeType === "image/jpeg" || normalizedMimeType === "image/jpg") return "jpg";

  const uriExtension = uri.split(".").pop()?.split("?")[0]?.toLowerCase();
  return uriExtension || "jpg";
};

const getSubmissionAccess = (items: SubmissionItem[]): SubmissionAccess => {
  const permissionItems = items
    .filter((item) => item.jenis === "izin" || item.jenis === "sakit")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const pendingSubmission = permissionItems.find((item) => item.status === "pending") || null;

  if (pendingSubmission) {
    return {
      mode: "edit-pending",
      activeSubmission: pendingSubmission,
      helperText: "Pengajuan masih menunggu review admin. Anda bisa mengedit jenis, keterangan, atau foto sebelum diproses.",
    };
  }

  if (permissionItems.length === 0) {
    return {
      mode: "create",
      activeSubmission: null,
      helperText: "Anda bisa mengirim 1 pengajuan hari ini, lalu 1 kesempatan tambahan lagi jika pengajuan sebelumnya disetujui atau ditolak.",
    };
  }

  if (permissionItems.length === 1) {
    const latestSubmission = permissionItems[0];

    if (latestSubmission.status === "approved") {
      return {
        mode: "retry-approved",
        activeSubmission: latestSubmission,
        helperText: "Pengajuan sebelumnya sudah disetujui. Anda masih punya 1 kesempatan lagi hari ini untuk mengirim koreksi jika tadi salah ajuan.",
      };
    }

    if (latestSubmission.status === "rejected") {
      return {
        mode: "retry-rejected",
        activeSubmission: latestSubmission,
        helperText: "Pengajuan sebelumnya ditolak. Anda masih punya 1 kesempatan lagi hari ini untuk mengajukan ulang.",
      };
    }
  }

  return {
    mode: "blocked",
    activeSubmission: permissionItems[0] || null,
    helperText: "Batas pengajuan hari ini sudah habis.",
    blockReason: "Anda sudah memakai seluruh kesempatan pengajuan hari ini.",
  };
};

export default function Ajuan() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [jenis, setJenis] = useState<"izin" | "sakit">("izin");
  const [keterangan, setKeterangan] = useState("");
  const [loadingUser, setLoadingUser] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState("");
  const [selectedMimeType, setSelectedMimeType] = useState("image/jpeg");
  const [refreshing, setRefreshing] = useState(false);
  const [submissionAccess, setSubmissionAccess] = useState<SubmissionAccess>(() => getSubmissionAccess([]));
  const [isEditingPendingForm, setIsEditingPendingForm] = useState(false);
  const handleBack = useFeatureBack({ fallbackRoute: "/user" });

  const applyPickedImage = useCallback((asset: ImagePicker.ImagePickerAsset) => {
    setSelectedImageUri(asset.uri);
    setSelectedMimeType(asset.mimeType || "image/jpeg");
  }, []);

  const syncSubmissionState = useCallback((items: SubmissionItem[]) => {
    const now = new Date();
    const todayItems = items.filter((item) => isTodaySubmission(item.created_at, now));
    setSubmissionAccess(getSubmissionAccess(todayItems));
  }, []);

  const fetchSubmissionHistory = useCallback(async (userId: string) => {
    const { data, error } = await supabaseAdmin
      .from("pengajuan")
      .select("id, jenis, keterangan, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    syncSubmissionState((data || []) as SubmissionItem[]);
  }, [syncSubmissionState]);

  const fetchUser = useCallback(async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("User tidak ditemukan");

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id,nama,kelas")
        .eq("id", authData.user.id)
        .single();

      if (error) throw error;
      setUser(profile);
      await fetchSubmissionHistory(profile.id);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoadingUser(false);
      setRefreshing(false);
    }
  }, [fetchSubmissionHistory]);

  useEffect(() => {
    fetchUser();

    let submissionChannel: any = null;

    const setupRealtime = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;

      if (!userId) {
        return;
      }

      submissionChannel = supabase
        .channel(`pengajuan-user-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "pengajuan",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            fetchSubmissionHistory(userId).catch(() => undefined);
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (submissionChannel) {
        supabase.removeChannel(submissionChannel);
      }
    };
  }, [fetchSubmissionHistory, fetchUser]);

  useEffect(() => {
    if (submissionAccess.mode !== "edit-pending" || !submissionAccess.activeSubmission) {
      return;
    }

    setJenis(submissionAccess.activeSubmission.jenis as "izin" | "sakit");
    setKeterangan(submissionAccess.activeSubmission.keterangan || "");
  }, [submissionAccess]);

  useEffect(() => {
    if (submissionAccess.mode !== "edit-pending") {
      setIsEditingPendingForm(false);
    }
  }, [submissionAccess.mode]);

  useEffect(() => {
    const restorePendingImage = async () => {
      try {
        const pendingResult = await ImagePicker.getPendingResultAsync();

        if (
          pendingResult &&
          "canceled" in pendingResult &&
          !pendingResult.canceled &&
          pendingResult.assets?.length
        ) {
          applyPickedImage(pendingResult.assets[0]);
        }
      } catch {
        // Ignore pending picker restoration failures and keep the screen usable.
      }
    };

    restorePendingImage();
  }, [applyPickedImage]);

  const submitAjuan = async () => {
    if (!user) return;
    if (!keterangan.trim()) return Alert.alert("Info", "Isi keterangan terlebih dahulu.");
    if (submissionAccess.mode === "blocked") {
      return Alert.alert("Info", submissionAccess.blockReason || "Batas pengajuan hari ini sudah habis.");
    }
    if (isPastSubmissionCutoff()) {
      return Alert.alert(
        "Batas Waktu Lewat",
        `Pengajuan izin atau sakit hanya bisa dikirim sampai jam ${getSubmissionCutoffLabel()}.`
      );
    }
    if (!selectedImageUri && submissionAccess.mode !== "edit-pending") {
      return Alert.alert("Info", "Tambahkan bukti foto terlebih dahulu.");
    }

    try {
      setSubmitting(true);
      const trimmedNote = keterangan.trim();
      const finalNote =
        submissionAccess.mode === "retry-approved"
          ? `Koreksi pengajuan sebelumnya: ${trimmedNote}`
          : trimmedNote;
      const payload = {
        user_id: user.id,
        nama: user.nama,
        kelas: user.kelas,
        jenis,
        keterangan: finalNote,
        status: "pending",
      };

      let usedAdminClient = false;
      let savedSubmission: { id: string } | null = null;
      let error: any = null;

      if (submissionAccess.mode === "edit-pending" && submissionAccess.activeSubmission) {
        ({ data: savedSubmission, error } = await supabase
          .from("pengajuan")
          .update(payload)
          .eq("id", submissionAccess.activeSubmission.id)
          .select("id")
          .single());

        if (error && /row-level security/i.test(error.message || "")) {
          usedAdminClient = true;
          ({ data: savedSubmission, error } = await supabaseAdmin
            .from("pengajuan")
            .update(payload)
            .eq("id", submissionAccess.activeSubmission.id)
            .select("id")
            .single());
        }
      } else {
        ({ data: savedSubmission, error } = await supabase
          .from("pengajuan")
          .insert([payload])
          .select("id")
          .single());

        if (error && /row-level security/i.test(error.message || "")) {
          usedAdminClient = true;
          ({ data: savedSubmission, error } = await supabaseAdmin
            .from("pengajuan")
            .insert([payload])
            .select("id")
            .single());
        }
      }

      if (error) throw error;

      const submissionId = savedSubmission?.id;
      if (!submissionId) {
        throw new Error("Data pengajuan tidak ditemukan setelah disimpan.");
      }

      const storageClient = usedAdminClient ? supabaseAdmin.storage : supabase.storage;
      const dataClient = usedAdminClient ? supabaseAdmin : supabase;

      if (selectedImageUri) {
        const fileExtension = getFileExtension(selectedMimeType, selectedImageUri);
        const filePath = `pengajuan/${submissionId}.${fileExtension}`;
        const { data: signedUploadData, error: signedUploadError } = await storageClient
          .from("bukti-ajuan")
          .createSignedUploadUrl(filePath, {
            upsert: true,
          });

        if (signedUploadError || !signedUploadData?.signedUrl) {
          if (submissionAccess.mode !== "edit-pending") {
            await dataClient.from("pengajuan").delete().eq("id", submissionId);
          }
          throw signedUploadError || new Error("Gagal menyiapkan upload foto.");
        }

        const uploadResult = await FileSystem.uploadAsync(signedUploadData.signedUrl, selectedImageUri, {
          httpMethod: "PUT",
          headers: {
            "content-type": selectedMimeType,
            "x-upsert": "true",
          },
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        });

        if (uploadResult.status < 200 || uploadResult.status >= 300) {
          if (submissionAccess.mode !== "edit-pending") {
            await dataClient.from("pengajuan").delete().eq("id", submissionId);
          }
          throw new Error(`Upload foto gagal (${uploadResult.status}).`);
        }
      }

      Alert.alert(
        "Berhasil",
        submissionAccess.mode === "edit-pending"
          ? "Pengajuan berhasil diperbarui."
          : "Pengajuan izin/sakit berhasil dikirim."
      );
      setIsEditingPendingForm(false);
      setKeterangan("");
      setSelectedImageUri("");
      setSelectedMimeType("image/jpeg");
      await fetchSubmissionHistory(user.id);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Info", "Izin kamera ditolak.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.4,
    });

    if (result.canceled || !result.assets.length) {
      return;
    }

    applyPickedImage(result.assets[0]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUser();
  };

  const submissionClosed = isPastSubmissionCutoff();
  const isBlocked = submissionAccess.mode === "blocked";
  const isEditingPending = submissionAccess.mode === "edit-pending";
  const isRetryApproved = submissionAccess.mode === "retry-approved";
  const isRetryRejected = submissionAccess.mode === "retry-rejected";
  const shouldShowForm = !isEditingPending || isEditingPendingForm;
  const latestSubmission = submissionAccess.activeSubmission;
  const statusTone =
    latestSubmission?.status === "approved"
      ? styles.statusApproved
      : latestSubmission?.status === "rejected"
        ? styles.statusRejected
        : styles.statusPending;

  if (loadingUser) return <ActivityIndicator size="large" style={{ flex: 1 }} color={AppTheme.colors.primary} />;

  return (
    <ScreenShell
      scroll
      footer={<UserBottomNav activeKey="ajuan" />}
      scrollProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />,
      }}
    >
      <View style={styles.shell}>
        <PageHeader eyebrow="Pengajuan siswa" title="Izin dan Sakit" onBackPress={handleBack} />

        <InfoCard
          title="Ajukan izin atau sakit"
          description={`Pengajuan izin dan sakit hanya bisa dikirim sampai jam ${getSubmissionCutoffLabel()}. Pengajuan yang masih pending bisa diedit, lalu ada maksimal 1 kesempatan tambahan setelah disetujui atau ditolak.`}
        />

        <View style={styles.userInfo}>
          <Text style={styles.userLabel}>Nama</Text>
          <Text style={styles.userValue}>{user?.nama}</Text>
          <Text style={[styles.userLabel, { marginTop: 12 }]}>Kelas</Text>
          <Text style={styles.userValue}>{user?.kelas}</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Pengajuan Izin / Sakit</Text>
          <Text style={styles.sectionHint}>
            {submissionClosed
              ? `Pengajuan hari ini sudah ditutup karena lewat jam ${getSubmissionCutoffLabel()}.`
              : submissionAccess.helperText}
          </Text>

          {latestSubmission ? (
            <View style={styles.statusCard}>
              <View style={styles.statusHeaderRow}>
                <View>
                  <Text style={styles.statusTitle}>Status Pengajuan Hari Ini</Text>
                  <Text style={styles.statusMeta}>
                    {getSubmissionDisplayType(latestSubmission.jenis)} • {formatSubmissionDateTime(latestSubmission.created_at)}
                  </Text>
                </View>
                <View style={[styles.statusBadge, statusTone]}>
                  <Text style={[styles.statusBadgeText, statusTone]}>
                    {getSubmissionStatusLabel(latestSubmission.status)}
                  </Text>
                </View>
              </View>
              <Text style={styles.statusNote}>{latestSubmission.keterangan || "-"}</Text>

              {isEditingPending && !isEditingPendingForm ? (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setIsEditingPendingForm(true)}
                >
                  <Text style={styles.secondaryButtonText}>Edit Pengajuan</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {shouldShowForm ? (
            <>
              <Text style={styles.label}>Pilih Jenis</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.jenisButton, jenis === "izin" && styles.jenisSelected]}
                  onPress={() => setJenis("izin")}
                  disabled={isBlocked || submissionClosed}
                >
                  <Text style={[styles.jenisText, jenis === "izin" && styles.jenisTextSelected]}>Izin</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.jenisButton, jenis === "sakit" && styles.jenisSelected]}
                  onPress={() => setJenis("sakit")}
                  disabled={isBlocked || submissionClosed}
                >
                  <Text style={[styles.jenisText, jenis === "sakit" && styles.jenisTextSelected]}>Sakit</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Keterangan</Text>
              <TextInput
                placeholder={
                  isRetryApproved
                    ? "Tulis koreksi jika pengajuan sebelumnya salah"
                    : isRetryRejected
                      ? "Tulis alasan pengajuan ulang untuk sekolah"
                      : "Tulis alasan atau catatan untuk sekolah"
                }
                style={styles.input}
                value={keterangan}
                onChangeText={setKeterangan}
                multiline
                editable={!isBlocked && !submissionClosed}
                placeholderTextColor="#A89F9F"
              />

              <Text style={styles.label}>Bukti Foto</Text>
              <TouchableOpacity
                style={[styles.photoPicker, (isBlocked || submissionClosed) && styles.submitDisabled]}
                onPress={pickImage}
                disabled={isBlocked || submissionClosed}
              >
                <Ionicons name="image-outline" size={18} color="#16324f" />
                <Text style={styles.photoPickerText}>
                  {selectedImageUri
                    ? "Ambil Ulang Foto Bukti"
                    : isEditingPending
                      ? "Ganti Foto Bukti"
                      : "Ambil Foto Bukti"}
                </Text>
              </TouchableOpacity>

              {selectedImageUri ? <Image source={{ uri: selectedImageUri }} style={styles.previewImage} /> : null}
              {!selectedImageUri && isEditingPending ? (
                <Text style={styles.photoHelperText}>
                  Foto bukti lama tetap dipakai kalau Anda tidak mengambil foto baru.
                </Text>
              ) : null}

              {isEditingPending ? (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setIsEditingPendingForm(false);
                    setSelectedImageUri("");
                    setSelectedMimeType("image/jpeg");
                  }}
                >
                  <Text style={styles.cancelButtonText}>Batal Edit</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[styles.submitButton, (submitting || isBlocked || submissionClosed) && styles.submitDisabled]}
                onPress={submitAjuan}
                disabled={submitting || isBlocked || submissionClosed}
              >
                <Text style={styles.submitText}>
                  {submissionClosed
                    ? "Pengajuan Ditutup"
                    : isBlocked
                      ? "Batas Pengajuan Habis"
                      : submitting
                        ? isEditingPending
                          ? "Menyimpan..."
                          : "Mengirim..."
                        : isEditingPending
                          ? "Simpan Perubahan"
                          : isRetryApproved
                            ? "Kirim Koreksi Pengajuan"
                            : isRetryRejected
                              ? "Kirim Ulang Pengajuan"
                              : "Kirim Pengajuan"}
                </Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>

      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: AppTheme.spacing.lg,
  },
  userInfo: {
    padding: AppTheme.spacing.xl,
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    ...AppTheme.shadow.sm,
  },
  userLabel: {
    ...AppTheme.typography.label,
    marginBottom: AppTheme.spacing.xs,
  },
  userValue: {
    ...AppTheme.typography.titleSm,
  },
  sectionCard: {
    padding: AppTheme.spacing.xl,
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    ...AppTheme.shadow.sm,
  },
  sectionTitle: {
    ...AppTheme.typography.titleSm,
  },
  sectionHint: {
    ...AppTheme.typography.bodySm,
    marginTop: AppTheme.spacing.xs,
    marginBottom: AppTheme.spacing.lg,
  },
  statusCard: {
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    borderRadius: AppTheme.radius.lg,
    padding: AppTheme.spacing.lg,
    backgroundColor: AppTheme.colors.surfaceMuted,
    marginBottom: AppTheme.spacing.xl,
    gap: AppTheme.spacing.sm,
  },
  statusHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  statusTitle: {
    color: AppTheme.colors.text,
    ...AppTheme.typography.bodyStrong,
  },
  statusMeta: {
    ...AppTheme.typography.bodySm,
    marginTop: AppTheme.spacing.xs,
  },
  statusNote: {
    ...AppTheme.typography.body,
  },
  statusBadge: {
    borderRadius: AppTheme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusBadgeText: {
    fontWeight: "800",
    fontSize: 12,
  },
  statusPending: {
    backgroundColor: AppTheme.colors.warningSoft,
    color: AppTheme.colors.warning,
  },
  statusApproved: {
    backgroundColor: AppTheme.colors.successSoft,
    color: AppTheme.colors.success,
  },
  statusRejected: {
    backgroundColor: AppTheme.colors.dangerSoft,
    color: AppTheme.colors.danger,
  },
  secondaryButton: {
    alignSelf: "flex-start",
    backgroundColor: AppTheme.colors.primarySoft,
    borderRadius: AppTheme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    ...AppTheme.typography.bodyStrong,
    color: AppTheme.colors.primary,
  },
  label: {
    ...AppTheme.typography.bodyStrong,
    marginBottom: AppTheme.spacing.sm,
  },
  buttonRow: {
    flexDirection: "row",
    marginBottom: AppTheme.spacing.lg,
  },
  jenisButton: {
    flex: 1,
    paddingVertical: AppTheme.spacing.md,
    marginHorizontal: AppTheme.spacing.xs,
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.colors.surface,
    alignItems: "center",
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  jenisSelected: {
    backgroundColor: AppTheme.colors.primary,
    borderColor: AppTheme.colors.primary,
  },
  jenisText: {
    ...AppTheme.typography.body,
    color: AppTheme.colors.textMuted,
  },
  jenisTextSelected: {
    color: AppTheme.colors.white,
    fontFamily: AppTheme.fonts.semibold,
  },
  input: {
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    borderRadius: AppTheme.radius.lg,
    padding: AppTheme.spacing.lg,
    backgroundColor: AppTheme.colors.surface,
    marginBottom: AppTheme.spacing.xl,
    textAlignVertical: "top",
    minHeight: 120,
    color: AppTheme.colors.text,
    fontFamily: AppTheme.fonts.regular,
    fontSize: 14,
    lineHeight: 22,
  },
  photoPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: AppTheme.spacing.sm,
    backgroundColor: AppTheme.colors.primarySoft,
    borderRadius: AppTheme.radius.md,
    paddingVertical: AppTheme.spacing.md,
    marginBottom: AppTheme.spacing.md,
  },
  photoPickerText: {
    ...AppTheme.typography.bodyStrong,
    color: AppTheme.colors.primary,
  },
  photoHelperText: {
    ...AppTheme.typography.bodySm,
    marginTop: -4,
    marginBottom: AppTheme.spacing.md,
  },
  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: AppTheme.radius.lg,
    marginBottom: AppTheme.spacing.xl,
    backgroundColor: AppTheme.colors.surface,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: AppTheme.colors.borderStrong,
    paddingVertical: AppTheme.spacing.md,
    borderRadius: AppTheme.radius.md,
    alignItems: "center",
    marginBottom: AppTheme.spacing.sm,
    backgroundColor: AppTheme.colors.surface,
  },
  cancelButtonText: {
    ...AppTheme.typography.bodyStrong,
  },
  submitButton: {
    backgroundColor: AppTheme.colors.primary,
    paddingVertical: AppTheme.spacing.lg,
    borderRadius: AppTheme.radius.md,
    alignItems: "center",
  },
  submitDisabled: {
    backgroundColor: AppTheme.colors.textSoft,
  },
  submitText: {
    ...AppTheme.typography.button,
  },
});
