import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AppButton } from "../../components/ui/app-button";
import { AppCard } from "../../components/ui/app-card";
import { AppInput } from "../../components/ui/app-input";
import { AppTheme } from "../../constants/theme";
import { buildPasswordRequestNote } from "../../lib/pengajuan";
import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

type AuthUserSummary = {
  id: string;
  email?: string;
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotPassword, setForgotPassword] = useState("");
  const [forgotPasswordConfirm, setForgotPasswordConfirm] = useState("");
  const [forgotReason, setForgotReason] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  const handleLogin = async () => {
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      return;
    }
    router.replace("/");
  };

  const findAuthUserByEmail = async (targetEmail: string) => {
    let page = 1;
    const normalizedEmail = targetEmail.trim().toLowerCase();

    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });

      if (error) {
        throw error;
      }

      const users = (data?.users || []) as AuthUserSummary[];
      const matchedUser = users.find((item) => (item.email || "").toLowerCase() === normalizedEmail);

      if (matchedUser) {
        return matchedUser;
      }

      if (users.length < 200) {
        return null;
      }

      page += 1;
    }
  };

  const submitForgotPassword = async () => {
    const normalizedEmail = forgotEmail.trim().toLowerCase();

    if (!normalizedEmail || !forgotPassword || !forgotPasswordConfirm || !forgotReason.trim()) {
      Alert.alert("Info", "Semua kolom permintaan password harus diisi.");
      return;
    }

    if (forgotPassword.length < 6) {
      Alert.alert("Info", "Password baru minimal 6 karakter.");
      return;
    }

    if (forgotPassword !== forgotPasswordConfirm) {
      Alert.alert("Info", "Konfirmasi password belum sama.");
      return;
    }

    try {
      setForgotSubmitting(true);

      const authUser = await findAuthUserByEmail(normalizedEmail);
      if (!authUser?.id) {
        throw new Error("Email akun tidak ditemukan.");
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id, nama, kelas")
        .eq("id", authUser.id)
        .single();

      if (profileError || !profile) {
        throw new Error("Profil pengguna tidak ditemukan.");
      }

      const { data: existingRequest, error: existingError } = await supabaseAdmin
        .from("pengajuan")
        .select("id")
        .eq("user_id", profile.id)
        .eq("jenis", "ganti_password")
        .eq("status", "pending")
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existingRequest?.id) {
        throw new Error("Permintaan ganti password masih menunggu persetujuan admin.");
      }

      const { error: insertError } = await supabaseAdmin.from("pengajuan").insert([
        {
          user_id: profile.id,
          nama: profile.nama,
          kelas: profile.kelas,
          jenis: "ganti_password",
          keterangan: buildPasswordRequestNote({
            password: forgotPassword,
            alasan: forgotReason.trim(),
            email: normalizedEmail,
          }),
          status: "pending",
        },
      ]);

      if (insertError) {
        throw insertError;
      }

      Alert.alert("Berhasil", "Permintaan ganti password sudah dikirim ke admin.");
      setForgotEmail("");
      setForgotPassword("");
      setForgotPasswordConfirm("");
      setForgotReason("");
      setShowForgotPassword(false);
    } catch (requestError: any) {
      Alert.alert("Error", requestError.message || "Gagal mengirim permintaan ganti password.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroAccent} />
          <View style={styles.brandChip}>
            <Image
              source={require("../../assets/images/react-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.brandName}>QRensi</Text>
          </View>
          <Text style={styles.heroEyebrow}>School attendance platform</Text>
          <Text style={styles.heroTitle}>Masuk ke dashboard absensi yang lebih rapi dan fokus.</Text>
          <Text style={styles.heroCaption}>
            Gunakan akun admin atau siswa untuk memantau kehadiran, pengajuan, dan QR harian.
          </Text>
        </View>

        <AppCard style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formEyebrow}>Akses akun</Text>
            <Text style={styles.formTitle}>Masuk ke panel QRensi</Text>
            <Text style={styles.formCaption}>
              Semua tampilan dan data akan menyesuaikan peran akun setelah login berhasil.
            </Text>
          </View>

          <View style={styles.formFields}>
            <AppInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <AppInput
              placeholder="Password"
              value={password}
              secureTextEntry={!isPasswordVisible}
              onChangeText={setPassword}
              trailingIcon={isPasswordVisible ? "eye-outline" : "eye-off-outline"}
              onTrailingPress={() => setIsPasswordVisible((value) => !value)}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity style={styles.forgotButton} onPress={() => setShowForgotPassword(true)}>
            <Text style={styles.forgotButtonText}>Lupa password?</Text>
            <Ionicons name="arrow-forward" size={16} color={AppTheme.colors.primary} />
          </TouchableOpacity>

          <AppButton label="Login" onPress={handleLogin} />
        </AppCard>
      </ScrollView>

      <Modal transparent animationType="fade" visible={showForgotPassword} onRequestClose={() => setShowForgotPassword(false)}>
        <View style={styles.modalOverlay}>
          <AppCard style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalEyebrow}>Bantuan akun</Text>
                <Text style={styles.modalTitle}>Permintaan Ganti Password</Text>
                <Text style={styles.requestCaption}>
                  Isi detail berikut agar admin menerima permintaan penggantian password Anda.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowForgotPassword(false)}
              >
                <Ionicons name="close" size={18} color={AppTheme.colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalFields}>
              <AppInput
                placeholder="Email akun"
                value={forgotEmail}
                onChangeText={setForgotEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <AppInput
                placeholder="Password baru"
                value={forgotPassword}
                onChangeText={setForgotPassword}
                secureTextEntry
              />

              <AppInput
                placeholder="Konfirmasi password baru"
                value={forgotPasswordConfirm}
                onChangeText={setForgotPasswordConfirm}
                secureTextEntry
              />

              <AppInput
                placeholder="Alasan ganti password"
                value={forgotReason}
                onChangeText={setForgotReason}
                multiline
                style={styles.reasonInput}
              />
            </View>

            <View style={styles.modalActions}>
              <AppButton
                label="Tutup"
                variant="ghost"
                onPress={() => setShowForgotPassword(false)}
              />
              <AppButton
                label={forgotSubmitting ? "Mengirim..." : "Kirim Permintaan"}
                onPress={submitForgotPassword}
                disabled={forgotSubmitting}
              />
            </View>
          </AppCard>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: AppTheme.spacing["3xl"],
  },
  hero: {
    backgroundColor: AppTheme.colors.primary,
    paddingHorizontal: AppTheme.spacing["2xl"],
    paddingTop: AppTheme.spacing["5xl"],
    paddingBottom: 110,
    position: "relative",
    overflow: "hidden",
  },
  heroAccent: {
    position: "absolute",
    right: -48,
    top: -24,
    width: 176,
    height: 176,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  brandChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.md,
    paddingHorizontal: AppTheme.spacing.lg,
    paddingVertical: AppTheme.spacing.md,
    borderRadius: AppTheme.radius.pill,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: AppTheme.spacing.xl,
  },
  logo: {
    width: 32,
    height: 32,
  },
  brandName: {
    fontFamily: AppTheme.fonts.bold,
    fontSize: 18,
    lineHeight: 24,
    color: AppTheme.colors.white,
  },
  heroEyebrow: {
    ...AppTheme.typography.eyebrow,
    color: "#CFE0F1",
    marginBottom: AppTheme.spacing.sm,
  },
  heroTitle: {
    fontFamily: AppTheme.fonts.extrabold,
    fontSize: 30,
    lineHeight: 40,
    color: AppTheme.colors.white,
    maxWidth: 320,
  },
  heroCaption: {
    ...AppTheme.typography.body,
    color: "#D7E6F5",
    marginTop: AppTheme.spacing.md,
    maxWidth: 320,
  },
  formCard: {
    marginHorizontal: AppTheme.spacing["2xl"],
    marginTop: -72,
    gap: AppTheme.spacing.xl,
  },
  formHeader: {
    gap: AppTheme.spacing.xs,
  },
  formEyebrow: {
    ...AppTheme.typography.eyebrow,
    color: AppTheme.colors.primary,
  },
  formTitle: {
    ...AppTheme.typography.title,
  },
  formCaption: {
    ...AppTheme.typography.body,
    color: AppTheme.colors.textMuted,
  },
  formFields: {
    gap: AppTheme.spacing.md,
  },
  errorText: {
    ...AppTheme.typography.bodySm,
    color: AppTheme.colors.danger,
  },
  forgotButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.xs,
  },
  forgotButtonText: {
    fontFamily: AppTheme.fonts.semibold,
    fontSize: 13,
    lineHeight: 20,
    color: AppTheme.colors.primary,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: AppTheme.spacing.xl,
    backgroundColor: AppTheme.colors.overlay,
  },
  modalCard: {
    gap: AppTheme.spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: AppTheme.spacing.md,
  },
  modalHeaderCopy: {
    flex: 1,
    gap: AppTheme.spacing.xs,
  },
  modalEyebrow: {
    ...AppTheme.typography.eyebrow,
    color: AppTheme.colors.primary,
  },
  modalTitle: {
    ...AppTheme.typography.titleSm,
  },
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: AppTheme.radius.sm,
    backgroundColor: AppTheme.colors.backgroundMuted,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  requestCaption: {
    ...AppTheme.typography.bodySm,
  },
  modalFields: {
    gap: AppTheme.spacing.md,
  },
  reasonInput: {
    minHeight: 104,
    textAlignVertical: "top",
    paddingTop: AppTheme.spacing.lg,
  },
  modalActions: {
    gap: AppTheme.spacing.md,
  },
});
