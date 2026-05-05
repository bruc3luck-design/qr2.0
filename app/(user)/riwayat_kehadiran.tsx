import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
} from "react-native"
import { useEffect, useState, useCallback } from "react"
import { supabase } from "../../lib/supabase"
import { Ionicons } from "@expo/vector-icons"
import { Picker } from "@react-native-picker/picker"
import { UserBottomNav } from "../../components/user-bottom-nav"
import { useFeatureBack } from "../../hooks/use-feature-back"
import { getLocalDateValue, getLocalMonthValue, shiftMonthValue } from "../../lib/date"
import { getYearOptions, MONTH_OPTIONS } from "../../lib/calendar"
import { AppTheme } from "../../constants/theme"
import { InfoCard } from "../../components/ui/info-card"
import { ModalCard } from "../../components/ui/modal-card"
import { PageHeader } from "../../components/ui/page-header"
import { ScreenShell } from "../../components/ui/screen-shell"

type AttendanceItem = {
  id: string
  tanggal: string
  waktu?: string | null
  status?: string | null
}

export default function RiwayatKehadiran() {
  const [data, setData] = useState<AttendanceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [calendarVisible, setCalendarVisible] = useState(false)
  const [selectedDate, setSelectedDate] = useState(getLocalDateValue())
  const [calendarMonth, setCalendarMonth] = useState(getLocalMonthValue())
  const handleBack = useFeatureBack({
    fallbackRoute: "/user",
    beforeBack: () => {
      if (calendarVisible) {
        setCalendarVisible(false)
        return true
      }

      return false
    },
  })

  const getRiwayat = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    if (!userId) {
      setLoading(false)
      setRefreshing(false)
      return
    }

    const { data: attendanceData, error } = await supabase
      .from("absensi")
      .select("*")
      .eq("user_id", userId)
      .order("tanggal", { ascending: false })

    if (!error && attendanceData) {
      const filtered = attendanceData.filter((item) => item.status && item.status !== "Belum Absen")
      setData(filtered)

      if (filtered.length) {
        setSelectedDate((prev) => prev || filtered[0].tanggal)
      }
    }

    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    getRiwayat()
    let subscription: any = null

    const setupRealtime = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      if (!userId) return

      subscription = supabase
        .channel("public:absensi-history")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "absensi",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            getRiwayat()
          }
        )
        .subscribe()
    }

    setupRealtime()

    return () => {
      if (subscription) supabase.removeChannel(subscription)
    }
  }, [getRiwayat])

  useEffect(() => {
    setCalendarMonth(selectedDate.slice(0, 7))
  }, [selectedDate])

  const onRefresh = () => {
    setRefreshing(true)
    getRiwayat()
  }

  const formatMonthLabel = (monthValue: string) =>
    new Date(`${monthValue}-01T00:00:00`).toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    })

  const formatTanggal = (tanggal: string) =>
    new Date(`${tanggal}T00:00:00`).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })

  const changeMonth = (offset: number) => {
    setCalendarMonth(shiftMonthValue(calendarMonth, offset))
  }

  const handleMonthPickerChange = (monthNumber: number) => {
    const [year] = calendarMonth.split("-")
    setCalendarMonth(`${year}-${String(monthNumber).padStart(2, "0")}`)
  }

  const handleYearPickerChange = (year: number) => {
    const [, month] = calendarMonth.split("-")
    setCalendarMonth(`${year}-${month}`)
  }

  const getCalendarDays = () => {
    const [year, month] = calendarMonth.split("-").map(Number)
    const firstDay = new Date(year, month - 1, 1)
    const startDay = (firstDay.getDay() + 6) % 7
    const daysInMonth = new Date(year, month, 0).getDate()
    const days: string[] = []

    for (let index = 0; index < startDay; index += 1) {
      days.push("")
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      days.push(`${calendarMonth}-${String(day).padStart(2, "0")}`)
    }

    while (days.length % 7 !== 0) {
      days.push("")
    }

    return days
  }

  const getStatusColor = (status: string | null | undefined) => {
    const normalized = String(status || "").toLowerCase()
    if (normalized === "hadir") return AppTheme.colors.success
    if (normalized === "izin") return AppTheme.colors.warning
    if (normalized === "sakit") return AppTheme.colors.danger
    return AppTheme.colors.textSoft
  }

  const getStatusLabel = (status: string | null | undefined) => {
    if (!status) return "Tidak Hadir"
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const getAttendanceByDate = (tanggal: string) => data.find((item) => item.tanggal === tanggal)

  const selectedAttendance = getAttendanceByDate(selectedDate)

  return (
    <ScreenShell
      scroll
      footer={<UserBottomNav activeKey="riwayat_kehadiran" />}
      scrollProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />,
      }}
    >
        <View style={styles.shell}>
          <PageHeader eyebrow="Kalender pribadi" title="Riwayat Kehadiran" onBackPress={handleBack} />

          <InfoCard
            title="Rekap kehadiran per bulan"
            description="Pilih bulan dari kalender untuk melihat status hadir, izin, sakit, atau tidak hadir."
          />

          {loading ? (
          <ActivityIndicator size="large" color={AppTheme.colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Periode aktif</Text>
                <Text style={styles.summaryValue}>{formatMonthLabel(selectedDate.slice(0, 7))}</Text>
                <TouchableOpacity
                  style={styles.secondaryAction}
                  onPress={() => {
                    setCalendarMonth(selectedDate.slice(0, 7))
                    setCalendarVisible(true)
                  }}
                >
                  <Ionicons name="calendar-outline" size={18} color="#16324f" />
                  <Text style={styles.secondaryActionText}>Pilih Bulan</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Tanggal dipilih</Text>
                <Text style={styles.detailDate}>{formatTanggal(selectedDate)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(selectedAttendance?.status)}22` }]}>
                  <Text style={[styles.statusBadgeText, { color: getStatusColor(selectedAttendance?.status) }]}>
                    {getStatusLabel(selectedAttendance?.status)}
                  </Text>
                </View>
                <Text style={styles.detailTime}>
                  {selectedAttendance?.waktu ? `Waktu: ${selectedAttendance.waktu}` : "Belum ada waktu tercatat"}
                </Text>
              </View>

              <View style={styles.calendarPreview}>
                <View style={styles.weekHeader}>
                  {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
                    <Text key={day} style={styles.weekLabel}>{day}</Text>
                  ))}
                </View>

                <View style={styles.calendarGrid}>
                  {getCalendarDays().map((item, index) => {
                    if (!item) {
                      return <View key={`empty-${index}`} style={styles.calendarCell} />
                    }

                    const selected = selectedDate === item
                    const itemStatus = getAttendanceByDate(item)?.status

                    return (
                      <TouchableOpacity
                        key={item}
                        style={[styles.calendarCell, selected && styles.calendarCellActive]}
                        onPress={() => setSelectedDate(item)}
                      >
                        <Text style={[styles.calendarCellText, selected && styles.calendarCellTextActive]}>
                          {item.slice(-2).replace(/^0/, "")}
                        </Text>
                        <View style={[styles.calendarDot, { backgroundColor: getStatusColor(itemStatus) }]} />
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            </>
          )}
        </View>
      

      <Modal transparent animationType="fade" visible={calendarVisible} onRequestClose={() => setCalendarVisible(false)}>
        <View style={styles.modalOverlay}>
          <ModalCard>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Pilih bulan</Text>
                <Text style={styles.modalTitle}>{formatMonthLabel(calendarMonth)}</Text>
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={() => setCalendarVisible(false)}>
                <Ionicons name="close" size={18} color="#16324f" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalMonthHeader}>
              <TouchableOpacity style={styles.calendarNav} onPress={() => changeMonth(-1)}>
                <Ionicons name="chevron-back" size={18} color="#22405f" />
              </TouchableOpacity>
              <Text style={styles.modalMonthTitle}>{formatMonthLabel(calendarMonth)}</Text>
              <TouchableOpacity style={styles.calendarNav} onPress={() => changeMonth(1)}>
                <Ionicons name="chevron-forward" size={18} color="#22405f" />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerRow}>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={Number(calendarMonth.split("-")[1])}
                  onValueChange={(value) => handleMonthPickerChange(Number(value))}
                >
                  {MONTH_OPTIONS.map((item) => (
                    <Picker.Item key={item.value} label={item.label} value={item.value} />
                  ))}
                </Picker>
              </View>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={Number(calendarMonth.split("-")[0])}
                  onValueChange={(value) => handleYearPickerChange(Number(value))}
                >
                  {getYearOptions(Number(calendarMonth.split("-")[0]), 5).map((year) => (
                    <Picker.Item key={year} label={String(year)} value={year} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.weekHeader}>
              {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
                <Text key={day} style={styles.weekLabel}>{day}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {getCalendarDays().map((item, index) => {
                if (!item) {
                  return <View key={`modal-empty-${index}`} style={styles.calendarCell} />
                }

                const selected = selectedDate === item
                const itemStatus = getAttendanceByDate(item)?.status

                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.calendarCell, selected && styles.calendarCellActive]}
                    onPress={() => {
                      setSelectedDate(item)
                      setCalendarVisible(false)
                    }}
                  >
                    <Text style={[styles.calendarCellText, selected && styles.calendarCellTextActive]}>
                      {item.slice(-2).replace(/^0/, "")}
                    </Text>
                    <View style={[styles.calendarDot, { backgroundColor: getStatusColor(itemStatus) }]} />
                  </TouchableOpacity>
                )
              })}
            </View>
          </ModalCard>
        </View>
      </Modal>
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  shell: {
    gap: AppTheme.spacing.lg,
  },
  summaryCard: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.lg,
    padding: AppTheme.spacing.xl,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    ...AppTheme.shadow.sm,
  },
  summaryLabel: {
    ...AppTheme.typography.label,
    marginBottom: AppTheme.spacing.xs,
  },
  summaryValue: {
    ...AppTheme.typography.title,
    marginBottom: AppTheme.spacing.lg,
  },
  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.colors.primarySoft,
    borderRadius: AppTheme.radius.sm,
    paddingVertical: AppTheme.spacing.md,
    gap: AppTheme.spacing.sm,
  },
  secondaryActionText: {
    ...AppTheme.typography.bodyStrong,
    color: AppTheme.colors.primary,
  },
  detailCard: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.lg,
    padding: AppTheme.spacing.xl,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    ...AppTheme.shadow.sm,
  },
  detailLabel: {
    ...AppTheme.typography.label,
    marginBottom: AppTheme.spacing.xs,
  },
  detailDate: {
    ...AppTheme.typography.titleSm,
    marginBottom: AppTheme.spacing.sm,
  },
  detailTime: {
    ...AppTheme.typography.bodySm,
    marginTop: AppTheme.spacing.sm,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: AppTheme.radius.pill,
  },
  statusBadgeText: {
    fontWeight: "800",
  },
  calendarPreview: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.lg,
    padding: AppTheme.spacing.lg,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    ...AppTheme.shadow.sm,
  },
  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  weekLabel: {
    width: "14.28%",
    textAlign: "center",
    color: AppTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    marginBottom: 8,
  },
  calendarCellActive: {
    backgroundColor: AppTheme.colors.primary,
  },
  calendarCellText: {
    color: AppTheme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  calendarCellTextActive: {
    color: AppTheme.colors.white,
  },
  calendarDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: AppTheme.colors.overlay,
    justifyContent: "center",
    padding: AppTheme.spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalEyebrow: {
    ...AppTheme.typography.label,
    marginBottom: AppTheme.spacing.xs,
  },
  modalTitle: {
    ...AppTheme.typography.title,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: AppTheme.radius.sm,
    backgroundColor: AppTheme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  modalMonthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: AppTheme.spacing.lg,
    marginBottom: AppTheme.spacing.md,
  },
  modalMonthTitle: {
    ...AppTheme.typography.bodyStrong,
  },
  calendarNav: {
    width: 36,
    height: 36,
    borderRadius: AppTheme.radius.sm,
    backgroundColor: AppTheme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerRow: {
    flexDirection: "row",
    gap: AppTheme.spacing.sm,
    marginBottom: AppTheme.spacing.md,
  },
  pickerWrap: {
    flex: 1,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    borderRadius: AppTheme.radius.md,
    overflow: "hidden",
    backgroundColor: AppTheme.colors.surface,
  },
})
