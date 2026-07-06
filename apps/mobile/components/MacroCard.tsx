import { View, Text, StyleSheet } from 'react-native'
import { THEME } from '../lib/constants'

type Props = {
  value: number
  max: number
  color: string
  label: string
  unit?: string
}

export function MacroCard({ value, max, color, label, unit = 'g' }: Props) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  const remaining = Math.max(0, max - value)

  return (
    <View style={styles.card}>
      <View style={[styles.bar, { backgroundColor: color + '20' }]}>
        <View style={[styles.barFill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.value, { color }]}>{Math.round(value)}{unit}</Text>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.remaining}>{Math.round(remaining)}{unit} kaldı</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: THEME.colors.border,
  },
  bar: { height: 4, borderRadius: 2, marginBottom: 8, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  value: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  label: { fontSize: 11, color: THEME.colors.textSecondary, fontWeight: '500' },
  remaining: { fontSize: 10, color: THEME.colors.textMuted, marginTop: 2 },
})
