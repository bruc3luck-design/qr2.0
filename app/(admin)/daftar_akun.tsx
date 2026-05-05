import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useEffect, useState, useCallback } from "react"
import { Picker } from "@react-native-picker/picker"
import { supabase } from "../../lib/supabase"
import { supabaseAdmin } from "../../lib/supabaseAdmin"
import { AdminBottomNav } from "../../components/admin-bottom-nav"
import { useFeatureBack } from "../../hooks/use-feature-back"
import { AppTheme } from "../../constants/theme"
import { InfoCard } from "../../components/ui/info-card"
import { ModalCard } from "../../components/ui/modal-card"
import { PageHeader } from "../../components/ui/page-header"
import { ScreenShell } from "../../components/ui/screen-shell"
import { SectionHeader } from "../../components/ui/section-header"
import {
  compareStudentNames,
  isStudentNameVerySimilar,
  matchesStudentSearch,
  normalizeStudentName,
} from "../../lib/student"

type Profile = {
  id: string
  nama: string
  kelas: string
  role?: string
}

export default function DaftarAkun() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [createEmail, setCreateEmail] = useState("")
  const [createPassword, setCreatePassword] = useState("")
  const [createNama, setCreateNama] = useState("")
  const [createKelas, setCreateKelas] = useState("7 Banin")
  const [editNama, setEditNama] = useState("")
  const [editKelas, setEditKelas] = useState("7 Banin")
  const [searchQuery, setSearchQuery] = useState("")
  const [processingAction, setProcessingAction] = useState<"create" | "edit" | "delete" | "reset" | null>(null)
  const handleBack = useFeatureBack({
    fallbackRoute: "/admin",
    beforeBack: () => {
      if (createModalVisible) {
        closeCreateModal()
        return true
      }

      if (editModalVisible) {
        closeEditModal()
        return true
      }

      return false
    },
  })

  const classes = ["7 Banin", "7 Banat", "8 Banin", "8 Banat", "9 Banin", "9 Banat"]

  const getProfiles = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "user")
      .order("nama", { ascending: true })

    if (error) {
      console.log(error)
    }

    if (data) {
      setProfiles(
        [...data].sort((a, b) => compareStudentNames(a.nama, b.nama))
      )
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    let realtimeChannel: any

    const setupRealtime = async () => {
      await getProfiles()
      realtimeChannel = supabase
        .channel("public:profiles")
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
          getProfiles()
        })
        .subscribe()
    }

    setupRealtime()

    return () => {
      if (realtimeChannel) supabase.removeChannel(realtimeChannel)
    }
  }, [getProfiles])

  const siswa = profiles
    .filter((user) => user.kelas === selectedClass)
    .filter((user) => !searchQuery.trim() || matchesStudentSearch(user.nama || "", searchQuery))
    .sort((a, b) => compareStudentNames(a.nama, b.nama))

  const onRefresh = async () => {
    setRefreshing(true)
    await getProfiles()
    setRefreshing(false)
  }

  const closeCreateModal = () => {
    setCreateModalVisible(false)
    setCreateEmail("")
    setCreatePassword("")
    setCreateNama("")
    setCreateKelas(selectedClass || "7 Banin")
  }

  const openEditModal = (user: Profile) => {
    setEditingUser(user)
    setEditNama(normalizeStudentName(user.nama))
    setEditKelas(user.kelas)
    setEditModalVisible(true)
  }

  const closeEditModal = () => {
    setEditModalVisible(false)
    setEditingUser(null)
    setEditNama("")
    setEditKelas("7 Banin")
  }

  const isValidEmail = (value: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(value)
  }

  const getExactDuplicateUser = (namaValue: string, excludeId?: string) => {
    const normalized = normalizeStudentName(namaValue)
    return profiles.find(
      (item) => item.id !== excludeId && normalizeStudentName(item.nama || "") === normalized
    )
  }

  const getSimilarDuplicateUser = (namaValue: string, excludeId?: string) => {
    const normalized = normalizeStudentName(namaValue)
    return profiles.find(
      (item) =>
        item.id !== excludeId &&
        normalizeStudentName(item.nama || "") !== normalized &&
        isStudentNameVerySimilar(item.nama || "", normalized)
    )
  }

  const saveUserUpdate = async (skipDuplicateWarning = false) => {
    if (!editingUser) return

    const namaBaru = normalizeStudentName(editNama)
    if (!namaBaru || !editKelas) {
      Alert.alert("Error", "Nama dan kelas wajib diisi")
      return
    }

    const exactDuplicate = getExactDuplicateUser(namaBaru, editingUser.id)
    const similarDuplicate = getSimilarDuplicateUser(namaBaru, editingUser.id)

    if (exactDuplicate && !skipDuplicateWarning) {
      Alert.alert(
        "Nama Sudah Terdaftar",
        `${namaBaru} sudah terdaftar. Apakah ingin tetap melanjutkan edit data?`,
        [
          { text: "Batal", style: "cancel" },
          { text: "Lanjut", onPress: () => saveUserUpdate(true) },
        ]
      )
      return
    }

    if (similarDuplicate && !skipDuplicateWarning) {
      Alert.alert(
        "Nama Mirip Terdeteksi",
        `Nama ${namaBaru} sangat mirip dengan ${normalizeStudentName(
          similarDuplicate.nama || ""
        )}. Periksa lagi agar tidak tertukar.`,
        [
          { text: "Batal", style: "cancel" },
          { text: "Lanjut", onPress: () => saveUserUpdate(true) },
        ]
      )
      return
    }

    try {
      setProcessingAction("edit")

      await supabaseAdmin
        .from("profiles")
        .update({ nama: namaBaru, kelas: editKelas })
        .eq("id", editingUser.id)
        .throwOnError()

      const syncResults = await Promise.allSettled([
        (async () => {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(editingUser.id, {
            user_metadata: {
              full_name: namaBaru,
              class_name: editKelas,
            },
          })

          if (error) {
            throw error
          }
        })(),
        supabaseAdmin
          .from("absensi")
          .update({ nama: namaBaru, kelas: editKelas })
          .eq("user_id", editingUser.id)
          .throwOnError(),
        supabaseAdmin
          .from("pengajuan")
          .update({ nama: namaBaru, kelas: editKelas })
          .eq("user_id", editingUser.id)
          .throwOnError(),
      ])

      setProfiles((prev) =>
        prev
          .map((item) =>
            item.id === editingUser.id ? { ...item, nama: namaBaru, kelas: editKelas } : item
          )
          .sort((a, b) => compareStudentNames(a.nama, b.nama))
      )

      if (selectedClass === editingUser.kelas && editKelas !== editingUser.kelas) {
        setSelectedClass(editKelas)
      }

      closeEditModal()
      const hasSyncWarning = syncResults.some((result) => result.status === "rejected")

      if (hasSyncWarning) {
        Alert.alert(
          "Berhasil Sebagian",
          "Profil siswa berhasil diperbarui, tetapi ada data lama yang belum tersinkron penuh."
        )
      } else {
        Alert.alert("Berhasil", "Data siswa berhasil diperbarui.")
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Gagal memperbarui data siswa")
    } finally {
      setProcessingAction(null)
    }
  }

  const createUser = async (skipDuplicateWarning = false) => {
    const namaBaru = normalizeStudentName(createNama)
    const emailBaru = createEmail.trim().toLowerCase()

    if (!emailBaru || !createPassword || !namaBaru || !createKelas) {
      Alert.alert("Error", "Semua kolom harus diisi")
      return
    }

    if (!isValidEmail(emailBaru)) {
      Alert.alert("Error", "Format email tidak valid")
      return
    }

    const exactDuplicate = getExactDuplicateUser(namaBaru)
    const similarDuplicate = getSimilarDuplicateUser(namaBaru)

    if (exactDuplicate && !skipDuplicateWarning) {
      Alert.alert(
        "Nama Sudah Terdaftar",
        `${namaBaru} sudah terdaftar. Apakah ingin tetap melanjutkan pembuatan user?`,
        [
          { text: "Batal", style: "cancel" },
          { text: "Lanjut", onPress: () => createUser(true) },
        ]
      )
      return
    }

    if (similarDuplicate && !skipDuplicateWarning) {
      Alert.alert(
        "Nama Mirip Terdeteksi",
        `Nama ${namaBaru} sangat mirip dengan ${normalizeStudentName(
          similarDuplicate.nama || ""
        )}. Periksa lagi agar tidak membuat akun ganda.`,
        [
          { text: "Batal", style: "cancel" },
          { text: "Lanjut", onPress: () => createUser(true) },
        ]
      )
      return
    }

    Alert.alert(
      "Tambah Akun",
      `Buat akun untuk ${namaBaru} dengan email ${emailBaru}?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Iya",
          onPress: async () => {
            try {
              setProcessingAction("create")

              const { data: authData, error: authError } =
                await supabaseAdmin.auth.admin.createUser({
                  email: emailBaru,
                  password: createPassword,
                  email_confirm: true,
                  user_metadata: {
                    full_name: namaBaru,
                    class_name: createKelas,
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
                  nama: namaBaru,
                  kelas: createKelas,
                })

                if (profileError) throw new Error(profileError.message)
              }

              await getProfiles()
              setSelectedClass(createKelas)
              closeCreateModal()
              Alert.alert("Berhasil", `Akun ${namaBaru} berhasil dibuat.`)
            } catch (error: any) {
              Alert.alert("Error", error.message || "Gagal membuat akun siswa")
            } finally {
              setProcessingAction(null)
            }
          },
        },
      ]
    )
  }

  const deleteUser = (user: Profile) => {
    Alert.alert(
      "Hapus Siswa",
      `Hapus ${user.nama} dari sistem? Data profil, absensi, pengajuan, dan akun login akan ikut terhapus.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              setProcessingAction("delete")

              const { error: pengajuanError } = await supabaseAdmin
                .from("pengajuan")
                .delete()
                .eq("user_id", user.id)
              if (pengajuanError) throw pengajuanError

              const { error: absensiError } = await supabaseAdmin
                .from("absensi")
                .delete()
                .eq("user_id", user.id)
              if (absensiError) throw absensiError

              const { error: profileError } = await supabaseAdmin
                .from("profiles")
                .delete()
                .eq("id", user.id)
              if (profileError) throw profileError

              const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
              if (authError) throw authError

              setProfiles((prev) => prev.filter((item) => item.id !== user.id))
              Alert.alert("Berhasil", `${user.nama} berhasil dihapus.`)
            } catch (error: any) {
              Alert.alert("Error", error.message || "Gagal menghapus siswa")
            } finally {
              setProcessingAction(null)
            }
          },
        },
      ]
    )
  }

  const resetClassUsers = () => {
    if (!selectedClass) return

    const usersInClass = profiles.filter((item) => item.kelas === selectedClass)
    if (!usersInClass.length) {
      Alert.alert("Info", `Belum ada siswa di kelas ${selectedClass}.`)
      return
    }

    Alert.alert(
      "Reset Per Kelas",
      `Hapus semua siswa kelas ${selectedClass} beserta absensi, pengajuan, dan akun loginnya?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              setProcessingAction("reset")
              const userIds = usersInClass.map((item) => item.id)

              const { error: pengajuanError } = await supabaseAdmin
                .from("pengajuan")
                .delete()
                .in("user_id", userIds)
              if (pengajuanError) throw pengajuanError

              const { error: absensiError } = await supabaseAdmin
                .from("absensi")
                .delete()
                .in("user_id", userIds)
              if (absensiError) throw absensiError

              const { error: profileError } = await supabaseAdmin
                .from("profiles")
                .delete()
                .in("id", userIds)
              if (profileError) throw profileError

              for (const userId of userIds) {
                const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
                if (authError) {
                  throw authError
                }
              }

              setProfiles((prev) => prev.filter((item) => item.kelas !== selectedClass))
              Alert.alert("Berhasil", `Semua akun siswa kelas ${selectedClass} berhasil direset.`)
            } catch (error: any) {
              Alert.alert("Error", error.message || "Gagal reset data kelas")
            } finally {
              setProcessingAction(null)
            }
          },
        },
      ]
    )
  }

  return (
    <ScreenShell viewProps={{ style: styles.container }} footer={<AdminBottomNav activeKey="daftar_akun" />}>
        <PageHeader
          eyebrow="Direktori akun"
          title="Daftar Akun Siswa"
          onBackPress={handleBack}
          rightSlot={
            <TouchableOpacity
              style={styles.addHeaderButton}
              onPress={() => {
                setCreateKelas(selectedClass || "7 Banin")
                setCreateModalVisible(true)
              }}
              disabled={processingAction === "create"}
            >
              <Ionicons name="add-circle" size={24} color={AppTheme.colors.white} />
            </TouchableOpacity>
          }
        />

        <InfoCard
          title="Pilih kelas untuk melihat akun aktif"
          description="Data akan diperbarui otomatis saat ada perubahan profil siswa. Gunakan tombol tambah di kanan atas untuk menambah akun baru."
        />

        {loading ? (
          <ActivityIndicator size="large" color={AppTheme.colors.primary} />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <View style={styles.grid}>
              {classes.map((kelas) => {
                const jumlah = profiles.filter((user) => user.kelas === kelas).length
                const active = selectedClass === kelas
                return (
                  <TouchableOpacity
                    key={kelas}
                    style={[styles.card, active && styles.cardActive]}
                    onPress={() => setSelectedClass(kelas)}
                  >
                    <Ionicons
                      name="school"
                      size={26}
                      color={active ? AppTheme.colors.primary : AppTheme.colors.primaryMuted}
                    />
                    <Text style={styles.kelasText}>{kelas}</Text>
                    <Text style={styles.jumlah}>{jumlah} siswa</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {selectedClass && (
              <View style={styles.listContainer}>
                <SectionHeader
                  title={`Siswa ${selectedClass}`}
                  hint={`${siswa.length} siswa terdaftar. Edit nama/kelas, hapus siswa, atau reset satu kelas penuh.`}
                  rightSlot={
                    <TouchableOpacity
                      style={[styles.resetButton, processingAction === "reset" && styles.disabledButton]}
                      onPress={resetClassUsers}
                      disabled={processingAction !== null}
                    >
                      <Ionicons name="refresh-outline" size={16} color="#fff" />
                      <Text style={styles.resetButtonText}>
                        {processingAction === "reset" ? "Reset..." : "Reset Kelas"}
                      </Text>
                    </TouchableOpacity>
                  }
                />

                <View style={styles.searchBox}>
                  <Ionicons name="search-outline" size={18} color="#6d7e90" />
                  <TextInput
                    placeholder="Cari nama siswa"
                    placeholderTextColor="#A89F9F"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={styles.searchInput}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  {searchQuery ? (
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                      <Ionicons name="close-circle" size={18} color="#6d7e90" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {siswa.length === 0 ? (
                  <Text style={styles.kosong}>
                    {searchQuery ? "Nama siswa tidak ditemukan" : "Belum ada akun"}
                  </Text>
                ) : (
                  siswa.map((user) => (
                    <View key={user.id} style={styles.userItem}>
                      <View style={styles.userInfo}>
                          <Ionicons name="person-circle" size={24} color={AppTheme.colors.primary} />
                        <View style={styles.userTextWrap}>
                          <Text style={styles.nama}>{user.nama}</Text>
                          <Text style={styles.kelasBadge}>{user.kelas}</Text>
                        </View>
                      </View>
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={styles.editButton}
                          onPress={() => openEditModal(user)}
                          disabled={processingAction !== null}
                        >
                          <Ionicons name="create-outline" size={16} color="#16324f" />
                          <Text style={styles.editButtonText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => deleteUser(user)}
                          disabled={processingAction !== null}
                        >
                          <Ionicons name="trash-outline" size={16} color="#fff" />
                          <Text style={styles.deleteButtonText}>Hapus</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </ScrollView>
        )}

      <Modal transparent animationType="fade" visible={createModalVisible} onRequestClose={closeCreateModal}>
        <View style={styles.modalOverlay}>
          <ModalCard>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Tambah akun</Text>
                <Text style={styles.modalTitle}>Tambah Akun Siswa</Text>
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={closeCreateModal}>
                <Ionicons name="close" size={18} color="#16324f" />
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Nama siswa"
              placeholderTextColor="#A89F9F"
              value={createNama}
              onChangeText={(text) => setCreateNama(normalizeStudentName(text))}
              style={styles.input}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
            />

            <TextInput
              placeholder="Email"
              placeholderTextColor="#A89F9F"
              value={createEmail}
              onChangeText={setCreateEmail}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />

            <TextInput
              placeholder="Password"
              placeholderTextColor="#A89F9F"
              value={createPassword}
              onChangeText={setCreatePassword}
              style={styles.input}
              secureTextEntry
            />

            <View style={styles.pickerBox}>
              <Picker selectedValue={createKelas} onValueChange={(value) => setCreateKelas(value)}>
                {classes.map((kelas) => (
                  <Picker.Item key={kelas} label={kelas} value={kelas} />
                ))}
              </Picker>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, processingAction === "create" && styles.disabledButton]}
              onPress={() => createUser()}
              disabled={processingAction === "create"}
            >
              <Text style={styles.saveButtonText}>
                {processingAction === "create" ? "Membuat..." : "Tambah Akun"}
              </Text>
            </TouchableOpacity>
          </ModalCard>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={editModalVisible} onRequestClose={closeEditModal}>
        <View style={styles.modalOverlay}>
          <ModalCard>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Edit siswa</Text>
                <Text style={styles.modalTitle}>{editingUser?.nama || "-"}</Text>
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={closeEditModal}>
                <Ionicons name="close" size={18} color="#16324f" />
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Nama siswa"
              placeholderTextColor="#A89F9F"
              value={editNama}
              onChangeText={(text) => setEditNama(normalizeStudentName(text))}
              style={styles.input}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
            />

            <View style={styles.pickerBox}>
              <Picker selectedValue={editKelas} onValueChange={(value) => setEditKelas(value)}>
                {classes.map((kelas) => (
                  <Picker.Item key={kelas} label={kelas} value={kelas} />
                ))}
              </Picker>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, processingAction === "edit" && styles.disabledButton]}
              onPress={() => saveUserUpdate()}
              disabled={processingAction === "edit"}
            >
              <Text style={styles.saveButtonText}>
                {processingAction === "edit" ? "Menyimpan..." : "Simpan Perubahan"}
              </Text>
            </TouchableOpacity>
          </ModalCard>
        </View>
      </Modal>

    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingBottom: AppTheme.spacing.lg },
  addHeaderButton: {
    width: 44,
    height: 44,
    borderRadius: AppTheme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.colors.primary,
    shadowColor: AppTheme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  card: {
    width: "48%",
    backgroundColor: AppTheme.colors.surface,
    padding: AppTheme.spacing.xl,
    borderRadius: AppTheme.radius.lg,
    alignItems: "center",
    marginBottom: AppTheme.spacing.lg,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    ...AppTheme.shadow.sm,
  },
  cardActive: { backgroundColor: AppTheme.colors.primarySoft, borderWidth: 1, borderColor: AppTheme.colors.primary },
  kelasText: { ...AppTheme.typography.titleSm, marginTop: AppTheme.spacing.sm, color: AppTheme.colors.text },
  jumlah: { ...AppTheme.typography.bodySm, marginTop: AppTheme.spacing.xs },
  listContainer: {
    marginTop: AppTheme.spacing.xl,
    backgroundColor: AppTheme.colors.surface,
    padding: AppTheme.spacing.xl,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    marginBottom: AppTheme.spacing.md,
    ...AppTheme.shadow.sm,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.sm,
    backgroundColor: AppTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    borderRadius: AppTheme.radius.md,
    paddingHorizontal: AppTheme.spacing.lg,
    paddingVertical: 4,
    marginBottom: AppTheme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    color: AppTheme.colors.text,
    fontFamily: AppTheme.fonts.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.xs,
    backgroundColor: AppTheme.colors.danger,
    borderRadius: AppTheme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  resetButtonText: { ...AppTheme.typography.bodyStrong, color: AppTheme.colors.white },
  userItem: {
    paddingVertical: AppTheme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: AppTheme.colors.border,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userTextWrap: { marginLeft: AppTheme.spacing.sm, flex: 1 },
  nama: { ...AppTheme.typography.bodyStrong, color: AppTheme.colors.text },
  kelasBadge: { ...AppTheme.typography.bodySm, marginTop: AppTheme.spacing.xs },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: AppTheme.spacing.sm,
    gap: AppTheme.spacing.sm,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.xs,
    backgroundColor: AppTheme.colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: AppTheme.radius.sm,
  },
  editButtonText: { ...AppTheme.typography.bodyStrong, color: AppTheme.colors.primary },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.xs,
    backgroundColor: AppTheme.colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: AppTheme.radius.sm,
  },
  deleteButtonText: { ...AppTheme.typography.bodyStrong, color: AppTheme.colors.white },
  kosong: { ...AppTheme.typography.bodySm, fontStyle: "italic" },
  modalOverlay: {
    flex: 1,
    backgroundColor: AppTheme.colors.overlay,
    justifyContent: "center",
    padding: AppTheme.spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: AppTheme.spacing.lg,
  },
  modalEyebrow: { ...AppTheme.typography.label, marginBottom: AppTheme.spacing.xs },
  modalTitle: { ...AppTheme.typography.title },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: AppTheme.radius.sm,
    backgroundColor: AppTheme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    backgroundColor: AppTheme.colors.surface,
    padding: AppTheme.spacing.lg,
    borderRadius: AppTheme.radius.md,
    marginBottom: AppTheme.spacing.lg,
    fontFamily: AppTheme.fonts.medium,
    fontSize: 16,
    lineHeight: 22,
    color: AppTheme.colors.text,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  pickerBox: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.md,
    marginBottom: AppTheme.spacing.xl,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    overflow: "hidden",
  },
  saveButton: {
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radius.md,
    paddingVertical: AppTheme.spacing.lg,
    alignItems: "center",
  },
  saveButtonText: { ...AppTheme.typography.button },
  disabledButton: { opacity: 0.7 },
})
