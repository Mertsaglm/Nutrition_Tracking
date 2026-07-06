import { View, Text, StyleSheet } from 'react-native'
import { THEME } from '../lib/constants'

type Props = {
  label: string
  value: number
  unit: string
  color: string
}

export function NutritionBox({ label, value, unit, color }: Props) {
  return (
    <View style={[styles.box, { borderColor: color + '40' }]}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.unit}>{unit}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    flex: 1, alignItems: 'center', padding: 12,
    backgroundColor: THEME.colors.bgCardAlt,
    borderRadius: 12, borderWidth: 1,
  },
  value: { fontSize: 22, fontWeight: '700' },
  unit: { fontSize: 11, color: THEME.colors.textMuted },
  label: { fontSize: 11, color: THEME.colors.textSecondary, marginTop: 2, fontWeight: '500' },
})
