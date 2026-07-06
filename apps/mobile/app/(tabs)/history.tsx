import { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { databaseService } from '../../lib/services'
import { THEME } from '@nutrition/tokens'

type MealLog = {
  id: string
  meal_type: string
  description: string
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  created_at: string
  date: string
}

type WeeklyDay = { date: string; calories: number }

export default function HistoryScreen() {
  const [loading, setLoading] = useState(false)
  const [weeklyLoading, setWeeklyLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [logs, setLogs] = useState<MealLog[]>([])
  const [weeklyData, setWeeklyData] = useState<WeeklyDay[]>([])
  const [calorieTarget, setCalorieTarget] = useState(0)

  const loadWeekly = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [weekly, plan] = await Promise.all([
        databaseService.getWeeklyCalories(user.id),
        databaseService.getActiveNutritionPlan(user.id),
      ])
      setWeeklyData(weekly)
      if (plan) setCalorieTarget(plan.daily_calories)
    } catch (err) {
      console.error('Haftalık veri hatası:', err)
    } finally {
      setWeeklyLoading(false)
    }
  }, [])

  const loadLogs = useCallback(async (date: string) => {
    setLoading(true)
    setLogs([])
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const data = await databaseService.getMealLogs(user.id, date)
      setLogs((data as MealLog[]) || [])
    } catch (error) {
      console.error('Geçmiş yükleme hatası:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(useCallback(() => {
    loadWeekly()
    loadLogs(selectedDate)
  }, [selectedDate]))

  const handleDelete = async (id: string) => {
    Alert.alert('Öğünü Sil', 'Bu öğünü silmek istediğine emin misin?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          try {
            await databaseService.deleteMealLog(id)
            setLogs(prev => prev.filter(l => l.id !== id))
            // Haftalık veriyi de güncelle
            loadWeekly()
          } catch {
            Alert.alert('Hata', 'Öğün silinemedi.')
          }
        }
      }
    ])
  }

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    return d.toISOString().split('T')[0]
  })

  const totalCalories = logs.reduce((sum, l) => sum + (l.total_calories || 0), 0)
  const totalProtein = logs.reduce((sum, l) => sum + (l.total_protein_g || 0), 0)
  const totalCarbs = logs.reduce((sum, l) => sum + (l.total_carbs_g || 0), 0)
  const totalFat = logs.reduce((sum, l) => sum + (l.total_fat_g || 0), 0)
  const macroTotal = totalProtein + totalCarbs + totalFat

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    if (dateStr === today) return 'Bugün'
    if (dateStr === yesterday) return 'Dün'
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.outerScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Tarihçe</Text>
          <Text style={styles.subtitle}>Geçmiş öğünlerine bak</Text>
        </View>

        {/* Haftalık Kalori Grafiği */}
        {!weeklyLoading && weeklyData.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📈 Haftalık Kalori</Text>
            <WeeklyCalorieChart data={weeklyData} target={calorieTarget} selectedDate={selectedDate} onSelect={setSelectedDate} />
          </View>
        )}

        {/* Tarih Seçici */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
          <View style={styles.dateRow}>
            {last7Days.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.dateChip, selectedDate === d && styles.dateChipActive]}
                onPress={() => setSelectedDate(d)}
              >
                <Text style={[styles.dateChipText, selectedDate === d && styles.dateChipTextActive]}>
                  {formatDate(d)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Günlük Özet + Makro Dağılım */}
        {logs.length > 0 && (
          <>
            <View style={styles.summary}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{Math.round(totalCalories)}</Text>
                <Text style={styles.summaryLabel}>kcal</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{logs.length}</Text>
                <Text style={styles.summaryLabel}>öğün</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{Math.round(totalProtein)}g</Text>
                <Text style={styles.summaryLabel}>protein</Text>
              </View>
            </View>

            {/* Makro Dağılım Çubuğu */}
            {macroTotal > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Makro Dağılımı</Text>
                <View style={styles.macroBarRow}>
                  <View style={[styles.macroSegment, { flex: totalProtein / macroTotal, backgroundColor: THEME.colors.protein }]} />
                  <View style={[styles.macroSegment, { flex: totalCarbs / macroTotal, backgroundColor: THEME.colors.carbs }]} />
                  <View style={[styles.macroSegment, { flex: totalFat / macroTotal, backgroundColor: THEME.colors.fat }]} />
                </View>
                <View style={styles.macroLegend}>
                  <MacroLegendItem color={THEME.colors.protein} label="Protein" value={totalProtein} total={macroTotal * 4} />
                  <MacroLegendItem color={THEME.colors.carbs} label="Karb" value={totalCarbs} total={macroTotal * 4} />
                  <MacroLegendItem color={THEME.colors.fat} label="Yağ" value={totalFat} total={macroTotal * 9} />
                </View>
              </View>
            )}
          </>
        )}

        {/* Öğün Listesi */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={THEME.colors.primary} />
          </View>
        ) : logs.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🗓️</Text>
            <Text style={styles.emptyText}>Bu gün için öğün kaydı yok</Text>
          </View>
        ) : (
          logs.map((log) => (
            <View key={log.id} style={styles.logCard}>
              <View style={styles.logHeader}>
                <View style={styles.mealBadge}>
                  <Text style={styles.mealBadgeText}>{log.meal_type}</Text>
                </View>
                <Text style={styles.logTime}>
                  {new Date(log.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <TouchableOpacity onPress={() => handleDelete(log.id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>Sil</Text>
                </TouchableOpacity>
              </View>

              {log.description && (
                <Text style={styles.logDesc} numberOfLines={2}>{log.description}</Text>
              )}

              <View style={styles.logMacros}>
                <MacroChip label="Kalori" value={Math.round(log.total_calories)} unit="kcal" color={THEME.colors.accent} />
                <MacroChip label="Protein" value={Math.round(log.total_protein_g || 0)} unit="g" color={THEME.colors.protein} />
                <MacroChip label="Karb" value={Math.round(log.total_carbs_g || 0)} unit="g" color={THEME.colors.carbs} />
                <MacroChip label="Yağ" value={Math.round(log.total_fat_g || 0)} unit="g" color={THEME.colors.fat} />
              </View>
            </View>
          ))
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function WeeklyCalorieChart({ data, target, selectedDate, onSelect }: {
  data: WeeklyDay[]; target: number; selectedDate: string; onSelect: (d: string) => void
}) {
  const maxCal = Math.max(...data.map(d => d.calories), target || 1)
  const chartH = 80

  return (
    <View style={chartStyles.container}>
      {data.map((day, i) => {
        const barH = day.calories > 0 ? Math.max(6, (day.calories / maxCal) * chartH) : 4
        const isSelected = day.date === selectedDate
        const isToday = day.date === new Date().toISOString().split('T')[0]
        const exceeds = target > 0 && day.calories > target
        const barColor = exceeds ? THEME.colors.danger : isSelected ? THEME.colors.primary : THEME.colors.border
        const d = new Date(day.date + 'T12:00:00')
        const dayLabel = d.toLocaleDateString('tr-TR', { weekday: 'short' })

        return (
          <TouchableOpacity key={day.date} style={chartStyles.col} onPress={() => onSelect(day.date)} activeOpacity={0.7}>
            {day.calories > 0 && (
              <Text style={[chartStyles.calLabel, { color: isSelected ? THEME.colors.primary : THEME.colors.textMuted }]}>
                {day.calories > 999 ? `${(day.calories / 1000).toFixed(1)}k` : Math.round(day.calories)}
              </Text>
            )}
            <View style={chartStyles.barWrapper}>
              {target > 0 && (
                <View style={[chartStyles.targetLine, { bottom: (target / maxCal) * chartH }]} />
              )}
              <View style={[chartStyles.bar, { height: barH, backgroundColor: barColor }]} />
            </View>
            <Text style={[chartStyles.dayLabel, isToday && chartStyles.dayLabelToday, isSelected && chartStyles.dayLabelSelected]}>
              {dayLabel}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

function MacroLegendItem({ color, label, value, total }: { color: string; label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <View style={legendStyles.item}>
      <View style={[legendStyles.dot, { backgroundColor: color }]} />
      <Text style={legendStyles.label}>{label}</Text>
      <Text style={[legendStyles.value, { color }]}>{Math.round(value)}g</Text>
      <Text style={legendStyles.pct}>{pct}%</Text>
    </View>
  )
}

function MacroChip({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <View style={[mStyles.chip, { backgroundColor: color + '15' }]}>
      <Text style={[mStyles.val, { color }]}>{value}</Text>
      <Text style={mStyles.unit}>{unit}</Text>
      <Text style={mStyles.label}>{label}</Text>
    </View>
  )
}

const chartStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingTop: 8 },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  calLabel: { fontSize: 9, fontWeight: '600' },
  barWrapper: { width: '100%', height: 80, alignItems: 'center', justifyContent: 'flex-end', position: 'relative' },
  targetLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: THEME.colors.success + '60', zIndex: 1 },
  bar: { width: '70%', borderRadius: 3, minHeight: 4 },
  dayLabel: { fontSize: 10, color: THEME.colors.textMuted, textAlign: 'center' },
  dayLabelToday: { color: THEME.colors.textSecondary },
  dayLabelSelected: { color: THEME.colors.primary, fontWeight: '600' },
})

const legendStyles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { flex: 1, fontSize: 13, color: THEME.colors.textSecondary },
  value: { fontSize: 13, fontWeight: '600' },
  pct: { fontSize: 12, color: THEME.colors.textMuted, minWidth: 32, textAlign: 'right' },
})

const mStyles = StyleSheet.create({
  chip: { flex: 1, alignItems: 'center', borderRadius: 8, padding: 8 },
  val: { fontSize: 14, fontWeight: '700' },
  unit: { fontSize: 10, color: THEME.colors.textMuted },
  label: { fontSize: 10, color: THEME.colors.textSecondary, marginTop: 1 },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  outerScroll: { flex: 1 },
  header: { padding: 20, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '700', color: THEME.colors.text },
  subtitle: { fontSize: 14, color: THEME.colors.textSecondary, marginTop: 4 },
  card: {
    margin: 16, marginBottom: 0,
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: THEME.colors.border
  },
  cardTitle: { fontSize: 13, fontWeight: '600', color: THEME.colors.textSecondary, marginBottom: 8 },
  dateScroll: { marginBottom: 12, marginTop: 12 },
  dateRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  dateChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: THEME.colors.bgCard,
    borderWidth: 1, borderColor: THEME.colors.border
  },
  dateChipActive: { backgroundColor: `${THEME.colors.primary}20`, borderColor: THEME.colors.primary },
  dateChipText: { color: THEME.colors.textSecondary, fontSize: 13, fontWeight: '500' },
  dateChipTextActive: { color: THEME.colors.primary },
  summary: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: THEME.colors.border
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '700', color: THEME.colors.text },
  summaryLabel: { fontSize: 11, color: THEME.colors.textSecondary, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: THEME.colors.border },
  macroBarRow: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 4 },
  macroSegment: { height: 10 },
  macroLegend: { gap: 2 },
  center: { padding: 60, alignItems: 'center' },
  empty: { padding: 60, alignItems: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: THEME.colors.textSecondary },
  logCard: {
    margin: 16, marginBottom: 8,
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: THEME.colors.border
  },
  logHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  mealBadge: {
    backgroundColor: `${THEME.colors.primary}20`, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, marginRight: 8
  },
  mealBadgeText: { color: THEME.colors.primary, fontSize: 11, fontWeight: '600' },
  logTime: { flex: 1, fontSize: 12, color: THEME.colors.textMuted },
  deleteBtn: { padding: 4 },
  deleteBtnText: { color: THEME.colors.danger, fontSize: 12 },
  logDesc: { fontSize: 13, color: THEME.colors.textSecondary, marginBottom: 10 },
  logMacros: { flexDirection: 'row', gap: 6 },
})
