import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useEffect, useState } from "react"
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AdminBottomNav } from "../../components/admin-bottom-nav"
import { AppButton } from "../../components/ui/app-button"
import { AppCard } from "../../components/ui/app-card"
import { AppTheme } from "../../constants/theme"
import { SectionHeader } from "../../components/ui/section-header"
import { supabase } from "../../lib/supabase"
import { supabaseAdmin } from "../../lib/supabaseAdmin"
import { prepareNotifications, sendLocalNotification } from "../../lib/notifications"
import { PASSWORD_REQUEST_TYPE, formatSubmissionDate, formatSubmissionTime, getSubmissionDisplayType } from "../../lib/pengajuan"

const adminActions = [
  {
    title: "Daftar Akun",
    description: "Cek akun aktif dan tambah siswa",
    icon: "people-outline" as const,
    action: () => router.push("/daftar_akun"),
  },
  {
    title: "Daftar Hadir",
    description: "Pantau absensi harian",
    icon: "clipboard-outline" as const,
    action: () => router.push("/daftar_hadir" as any),
  },
]

type PendingSubmission = {
  id: string
  nama: string
  kelas: string
  jenis: string
  created_at: string
}

export default function Admin() {
  const [counts, setCounts] = useState({
    users: 0,
    pengajuan: 0,
    attendance: 0,
  })
  const [refreshing, setRefreshing] = useState(false)
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmission[]>([])

  const logout = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  const fetchCounts = async () => {
    const [usersResult, submissionResult, attendanceResult, pendingListResult] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "user"),
      supabaseAdmin
        .from("pengajuan")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .neq("jenis", PASSWORD_REQUEST_TYPE),
      supabase.from("absensi").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("pengajuan")
        .select("id, nama, kelas, jenis, created_at")
        .eq("status", "pending")
        .neq("jenis", PASSWORD_REQUEST_TYPE)
        .order("created_at", { ascending: false })
        .limit(5),
    ])

    setCounts({
      users: usersResult.count || 0,
      pengajuan: submissionResult.count || 0,
      attendance: attendanceResult.count || 0,
    })
    setPendingSubmissions((pendingListResult.data || []) as PendingSubmission[])
  }

  useEffect(() => {
    prepareNotifications()
    fetchCounts()

    const userSub = supabase
      .channel("public:profiles")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, fetchCounts)
      .subscribe()

    const submissionSub = supabase
        .channel("public:pengajuan")
        .on("postgres_changes", { event: "*", schema: "public", table: "pengajuan" }, (payload) => {
        if (payload.eventType === "INSERT" && payload.new?.jenis !== PASSWORD_REQUEST_TYPE) {
          sendLocalNotification("Pengajuan baru", "Ada pengajuan baru yang masuk ke panel admin.")
        }

        fetchCounts()
      })
      .subscribe()

    const attendanceSub = supabase
      .channel("public:absensi")
      .on("postgres_changes", { event: "*", schema: "public", table: "absensi" }, fetchCounts)
      .subscribe()

    return () => {
      supabase.removeChannel(userSub)
      supabase.removeChannel(submissionSub)
      supabase.removeChannel(attendanceSub)
    }
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchCounts()
    setRefreshing(false)
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Admin control center</Text>
            <Text style={styles.brand}>QRensi</Text>
            <Text style={styles.subtitle}>Kelola siswa, kehadiran, dan pengajuan dari satu pusat kontrol.</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} onPress={onRefresh} disabled={refreshing}>
              <Ionicons
                name={refreshing ? "hourglass-outline" : "refresh-outline"}
                size={18}
                color={AppTheme.colors.primary}
              />
            </TouchableOpacity>
            <AppButton label="Keluar" icon="log-out-outline" onPress={logout} style={styles.logoutButton} />
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Dasbor utama</Text>
          </View>
          <Text style={styles.heroTitle}>
            Kelola akun, absensi, dan pengajuan dengan tampilan penuh yang nyaman di layar HP.
          </Text>
          <Text style={styles.heroCaption}>
            Semua data tetap realtime. Menu cepat di bawah memudahkan akses ke seluruh fitur admin.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.noticeCard}
          onPress={() => router.push("/pengajuan" as any)}
          activeOpacity={0.92}
        >
          <View style={styles.noticeHeader}>
            <Text style={styles.noticeTitle}>Daftar Pengajuan</Text>
            <Text style={styles.noticeMeta}>{counts.pengajuan} pending</Text>
          </View>
          {pendingSubmissions.length === 0 ? (
            <Text style={styles.noticeEmpty}>Belum ada pengajuan izin atau sakit yang menunggu.</Text>
          ) : (
            pendingSubmissions.map((item) => (
              <View key={item.id} style={styles.noticeItem}>
                <View style={styles.noticeBadge}>
                  <Ionicons name="document-text-outline" size={16} color={AppTheme.colors.primary} />
                </View>
                <View style={styles.noticeCopy}>
                  <Text style={styles.noticeItemTitle}>{item.nama}</Text>
                  <Text style={styles.noticeText}>
                    {getSubmissionDisplayType(item.jenis)} • Kelas {item.kelas}
                  </Text>
                  <Text style={styles.noticeText}>
                    {formatSubmissionDate(item.created_at)} • {formatSubmissionTime(item.created_at)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <StatCard label="Siswa" value={counts.users} icon="people-outline" />
          <StatCard label="Pengajuan" value={counts.pengajuan} icon="document-text-outline" />
          <StatCard label="Absensi" value={counts.attendance} icon="clipboard-outline" />
        </View>

        <SectionHeader title="Menu cepat" hint="Akses utama admin" />

        <View style={styles.menuGrid}>
          {adminActions.map((item) => (
            <TouchableOpacity key={item.title} style={styles.menuItem} onPress={item.action} activeOpacity={0.92}>
              <View style={styles.iconBox}>
                <Ionicons name={item.icon} size={20} color={AppTheme.colors.primary} />
              </View>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.scanCard} onPress={() => router.push("/scanner" as any)} activeOpacity={0.94}>
          <View style={styles.scanCopy}>
            <Text style={styles.scanEyebrow}>Aksi cepat</Text>
            <Text style={styles.scanTitle}>Buka scanner QR</Text>
            <Text style={styles.scanText}>Lakukan check-in siswa langsung dari panel admin.</Text>
          </View>
          <View style={styles.scanIcon}>
            <Ionicons name="scan-outline" size={28} color={AppTheme.colors.white} />
          </View>
        </TouchableOpacity>
      </ScrollView>

      <AdminBottomNav activeKey="admin" />
    </SafeAreaView>
  )
}

const StatCard = ({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: keyof typeof Ionicons.glyphMap
}) => (
  <AppCard style={styles.statCard}>
    <View style={styles.statIcon}>
      <Ionicons name={icon} size={18} color={AppTheme.colors.primary} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </AppCard>
)

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: AppTheme.spacing["2xl"],
    paddingTop: AppTheme.spacing.lg,
    paddingBottom: AppTheme.spacing["3xl"],
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: AppTheme.spacing.md,
    marginBottom: AppTheme.spacing.xl,
    flexWrap: "wrap",
  },
  headerCopy: {
    flex: 1,
    minWidth: 180,
  },
  eyebrow: {
    ...AppTheme.typography.eyebrow,
    color: AppTheme.colors.primary,
    marginBottom: AppTheme.spacing.xs,
  },
  brand: {
    ...AppTheme.typography.display,
  },
  subtitle: {
    ...AppTheme.typography.bodySm,
    marginTop: AppTheme.spacing.xs,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: AppTheme.radius.sm,
    backgroundColor: AppTheme.colors.backgroundMuted,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  logoutButton: {
    minWidth: 120,
  },
  heroCard: {
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radius.xl,
    padding: AppTheme.spacing.xl,
    marginBottom: AppTheme.spacing.lg,
    ...AppTheme.shadow.md,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: AppTheme.colors.primaryMuted,
    borderRadius: AppTheme.radius.pill,
    paddingHorizontal: AppTheme.spacing.md,
    paddingVertical: AppTheme.spacing.sm,
  },
  heroBadgeText: {
    color: AppTheme.colors.primarySoft,
    fontFamily: AppTheme.fonts.semibold,
    fontSize: 12,
    lineHeight: 18,
  },
  heroTitle: {
    marginTop: AppTheme.spacing.lg,
    color: AppTheme.colors.white,
    fontFamily: AppTheme.fonts.extrabold,
    fontSize: 26,
    lineHeight: 34,
  },
  heroCaption: {
    marginTop: AppTheme.spacing.sm,
    color: "#bfd1e4",
    fontFamily: AppTheme.fonts.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  noticeCard: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.lg,
    padding: AppTheme.spacing.xl,
    marginBottom: AppTheme.spacing.lg,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    ...AppTheme.shadow.sm,
  },
  noticeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: AppTheme.spacing.md,
  },
  noticeMeta: {
    color: AppTheme.colors.primary,
    fontFamily: AppTheme.fonts.semibold,
    fontSize: 12,
    lineHeight: 18,
  },
  noticeItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: AppTheme.spacing.md,
    paddingTop: AppTheme.spacing.md,
    paddingBottom: AppTheme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: AppTheme.colors.border,
  },
  noticeBadge: {
    width: 40,
    height: 40,
    borderRadius: AppTheme.radius.sm,
    backgroundColor: AppTheme.colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  noticeTitle: {
    ...AppTheme.typography.titleSm,
  },
  noticeCopy: {
    flex: 1,
  },
  noticeItemTitle: {
    ...AppTheme.typography.bodyStrong,
    marginBottom: 2,
  },
  noticeText: {
    ...AppTheme.typography.bodySm,
  },
  noticeEmpty: {
    ...AppTheme.typography.bodySm,
  },
  statsRow: {
    flexDirection: "row",
    gap: AppTheme.spacing.md,
    marginBottom: AppTheme.spacing.xl,
  },
  statCard: {
    flex: 1,
    padding: AppTheme.spacing.lg,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: AppTheme.radius.sm,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: AppTheme.colors.primarySoft,
  },
  statValue: {
    ...AppTheme.typography.metric,
    marginTop: AppTheme.spacing.lg,
  },
  statLabel: {
    ...AppTheme.typography.bodySm,
    marginTop: AppTheme.spacing.xs,
  },
  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: AppTheme.spacing.md,
  },
  menuItem: {
    width: "48.5%",
    borderRadius: AppTheme.radius.lg,
    padding: AppTheme.spacing.lg,
    backgroundColor: AppTheme.colors.surface,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    minHeight: 140,
    ...AppTheme.shadow.sm,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: AppTheme.radius.sm,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: AppTheme.colors.primarySoft,
    marginBottom: AppTheme.spacing.lg,
  },
  menuTitle: {
    ...AppTheme.typography.titleSm,
  },
  menuSubtitle: {
    ...AppTheme.typography.bodySm,
    marginTop: AppTheme.spacing.sm,
  },
  scanCard: {
    marginTop: AppTheme.spacing.lg,
    backgroundColor: AppTheme.colors.backgroundMuted,
    borderRadius: AppTheme.radius.xl,
    padding: AppTheme.spacing.xl,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: AppTheme.spacing.md,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  scanCopy: {
    flex: 1,
  },
  scanEyebrow: {
    ...AppTheme.typography.eyebrow,
    color: AppTheme.colors.primary,
    marginBottom: AppTheme.spacing.xs,
  },
  scanTitle: {
    ...AppTheme.typography.title,
    marginBottom: AppTheme.spacing.xs,
  },
  scanText: {
    ...AppTheme.typography.bodySm,
  },
  scanIcon: {
    width: 56,
    height: 56,
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
})
