import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Picker } from "@react-native-picker/picker";

import { AdminBottomNav } from "../../components/admin-bottom-nav";
import { AppButton } from "../../components/ui/app-button";
import { AppCard } from "../../components/ui/app-card";
import { AppInput } from "../../components/ui/app-input";
import { InfoCard } from "../../components/ui/info-card";
import { PageHeader } from "../../components/ui/page-header";
import { ScreenShell } from "../../components/ui/screen-shell";
import { AppTheme } from "../../constants/theme";
import {
  isStudentNameVerySimilar,
  normalizeStudentName,
} from "../../lib/student";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export default function TambahUser() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nama, setNama] = useState("");
  const [kelas, setKelas] = useState("7 Banin");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleNamaChange = (text: string) => setNama(normalizeStudentName(text));

  const isValidEmail = (value: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(value)
  };

  const createUser = async () => {
    if (!email || !password || !nama || !kelas) {
      Alert.alert("Error", "Semua kolom harus diisi")
      return
    }

    if (!isValidEmail(email)) {
      Alert.alert("Error", "Format email tidak valid")
      return
    }

    const namaUppercase = normalizeStudentName(nama)

    const proceedCreateUser = async () => {
      setLoading(true)

      try {
        const { data: authData, error: authError } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              full_name: namaUppercase,
              class_name: kelas,
            },
          })

        const userId = authData?.user?.id

        if (authError?.message.includes("already registered")) {
          throw new Error("Email sudah terdaftar")
        }

        if (authError) {
          throw new Error(authError.message)
        }

        if (userId) {
          const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
            id: userId,
            role: "user",
            nama: namaUppercase,
            kelas,
          })

          if (profileError) throw new Error(profileError.message)
        }

        Alert.alert("Berhasil", `Data ${namaUppercase} berhasil dibuat!`)
        setEmail("")
        setPassword("")
        setNama("")
        setKelas("7 Banin")
      } catch (err: any) {
        Alert.alert("Error", err.message || "Terjadi kesalahan")
      } finally {
        setLoading(false)
      }
    }

    const { data: existingUsers, error: duplicateError } = await supabaseAdmin
      .from("profiles")
      .select("id, nama")
      .eq("role", "user")

    if (duplicateError) {
      Alert.alert("Error", duplicateError.message || "Gagal memeriksa nama siswa")
      return
    }

    const exactDuplicate = existingUsers?.find(
      (item) => normalizeStudentName(item.nama || "") === namaUppercase
    )
    const similarDuplicate = existingUsers?.find(
      (item) =>
        normalizeStudentName(item.nama || "") !== namaUppercase &&
        isStudentNameVerySimilar(item.nama || "", namaUppercase)
    )

    const continueAfterWarning = async () => {
      if (exactDuplicate) {
        Alert.alert(
          "Nama Sudah Terdaftar",
          `${namaUppercase} sudah terdaftar. Apakah ingin tetap melanjutkan pembuatan user?`,
          [
            { text: "Batal", style: "cancel" },
            { text: "Lanjut", onPress: proceedCreateUser },
          ]
        )
        return
      }

      if (similarDuplicate) {
        Alert.alert(
          "Nama Mirip Terdeteksi",
          `Nama ${namaUppercase} sangat mirip dengan ${normalizeStudentName(
            similarDuplicate.nama || ""
          )}. Periksa lagi agar tidak membuat akun ganda.`,
          [
            { text: "Batal", style: "cancel" },
            { text: "Lanjut", onPress: proceedCreateUser },
          ]
        )
        return
      }

      await proceedCreateUser()
    }

    Alert.alert(
      "Konfirmasi",
      `Apakah Anda yakin ingin membuat user ${namaUppercase} dengan email ${email}?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Iya",
          onPress: async () => {
            await continueAfterWarning()
          },
        },
      ]
    )
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  return (
    <ScreenShell
      scroll
      footer={<AdminBottomNav activeKey="tambah_user" />}
      scrollProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />,
      }}
    >
      <View style={styles.shell}>
        <PageHeader
          eyebrow="Akun baru"
          title="Tambah User"
          onBackPress={() => router.replace("/admin" as any)}
        />

        <InfoCard
          title="Form pembuatan akun siswa"
          description="Lengkapi data dasar akun agar siswa dapat login dan menggunakan QR absensi."
        />

        <AppCard style={styles.formCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Informasi Akun</Text>
            <Text style={styles.cardCaption}>
              Gunakan format nama yang rapi dan pastikan kelas sesuai sebelum menyimpan.
            </Text>
          </View>

          <AppInput
            placeholder="Nama Lengkap"
            value={nama}
            onChangeText={handleNamaChange}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
          />

          <AppInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />

          <AppInput
            placeholder="Password"
            value={password}
            secureTextEntry={!showPassword}
            onChangeText={setPassword}
            trailingIcon={showPassword ? "eye-off" : "eye"}
            onTrailingPress={() => setShowPassword(!showPassword)}
          />

          <View style={styles.pickerBox}>
            <Picker selectedValue={kelas} onValueChange={(v) => setKelas(v)}>
              <Picker.Item label="7 Banin" value="7 Banin" />
              <Picker.Item label="7 Banat" value="7 Banat" />
              <Picker.Item label="8 Banin" value="8 Banin" />
              <Picker.Item label="8 Banat" value="8 Banat" />
              <Picker.Item label="9 Banin" value="9 Banin" />
              <Picker.Item label="9 Banat" value="9 Banat" />
            </Picker>
          </View>

          <AppButton label={loading ? "Membuat..." : "Buat User"} onPress={createUser} />
        </AppCard>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: AppTheme.spacing.lg,
  },
  formCard: {
    gap: AppTheme.spacing.md,
  },
  cardHeader: {
    gap: AppTheme.spacing.xs,
  },
  cardTitle: {
    ...AppTheme.typography.titleSm,
  },
  cardCaption: {
    ...AppTheme.typography.bodySm,
  },
  pickerBox: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
});
