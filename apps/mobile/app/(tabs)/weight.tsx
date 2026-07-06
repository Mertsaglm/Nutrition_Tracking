import { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { databaseService } from '../../lib/services'
import { authService } from '../../lib/services'
import { THEME } from '@nutrition/tokens'

type WeightLog = {
  id: string
  date: string
  weight_kg: number
  notes: string | null
}

type Profile = {
  current_weight_kg: number | null
  target_weight_kg: number | null
  goal: string | null
}

export default function WeightScreen() {
  const [logs, setLogs] = useState<WeightLog[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [inputWeight, setInputWeight] = useState('')
  const [inputNote, setInputNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [weightData, profileData] = await Promise.all([
        databaseService.getWeightLogs(user.id, 30),
        authService.getUserProfile(user.id),
      ])
      setLogs((weightData || []) as WeightLog[])
      setProfile(profileData as Profile)
    } catch (err) {
      console.error('Kilo yükleme hatası:', err)
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(useCallback(() => { load() }, []))

  const handleSave = async () => {
    const w = parseFloat(inputWeight.replace(',', '.'))
    if (isNaN(w) || w < 20 || w > 300) {
      Alert.alert('Geçersiz değer', 'Lütfen geçerli bir kilo giriniz (20-300 kg).')
      return
    }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const today = new Date().toISOString().split('T')[0]

      // Bugün zaten kayıt var mı kontrol et
      const todayLog = logs.find(l => l.date === today)
      if (todayLog) {
        // Güncelle
        const { error } = await (supabase as any)
          .from('weight_logs')
          .update({ weight_kg: w, notes: inputNote || null })
          .eq('id', todayLog.id)
        if (error) throw error
      } else {
        await databaseService.saveWeightLog(user.id, today, w)
      }

      // Profildeki mevcut kiloyu da güncelle
      await authService.updateUserProfile(user.id, { current_weight_kg: w })

      setInputWeight('')
      setInputNote('')
      setModalVisible(false)
      await load()
    } catch {
      Alert.alert('Hata', 'Kilo kaydedilemedi. Tekrar deneyin.')
    } finally {
      setSaving(false)
    }
  }

  const latestWeight = logs[0]?.weight_kg ?? profile?.current_weight_kg ?? null
  const targetWeight = profile?.target_weight_kg ?? null
  const startWeight = logs.length > 0 ? logs[logs.length - 1].weight_kg : latestWeight
  const goal = profile?.goal

  const weightDiff = latestWeight && targetWeight ? (latestWeight - targetWeight) : null
  const totalChange = latestWeight && startWeight ? (latestWeight - startWeight) : null

  const getBmiCategory = (bmi: number) => {
    if (bmi < 18.5) return { label: 'Zayıf', color: THEME.colors.warning }
    if (bmi < 25) return { label: 'Normal', color: THEME.colors.success }
    if (bmi < 30) return { label: 'Fazla Kilolu', color: THEME.colors.warning }
    return { label: 'Obez', color: THEME.colors.danger }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
  }

  const getProgressToTarget = () => {
    if (!startWeight || !targetWeight || !latestWeight) return null
    const total = Math.abs(startWeight - targetWeight)
    if (total === 0) return 100
    const done = Math.abs(startWeight - latestWeight)
    return Math.min(Math.round((done / total) * 100), 100)
  }

  const progressPct = getProgressToTarget()

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Kilo Takibi</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.addBtnText}>+ Kilo Ekle</Text>
          </TouchableOpacity>
        </View>

        {/* Mevcut Kilo Kartı */}
        <View style={styles.mainCard}>
          <View style={styles.mainCardRow}>
            <View>
              <Text style={styles.mainCardLabel}>Mevcut Kilo</Text>
              <View style={styles.mainCardValueRow}>
                <Text style={styles.mainCardValue}>{latestWeight?.toFixed(1) ?? '—'}</Text>
                <Text style={styles.mainCardUnit}> kg</Text>
              </View>
              {logs[0]?.date && (
                <Text style={styles.mainCardDate}>{formatDate(logs[0].date)} ölçümü</Text>
              )}
            </View>
            {targetWeight && (
              <View style={styles.targetBox}>
                <Text style={styles.targetLabel}>Hedef</Text>
                <Text style={styles.targetValue}>{targetWeight} kg</Text>
                {weightDiff !== null && (
                  <Text style={[styles.targetDiff, { color: Math.abs(weightDiff) < 0.5 ? THEME.colors.success : THEME.colors.textSecondary }]}>
                    {weightDiff > 0 ? `${weightDiff.toFixed(1)} kg fazla` : weightDiff < 0 ? `${Math.abs(weightDiff).toFixed(1)} kg eksik` : '✓ Hedefe ulaştın!'}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Hedefe ilerleme */}
          {progressPct !== null && (
            <View style={styles.progressSection}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>
                  {goal === 'lose_weight' ? 'Kilo verme' : goal === 'gain_weight' ? 'Kilo alma' : 'Hedefe'} ilerleme
                </Text>
                <Text style={styles.progressPct}>{progressPct}%</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
              </View>
            </View>
          )}

          {/* Toplam değişim */}
          {totalChange !== null && logs.length > 1 && (
            <View style={styles.changeRow}>
              <Text style={styles.changeLabel}>Toplam değişim</Text>
              <Text style={[styles.changeValue, {
                color: totalChange === 0 ? THEME.colors.textSecondary
                  : (goal === 'lose_weight' ? totalChange < 0 : totalChange > 0) ? THEME.colors.success : THEME.colors.danger
              }]}>
                {totalChange > 0 ? '+' : ''}{totalChange.toFixed(1)} kg
              </Text>
            </View>
          )}
        </View>

        {/* Mini Grafik (son 7 gün) */}
        {logs.length > 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Son Ölçümler</Text>
            <MiniWeightChart logs={logs.slice(0, 7).reverse()} />
          </View>
        )}

        {/* Geçmiş Liste */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kilo Geçmişi</Text>
          {logs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>⚖️</Text>
              <Text style={styles.emptyText}>Henüz kilo kaydın yok</Text>
              <Text style={styles.emptySubtext}>İlk kilonu ekle ve takibe başla</Text>
            </View>
          ) : (
            logs.map((log, i) => {
              const prev = logs[i + 1]
              const diff = prev ? log.weight_kg - prev.weight_kg : null
              return (
                <View key={log.id} style={[styles.logRow, i < logs.length - 1 && styles.logRowBorder]}>
                  <View>
                    <Text style={styles.logDate}>{formatDate(log.date)}</Text>
                    {log.notes ? <Text style={styles.logNote}>{log.notes}</Text> : null}
                  </View>
                  <View style={styles.logRight}>
                    <Text style={styles.logWeight}>{log.weight_kg.toFixed(1)} kg</Text>
                    {diff !== null && (
                      <Text style={[styles.logDiff, { color: diff === 0 ? THEME.colors.textMuted : diff < 0 ? THEME.colors.success : THEME.colors.danger }]}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                      </Text>
                    )}
                  </View>
                </View>
              )
            })
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Kilo Ekleme Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Kilo Ekle</Text>
            <Text style={styles.modalLabel}>Kilonuz (kg)</Text>
            <TextInput
              style={styles.input}
              value={inputWeight}
              onChangeText={setInputWeight}
              placeholder={latestWeight ? `Son: ${latestWeight} kg` : 'Örn: 75.5'}
              placeholderTextColor={THEME.colors.textMuted}
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={styles.modalLabel}>Not (isteğe bağlı)</Text>
            <TextInput
              style={[styles.input, styles.inputNote]}
              value={inputNote}
              onChangeText={setInputNote}
              placeholder="Sabah ölçümü, aç karnına..."
              placeholderTextColor={THEME.colors.textMuted}
              multiline
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setModalVisible(false); setInputWeight(''); setInputNote('') }}>
                <Text style={styles.cancelBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Kaydet</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function MiniWeightChart({ logs }: { logs: { date: string; weight_kg: number }[] }) {
  if (logs.length < 2) return null
  const weights = logs.map(l => l.weight_kg)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const range = max - min || 1
  const chartH = 60

  return (
    <View style={chartStyles.container}>
      {logs.map((log, i) => {
        const barH = Math.max(8, ((log.weight_kg - min) / range) * chartH)
        const isLast = i === logs.length - 1
        return (
          <View key={log.date} style={chartStyles.col}>
            <Text style={chartStyles.weight}>{log.weight_kg.toFixed(1)}</Text>
            <View style={[chartStyles.bar, { height: barH, backgroundColor: isLast ? THEME.colors.primary : THEME.colors.border }]} />
            <Text style={chartStyles.date}>
              {new Date(log.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }).replace(' ', '\n')}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const chartStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingTop: 8, minHeight: 120 },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  weight: { fontSize: 9, color: THEME.colors.textMuted },
  bar: { width: '80%', borderRadius: 3, minHeight: 8 },
  date: { fontSize: 9, color: THEME.colors.textMuted, textAlign: 'center' },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  scroll: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', color: THEME.colors.text },
  addBtn: { backgroundColor: THEME.colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  mainCard: {
    margin: 16, marginTop: 4,
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: THEME.colors.border
  },
  mainCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  mainCardLabel: { fontSize: 12, color: THEME.colors.textSecondary, marginBottom: 4 },
  mainCardValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  mainCardValue: { fontSize: 40, fontWeight: '700', color: THEME.colors.text },
  mainCardUnit: { fontSize: 18, color: THEME.colors.textSecondary },
  mainCardDate: { fontSize: 11, color: THEME.colors.textMuted, marginTop: 4 },
  targetBox: { alignItems: 'flex-end' },
  targetLabel: { fontSize: 11, color: THEME.colors.textSecondary },
  targetValue: { fontSize: 22, fontWeight: '700', color: THEME.colors.accent },
  targetDiff: { fontSize: 11, marginTop: 2 },
  progressSection: { marginBottom: 12 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 12, color: THEME.colors.textSecondary },
  progressPct: { fontSize: 12, color: THEME.colors.primary, fontWeight: '600' },
  progressBar: { height: 8, backgroundColor: THEME.colors.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: THEME.colors.primary, borderRadius: 4 },
  changeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: THEME.colors.border },
  changeLabel: { fontSize: 13, color: THEME.colors.textSecondary },
  changeValue: { fontSize: 13, fontWeight: '700' },

  card: {
    margin: 16, marginTop: 0, marginBottom: 12,
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: THEME.colors.border
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: THEME.colors.textSecondary, marginBottom: 12 },

  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 15, color: THEME.colors.textSecondary, fontWeight: '500' },
  emptySubtext: { fontSize: 13, color: THEME.colors.textMuted, marginTop: 4 },

  logRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  logRowBorder: { borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  logDate: { fontSize: 14, color: THEME.colors.text, fontWeight: '500' },
  logNote: { fontSize: 11, color: THEME.colors.textMuted, marginTop: 2 },
  logRight: { alignItems: 'flex-end' },
  logWeight: { fontSize: 16, fontWeight: '700', color: THEME.colors.text },
  logDiff: { fontSize: 12, marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: THEME.colors.bgCard,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
    borderTopWidth: 1, borderColor: THEME.colors.border
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: THEME.colors.text, marginBottom: 20 },
  modalLabel: { fontSize: 13, color: THEME.colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: THEME.colors.bg,
    borderRadius: 12, padding: 14,
    color: THEME.colors.text, fontSize: 16,
    borderWidth: 1, borderColor: THEME.colors.border,
    marginBottom: 16
  },
  inputNote: { height: 80, textAlignVertical: 'top' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1, borderRadius: 12, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: THEME.colors.border
  },
  cancelBtnText: { color: THEME.colors.textSecondary, fontSize: 15, fontWeight: '600' },
  saveBtn: { flex: 2, borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: THEME.colors.primary },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
