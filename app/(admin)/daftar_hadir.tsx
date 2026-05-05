import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from "react-native"
import { useEffect, useState, useCallback } from "react"
import { supabase } from "../../lib/supabase"
import { supabaseAdmin } from "../../lib/supabaseAdmin"
import { Ionicons } from "@expo/vector-icons"
import { Picker } from "@react-native-picker/picker"
import { SafeAreaView } from "react-native-safe-area-context"
import { AdminBottomNav } from "../../components/admin-bottom-nav"
import { useFeatureBack } from "../../hooks/use-feature-back"
import { getLocalDateValue, getLocalMonthValue, shiftMonthValue } from "../../lib/date"
import { saveCsvFile } from "../../lib/device-files"
import { getYearOptions, MONTH_OPTIONS } from "../../lib/calendar"
import { compareStudentNames } from "../../lib/student"
import { AppTheme } from "../../constants/theme"

export default function DaftarHadir() {

  const kelasList = [
    "7 Banin",
    "7 Banat",
    "8 Banin",
    "8 Banat",
    "9 Banin",
    "9 Banat"
  ]

  const [profiles,setProfiles] = useState<any[]>([])
  const [absensi,setAbsensi] = useState<any[]>([])
  const [availableDates,setAvailableDates] = useState<string[]>([])
  const [selectedKelas,setSelectedKelas] = useState<string | null>(null)
  const [selectedDate,setSelectedDate] = useState(getLocalDateValue())
  const [calendarMonth,setCalendarMonth] = useState(getLocalMonthValue())
  const [refreshing,setRefreshing] = useState(false)
  const [calendarVisible,setCalendarVisible] = useState(false)
  const [actionLoading,setActionLoading] = useState<"reset" | "download" | null>(null)
  const [searchQuery,setSearchQuery] = useState("")

  const today = getLocalDateValue()
  const handleBack = useFeatureBack({
    fallbackRoute: "/admin",
    beforeBack: () => {
      if (calendarVisible) {
        setCalendarVisible(false)
        return true
      }

      if (selectedKelas) {
        setSelectedKelas(null)
        return true
      }

      return false
    },
  })

  const formatTanggal = (tanggal:string) => {
    const date = new Date(`${tanggal}T00:00:00`)
    return date.toLocaleDateString("id-ID", {
      weekday:"long",
      day:"numeric",
      month:"long",
      year:"numeric",
    })
  }

  const selectedPeriodMonth = selectedDate.slice(0, 7)

  const formatMonthLabel = (monthValue:string) =>
    new Date(`${monthValue}-01T00:00:00`).toLocaleDateString("id-ID", {
      month:"long",
      year:"numeric",
    })

  const getMonthDateValues = (monthValue:string) => {
    const [year, month] = monthValue.split("-").map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()

    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = String(index + 1).padStart(2, "0")
      return `${monthValue}-${day}`
    })
  }

  const changeMonth = (offset:number) => {
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
    const days:string[] = []

    for (let index = 0; index < startDay; index += 1) {
      days.push("")
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const value = `${calendarMonth}-${String(day).padStart(2, "0")}`
      days.push(value)
    }

    while (days.length % 7 !== 0) {
      days.push("")
    }

    return days
  }

  // Load data awal
  const loadData = useCallback(async () => {
    const [
      { data:profileData },
      { data:absenData },
      { data:allDatesData },
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("role", "user"),
      supabaseAdmin.from("absensi").select("*").eq("tanggal",selectedDate),
      supabaseAdmin.from("absensi").select("tanggal").order("tanggal",{ ascending:false }),
    ])

    const uniqueDates = Array.from(
      new Set([today, ...(allDatesData || []).map(item => item.tanggal).filter(Boolean)])
    ).sort((a,b) => b.localeCompare(a))

    setProfiles(
      [...(profileData || [])].sort((a, b) => compareStudentNames(a.nama, b.nama))
    )
    setAbsensi(absenData || [])
    setAvailableDates(uniqueDates)
  }, [selectedDate, today])

  useEffect(()=>{
    loadData()

    // --- REALTIME SUBSCRIPTION ---
    const profileSub = supabase
      .channel("profiles_channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        loadData()
      })
      .subscribe()

    const absensiSub = supabase
      .channel("absensi_channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "absensi" }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(profileSub)
      supabase.removeChannel(absensiSub)
    }
  }, [loadData])

  useEffect(() => {
    setCalendarMonth(selectedDate.slice(0, 7))
  }, [selectedDate])

  useEffect(() => {
    setSearchQuery("")
  }, [selectedKelas])

  // Toggle status absensi dengan konfirmasi popup
  const toggleStatus = async (uid:string,status:string) => {
    const user = profiles.find(u => u.id === uid)
    const existing = absensi.find(a => a.user_id === uid && a.tanggal === selectedDate)
    if(!user) return

    // Konfirmasi popup
    Alert.alert(
      "Konfirmasi Absensi",
      existing && existing.status === status
        ? `Apakah Anda ingin menghapus status "${status}" untuk ${user.nama}?`
        : `Apakah Anda yakin ingin mengubah status ke "${status}" untuk ${user.nama}?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Iya",
          onPress: async () => {
            try {
              if(existing){
                if(existing.status === status){
                  // klik dua kali → hapus status
                  await supabaseAdmin.from("absensi")
                    .update({ status: null })
                    .eq("user_id",uid)
                    .eq("tanggal",selectedDate)
                    .throwOnError()

                  setAbsensi(prev => prev.map(a =>
                    a.user_id===uid && a.tanggal === selectedDate ? {...a,status:null} : a
                  ))
                } else {
                  // update status baru
                  await supabaseAdmin.from("absensi")
                    .update({ status })
                    .eq("user_id",uid)
                    .eq("tanggal",selectedDate)
                    .throwOnError()

                  setAbsensi(prev => prev.map(a =>
                    a.user_id===uid && a.tanggal === selectedDate ? {...a,status} : a
                  ))
                }
              } else {
                // insert baru
                const { data:newData } = await supabaseAdmin.from("absensi").insert({
                  user_id:uid,
                  nama:user.nama,
                  kelas:user.kelas,
                  tanggal:selectedDate,
                  status
                }).select().single()

                if(newData) {
                  setAbsensi(prev => [...prev,newData])
                  setAvailableDates(prev =>
                    prev.includes(selectedDate)
                      ? prev
                      : [selectedDate, ...prev].sort((a,b) => b.localeCompare(a))
                  )
                }
              }
            } catch(err){
              console.log(err)
            }
          }
        }
      ]
    )
  }

  const getStatus = (uid:string) => {
    const data = absensi.find(a => a.user_id === uid)
    return data?.status || null
  }

  const getStatusLabel = (status:string | null) => {
    if (status === "hadir") return "Hadir"
    if (status === "izin") return "Izin"
    if (status === "sakit") return "Sakit"
    return "Tidak Hadir"
  }

  const closeCalendar = () => setCalendarVisible(false)

  const openCalendar = () => {
    setCalendarMonth(selectedDate.slice(0, 7))
    setCalendarVisible(true)
  }

  const selectDateFromCalendar = (dateValue:string) => {
    setSelectedDate(dateValue)
    setCalendarVisible(false)
  }

  const resetKelasAttendance = () => {
    if (!selectedKelas) return

    Alert.alert(
      "Reset Daftar Hadir",
      `Hapus semua data absensi kelas ${selectedKelas} pada ${formatTanggal(selectedDate)}?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              setActionLoading("reset")
              const { error } = await supabaseAdmin
                .from("absensi")
                .delete()
                .eq("kelas", selectedKelas)
                .eq("tanggal", selectedDate)

              if (error) {
                throw error
              }

              setAbsensi(prev =>
                prev.filter(item => !(item.kelas === selectedKelas && item.tanggal === selectedDate))
              )

              const { data: remainingDateData } = await supabaseAdmin
                .from("absensi")
                .select("id")
                .eq("tanggal", selectedDate)
                .limit(1)

              if (!remainingDateData?.length && selectedDate !== today) {
                setAvailableDates(prev => prev.filter(item => item !== selectedDate))
              }

              Alert.alert("Berhasil", `Data absensi kelas ${selectedKelas} berhasil direset.`)
            } catch (error) {
              console.log(error)
              Alert.alert("Gagal", "Reset daftar hadir belum berhasil. Coba lagi ya.")
            } finally {
              setActionLoading(null)
            }
          }
        }
      ]
    )
  }

  const downloadAttendance = async () => {
    if (!selectedKelas) return

    try {
      setActionLoading("download")

      const monthDates = getMonthDateValues(selectedPeriodMonth)
      const monthStart = `${selectedPeriodMonth}-01`
      const nextMonthStart = shiftMonthValue(selectedPeriodMonth, 1) + "-01"

      const { data: monthlyAbsensi, error: monthlyAbsensiError } = await supabaseAdmin
        .from("absensi")
        .select("nama, tanggal, status, created_at")
        .eq("kelas", selectedKelas)
        .gte("tanggal", monthStart)
        .lt("tanggal", nextMonthStart)
        .order("tanggal", { ascending: true })
        .order("nama", { ascending: true })

      if (monthlyAbsensiError) {
        throw monthlyAbsensiError
      }

      const csvRows =
        (monthlyAbsensi || []).length > 0
          ? (monthlyAbsensi || []).map((item, index) => [
              index + 1,
              item.nama || "-",
              item.tanggal,
              item.created_at
                ? new Date(item.created_at).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "-",
              getStatusLabel(item.status || null),
            ])
          : monthDates.map((date, index) => [index + 1, "-", date, "-", "Tidak Hadir"])

      const escapeCsvValue = (value:string | number) => `"${String(value).replace(/"/g, '""')}"`

      const csvContent = [
        [`LAPORAN ABSENSI BULANAN ${selectedKelas}`].map(escapeCsvValue).join(","),
        [`Periode ${formatMonthLabel(selectedPeriodMonth)}`].map(escapeCsvValue).join(","),
        [`Format buku absensi kelas ${selectedKelas}`].map(escapeCsvValue).join(","),
        ["No", "Nama Siswa", "Tanggal", "Waktu Hadir", "Status"]
          .map(escapeCsvValue)
          .join(","),
        ...csvRows.map(row => row.map(escapeCsvValue).join(",")),
      ].join("\n")

      const safeClassName = selectedKelas.toLowerCase().replace(/\s+/g, "_")
      const fileName = `daftar_hadir_${safeClassName}_${selectedPeriodMonth}.csv`

      const result = await saveCsvFile(fileName, csvContent)
      const successMessage =
        result.mode === "saved"
          ? `File daftar hadir bulanan kelas ${selectedKelas} berhasil disimpan ke folder yang dipilih.`
          : result.mode === "shared"
            ? `File daftar hadir bulanan kelas ${selectedKelas} siap dibagikan atau disimpan dari menu perangkat.`
            : `File daftar hadir bulanan kelas ${selectedKelas} siap diunduh.`

      Alert.alert("Berhasil", successMessage)
    } catch (error) {
      console.log(error)
      Alert.alert("Gagal", "Download daftar hadir belum berhasil. Coba lagi ya.")
    } finally {
      setActionLoading(null)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  // Daftar kelas
  if(!selectedKelas){
    return(
      <SafeAreaView edges={["top"]} style={styles.screen}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/> }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.shell}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={18} color="#6D3BFF" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>Kontrol kelas</Text>
            <Text style={styles.headerTitle}>Daftar Hadir</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoTopRow}>
            <View style={styles.infoHeaderCopy}>
              <Text style={styles.infoTitle}>Pilih kelas untuk memperbarui kehadiran</Text>
              <Text style={styles.infoText}>
                Pilih kelas untuk mengatur status hadir, izin, dan sakit secara manual.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.grid}>
          {kelasList.map(item => {
            const jumlahSiswa = profiles.filter(profile => profile.kelas === item).length

            return (
              <TouchableOpacity
                key={item}
                style={styles.card}
                onPress={()=>setSelectedKelas(item)}
              >
                <View style={styles.cardIconWrap}>
                  <Ionicons name="people-outline" size={22} color={AppTheme.colors.primary} />
                </View>
                <Text style={styles.cardText}>{item}</Text>
                <Text style={styles.cardCount}>{jumlahSiswa} siswa</Text>
              </TouchableOpacity>
            )
          })}
        </View>
          </View>
        </ScrollView>
        <Modal
          animationType="fade"
          transparent
          visible={calendarVisible}
          onRequestClose={closeCalendar}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalEyebrow}>Pilih tanggal</Text>
                  <Text style={styles.modalTitle}>{formatMonthLabel(calendarMonth)}</Text>
                </View>
                <TouchableOpacity style={styles.modalClose} onPress={closeCalendar}>
                  <Ionicons name="close" size={18} color="#16324f" />
                </TouchableOpacity>
              </View>

              <View style={styles.calendarHeader}>
                <TouchableOpacity style={styles.calendarNav} onPress={() => changeMonth(-1)}>
                  <Ionicons name="chevron-back" size={18} color="#22405f" />
                </TouchableOpacity>
                <Text style={styles.calendarTitle}>{formatMonthLabel(calendarMonth)}</Text>
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
                {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(day => (
                  <Text key={day} style={styles.weekLabel}>{day}</Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {getCalendarDays().map((item, index) => {
                  if (!item) {
                    return <View key={`empty-${index}`} style={styles.calendarCell} />
                  }

                  const isSelected = selectedDate === item
                  const hasData = availableDates.includes(item)

                  return (
                    <TouchableOpacity
                      key={item}
                      style={[styles.calendarCell, isSelected && styles.calendarCellActive]}
                      onPress={() => selectDateFromCalendar(item)}
                    >
                      <Text style={[styles.calendarCellText, isSelected && styles.calendarCellTextActive]}>
                        {item.slice(-2).replace(/^0/, "")}
                      </Text>
                      {hasData ? <View style={[styles.calendarDot, isSelected && styles.calendarDotActive]} /> : null}
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          </View>
        </Modal>
        <AdminBottomNav activeKey="daftar_hadir" />
      </SafeAreaView>
    )
  }

  // Detail kelas
  const siswa = profiles
    .filter(p => p.kelas === selectedKelas)
    .sort((a, b) => compareStudentNames(a.nama, b.nama))

  const filteredSiswa = siswa.filter(item =>
    item.nama?.toLowerCase().includes(searchQuery.trim().toLowerCase())
  )

  return(
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/> }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.shell}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={18} color={AppTheme.colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.eyebrow}>Daftar siswa</Text>
          <Text style={styles.headerTitle}>Kelas {selectedKelas}</Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroDateWrap}>
            <Text style={styles.heroLabel}>Tanggal absensi</Text>
            <Text style={styles.heroDate}>{formatTanggal(selectedDate)}</Text>
          </View>
          <TouchableOpacity style={styles.inlineCalendarButton} onPress={openCalendar}>
            <Ionicons name="calendar-outline" size={18} color={AppTheme.colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total siswa</Text>
            <Text style={styles.summaryValue}>{siswa.length}</Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color="#6d7e90" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Cari nama siswa..."
            placeholderTextColor="#8ca0b3"
            style={styles.searchInput}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.searchClearButton}>
              <Ionicons name="close-circle" size={18} color="#8ca0b3" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.actionCard}>
        <TouchableOpacity
          style={[styles.secondaryAction, styles.downloadAction, actionLoading === "download" && styles.actionDisabled]}
          onPress={downloadAttendance}
          disabled={actionLoading !== null}
        >
          <Ionicons name="download-outline" size={18} color="#ffffff" />
          <Text style={styles.downloadActionText}>
            {actionLoading === "download" ? "Menyiapkan..." : `Download CSV ${formatMonthLabel(selectedPeriodMonth)}`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryAction, styles.resetAction, actionLoading === "reset" && styles.actionDisabled]}
          onPress={resetKelasAttendance}
          disabled={actionLoading !== null}
        >
          <Ionicons name="refresh-outline" size={18} color="#ffffff" />
          <Text style={styles.downloadActionText}>
            {actionLoading === "reset" ? "Mereset..." : "Reset Data"}
          </Text>
        </TouchableOpacity>
      </View>

      {siswa.length === 0 ? (
        <Text style={styles.emptyState}>
          Belum ada siswa di kelas ini
        </Text>
      ) : filteredSiswa.length === 0 ? (
        <Text style={styles.emptyState}>
          Nama siswa tidak ditemukan
        </Text>
      ) : (
        filteredSiswa.map(item => {
          const status = getStatus(item.id)
          return(
            <View key={item.id} style={styles.row}>
              <Text style={styles.nama}>{item.nama}</Text>
              <Text style={[styles.statusInfo, !status && styles.statusInfoEmpty]}>
                Status: {getStatusLabel(status)}
              </Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.btn,status==="hadir" && styles.hadir]}
                  onPress={()=>toggleStatus(item.id,"hadir")}
                >
                  <Text style={styles.btnText}>Hadir</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn,status==="izin" && styles.izin]}
                  onPress={()=>toggleStatus(item.id,"izin")}
                >
                  <Text style={styles.btnText}>Izin</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn,status==="sakit" && styles.sakit]}
                  onPress={()=>toggleStatus(item.id,"sakit")}
                >
                  <Text style={styles.btnText}>Sakit</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        })
      )}
        </View>
      </ScrollView>
      <Modal
        animationType="fade"
        transparent
        visible={calendarVisible}
        onRequestClose={closeCalendar}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Pilih tanggal</Text>
                <Text style={styles.modalTitle}>{formatMonthLabel(calendarMonth)}</Text>
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={closeCalendar}>
                <Ionicons name="close" size={18} color="#16324f" />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarHeader}>
              <TouchableOpacity style={styles.calendarNav} onPress={() => changeMonth(-1)}>
                <Ionicons name="chevron-back" size={18} color="#22405f" />
              </TouchableOpacity>
              <Text style={styles.calendarTitle}>{formatMonthLabel(calendarMonth)}</Text>
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
              {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(day => (
                <Text key={day} style={styles.weekLabel}>{day}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {getCalendarDays().map((item, index) => {
                if (!item) {
                  return <View key={`empty-${index}`} style={styles.calendarCell} />
                }

                const isSelected = selectedDate === item
                const hasData = availableDates.includes(item)

                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.calendarCell, isSelected && styles.calendarCellActive]}
                    onPress={() => selectDateFromCalendar(item)}
                  >
                    <Text style={[styles.calendarCellText, isSelected && styles.calendarCellTextActive]}>
                      {item.slice(-2).replace(/^0/, "")}
                    </Text>
                    {hasData ? <View style={[styles.calendarDot, isSelected && styles.calendarDotActive]} /> : null}
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        </View>
      </Modal>
      <AdminBottomNav activeKey="daftar_hadir" />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen:{
    flex:1,
    backgroundColor:AppTheme.colors.background,
  },
  scroll:{
    flex:1,
  },
  container:{
    paddingHorizontal:AppTheme.spacing["2xl"],
    paddingTop:AppTheme.spacing.lg,
    paddingBottom:AppTheme.spacing["3xl"],
  },
  shell:{
    gap:AppTheme.spacing.lg,
  },
  header:{
    flexDirection:"row",
    alignItems:"center",
    marginBottom:AppTheme.spacing.lg
  },
  backButton:{
    width:40,
    height:40,
    borderRadius:AppTheme.radius.sm,
    backgroundColor:AppTheme.colors.primarySoft,
    justifyContent:"center",
    alignItems:"center"
  },
  headerTextWrap:{
    marginLeft:AppTheme.spacing.md
  },
  eyebrow:{
    ...AppTheme.typography.eyebrow,
    color:AppTheme.colors.primary,
    marginBottom:AppTheme.spacing.xs
  },
  headerTitle:{
    ...AppTheme.typography.title,
  },
  infoCard:{
    backgroundColor:AppTheme.colors.primary,
    borderRadius:AppTheme.radius.xl,
    padding:AppTheme.spacing.xl,
    ...AppTheme.shadow.md,
  },
  infoHeaderCopy:{
    flex:1,
    paddingRight:12,
  },
  infoTopRow:{
    flexDirection:"row",
    justifyContent:"space-between",
    alignItems:"flex-start",
  },
  infoTitle:{
    ...AppTheme.typography.titleSm,
    color:AppTheme.colors.white,
  },
  infoText:{
    ...AppTheme.typography.bodySm,
    marginTop:AppTheme.spacing.xs,
    color:AppTheme.colors.primarySoft,
  },
  calendarHeader:{
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between",
    marginTop:16,
    marginBottom:14,
  },
  calendarNav:{
    width:36,
    height:36,
    borderRadius:12,
    backgroundColor:AppTheme.colors.primarySoft,
    alignItems:"center",
    justifyContent:"center",
  },
  calendarTitle:{
    color:AppTheme.colors.text,
    fontSize:15,
    fontWeight:"800",
  },
  pickerRow:{
    flexDirection:"row",
    gap:10,
    marginBottom:14,
  },
  pickerWrap:{
    flex:1,
    borderWidth:1,
    borderColor:AppTheme.colors.border,
    borderRadius:AppTheme.radius.md,
    overflow:"hidden",
    backgroundColor:AppTheme.colors.surface,
  },
  weekHeader:{
    flexDirection:"row",
    justifyContent:"space-between",
    marginBottom:10,
  },
  weekLabel:{
    width:"14.28%",
    textAlign:"center",
    color:AppTheme.colors.textMuted,
    fontSize:12,
    fontWeight:"700",
  },
  calendarGrid:{
    flexDirection:"row",
    flexWrap:"wrap",
  },
  calendarCell:{
    width:"14.28%",
    aspectRatio:1,
    alignItems:"center",
    justifyContent:"center",
    borderRadius:16,
    marginBottom:8,
  },
  calendarCellActive:{
    backgroundColor:AppTheme.colors.primary,
  },
  calendarCellText:{
    color:AppTheme.colors.text,
    fontSize:14,
    fontWeight:"700",
  },
  calendarCellTextActive:{
    color:AppTheme.colors.white,
  },
  calendarDot:{
    width:6,
    height:6,
    borderRadius:AppTheme.radius.pill,
    backgroundColor:AppTheme.colors.success,
    marginTop:4,
  },
  calendarDotActive:{
    backgroundColor:AppTheme.colors.white,
  },
  grid:{
    flexDirection:"row",
    flexWrap:"wrap",
    justifyContent:"space-between"
  },
  card:{
    flexBasis:"48%",
    backgroundColor:AppTheme.colors.surface,
    marginBottom:AppTheme.spacing.lg,
    paddingVertical:26,
    paddingHorizontal:AppTheme.spacing.lg,
    borderRadius:AppTheme.radius.xl,
    alignItems:"center",
    borderWidth:1,
    borderColor:AppTheme.colors.border,
    gap:8,
    ...AppTheme.shadow.sm,
  },
  cardIconWrap:{
    width:52,
    height:52,
    borderRadius:AppTheme.radius.md,
    backgroundColor:AppTheme.colors.accentSoft,
    alignItems:"center",
    justifyContent:"center",
  },
  cardText:{
    ...AppTheme.typography.titleSm,
    textAlign:"center",
  },
  cardCount:{
    ...AppTheme.typography.bodySm,
    marginTop:AppTheme.spacing.xs,
  },
  heroCard:{
    backgroundColor:AppTheme.colors.primary,
    borderRadius:AppTheme.radius.xl,
    padding:AppTheme.spacing.xl,
    gap:8,
    ...AppTheme.shadow.md,
  },
  heroTopRow:{
    flexDirection:"row",
    alignItems:"flex-start",
    justifyContent:"space-between",
  },
  heroDateWrap:{
    flex:1,
    paddingRight:12,
  },
  heroLabel:{
    color:AppTheme.colors.primarySoft,
    fontSize:12,
    fontWeight:"700",
    marginBottom:6,
    textTransform:"uppercase",
    letterSpacing:0.4,
  },
  inlineCalendarButton:{
    alignItems:"center",
    justifyContent:"center",
    width:44,
    height:44,
    borderRadius:14,
    backgroundColor:AppTheme.colors.accentSoft,
  },
  heroDate:{
    color:AppTheme.colors.white,
    fontFamily:AppTheme.fonts.extrabold,
    fontSize:24,
    lineHeight:32,
  },
  summaryRow:{
    flexDirection:"row",
    marginTop:8,
  },
  summaryCard:{
    alignSelf:"flex-start",
    backgroundColor:"rgba(255, 255, 255, 0.12)",
    borderRadius:AppTheme.radius.sm,
    paddingHorizontal:12,
    paddingVertical:10,
  },
  summaryLabel:{
    color:AppTheme.colors.primarySoft,
    fontSize:11,
    marginBottom:2,
  },
  summaryValue:{
    color:AppTheme.colors.white,
    fontSize:16,
    fontWeight:"800",
  },
  searchWrap:{
    marginTop:AppTheme.spacing.xs,
    flexDirection:"row",
    alignItems:"center",
    backgroundColor:AppTheme.colors.surface,
    borderRadius:AppTheme.radius.md,
    paddingHorizontal:14,
    paddingVertical:4,
    gap:8,
  },
  searchInput:{
    flex:1,
    color:AppTheme.colors.text,
    fontSize:14,
    paddingVertical:11,
  },
  searchClearButton:{
    paddingVertical:6,
  },
  row:{
    backgroundColor:AppTheme.colors.surface,
    padding:AppTheme.spacing.lg,
    borderRadius:AppTheme.radius.md,
    marginBottom:AppTheme.spacing.md,
    borderWidth:1,
    borderColor:AppTheme.colors.border,
    ...AppTheme.shadow.sm,
  },
  nama:{
    ...AppTheme.typography.titleSm,
    marginBottom:AppTheme.spacing.sm,
  },
  statusInfo:{
    ...AppTheme.typography.bodyStrong,
    color:AppTheme.colors.primary,
    marginBottom:AppTheme.spacing.sm,
  },
  statusInfoEmpty:{
    color:AppTheme.colors.textMuted,
  },
  buttonRow:{
    flexDirection:"row",
    justifyContent:"space-between"
  },
  btn:{
    flex:1,
    paddingVertical:10,
    marginHorizontal:AppTheme.spacing.xs,
    borderRadius:AppTheme.radius.sm,
    backgroundColor:AppTheme.colors.primarySoft,
    alignItems:"center"
  },
  hadir:{
    backgroundColor:AppTheme.colors.success
  },
  izin:{
    backgroundColor:"#FACC15"
  },
  sakit:{
    backgroundColor:AppTheme.colors.danger
  },
  btnText:{
    color:AppTheme.colors.white,
    fontFamily:AppTheme.fonts.semibold
  },
  emptyState:{
    color:AppTheme.colors.textMuted,
    textAlign:"center",
    marginBottom:12,
    marginTop:10,
    backgroundColor:AppTheme.colors.surface,
    borderRadius:AppTheme.radius.md,
    borderWidth:1,
    borderColor:AppTheme.colors.border,
    paddingVertical:18,
    paddingHorizontal:14,
  },
  actionCard:{
    marginBottom:AppTheme.spacing.xl,
    gap:AppTheme.spacing.sm,
  },
  secondaryAction:{
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:AppTheme.colors.primarySoft,
    borderRadius:AppTheme.radius.md,
    paddingVertical:13,
    gap:8,
  },
  secondaryActionText:{
    color:AppTheme.colors.primary,
    fontSize:14,
    fontWeight:"700",
  },
  downloadAction:{
    backgroundColor:AppTheme.colors.primary,
  },
  downloadActionText:{
    color:AppTheme.colors.white,
    fontSize:14,
    fontWeight:"700",
  },
  resetAction:{
    backgroundColor:AppTheme.colors.danger,
  },
  actionDisabled:{
    opacity:0.7,
  },
  modalOverlay:{
    flex:1,
    backgroundColor:AppTheme.colors.overlay,
    justifyContent:"center",
    padding:20,
  },
  modalCard:{
    backgroundColor:AppTheme.colors.surface,
    borderRadius:AppTheme.radius.xl,
    padding:18,
    borderWidth:1,
    borderColor:AppTheme.colors.border,
  },
  modalHeader:{
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between",
  },
  modalEyebrow:{
    color:AppTheme.colors.textMuted,
    fontSize:12,
    marginBottom:4,
  },
  modalTitle:{
    color:AppTheme.colors.text,
    fontSize:20,
    fontWeight:"800",
  },
  modalClose:{
    width:36,
    height:36,
    borderRadius:AppTheme.radius.sm,
    backgroundColor:AppTheme.colors.primarySoft,
    alignItems:"center",
    justifyContent:"center",
  }
})
