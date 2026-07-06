import { useState, useMemo } from 'react'
import {
  View, Text, TextInput, StyleSheet, FlatList,
  TouchableOpacity, Modal
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { THEME } from '../lib/constants'
import nutritionDB from '../comprehensive-nutrition-database.json'

type FoodItem = {
  key: string
  category: string
  categoryLabel: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

const CATEGORY_LABELS: Record<string, string> = {
  etler_kirmizi: '🥩 Kırmızı Et',
  kanatlilar: '🍗 Kanatlı',
  av_hayvanlari: '🦌 Av Hayvanları',
  baliklar: '🐟 Balık',
  deniz_urunleri: '🦐 Deniz Ürünleri',
  sut_urunleri: '🧀 Süt Ürünleri',
  yumurta: '🥚 Yumurta',
  tahillar: '🌾 Tahıllar',
  ekmekler: '🍞 Ekmek',
  sebzeler: '🥦 Sebze',
  meyveler: '🍎 Meyve',
  baklagiller: '🫘 Baklagil',
  yaglar: '🫙 Yağ',
  kuruyemisler: '🥜 Kuruyemiş',
  seker_tatlilar: '🍰 Tatlı',
  icecekler: '🥤 İçecek',
  hazir_yiyecekler: '🍔 Hazır Yemek',
  diger: '🍽️ Diğer',
}

function buildFoodList(): FoodItem[] {
  const db = nutritionDB as any
  const foods = db.foods || {}
  const list: FoodItem[] = []

  for (const [catKey, catVal] of Object.entries(foods)) {
    if (typeof catVal !== 'object' || !catVal) continue
    const label = CATEGORY_LABELS[catKey] || catKey
    for (const [foodKey, foodVal] of Object.entries(catVal as Record<string, any>)) {
      if (typeof foodVal !== 'object' || !foodVal) continue
      list.push({
        key: foodKey,
        category: catKey,
        categoryLabel: label,
        calories: foodVal.calories ?? 0,
        protein: foodVal.protein ?? 0,
        carbs: foodVal.carbs ?? 0,
        fat: foodVal.fat ?? 0,
      })
    }
  }
  return list.sort((a, b) => a.key.localeCompare(b.key, 'tr'))
}

const ALL_FOODS = buildFoodList()

const CATEGORIES = ['Tümü', ...Object.keys(CATEGORY_LABELS).filter(k =>
  ALL_FOODS.some(f => f.category === k)
)]

export default function FoodSearchScreen() {
  const [query, setQuery] = useState('')
  const [selectedCat, setSelectedCat] = useState('Tümü')
  const [selected, setSelected] = useState<FoodItem | null>(null)

  const filtered = useMemo(() => {
    const q = query.toLowerCase().replace(/\s+/g, ' ').trim()
    return ALL_FOODS.filter(f => {
      const matchCat = selectedCat === 'Tümü' || f.category === selectedCat
      const matchQ = q === '' || f.key.toLowerCase().replace(/_/g, ' ').includes(q)
      return matchCat && matchQ
    }).slice(0, 100)
  }, [query, selectedCat])

  const formatName = (key: string) =>
    key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Besin Arama</Text>
        <Text style={styles.count}>{ALL_FOODS.length} besin</Text>
      </View>

      {/* Arama */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Besin ara... (dana kıyma, yoğurt...)"
          placeholderTextColor={THEME.colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Kategori Seçici */}
      <FlatList
        data={CATEGORIES}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={c => c}
        contentContainerStyle={styles.catList}
        renderItem={({ item: cat }) => (
          <TouchableOpacity
            style={[styles.catChip, selectedCat === cat && styles.catChipActive]}
            onPress={() => setSelectedCat(cat)}
          >
            <Text style={[styles.catChipText, selectedCat === cat && styles.catChipTextActive]}>
              {cat === 'Tümü' ? '🌐 Tümü' : CATEGORY_LABELS[cat] || cat}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Sonuç sayısı */}
      <Text style={styles.resultCount}>
        {filtered.length === 100 ? '100+ sonuç' : `${filtered.length} sonuç`}
        {query ? ` — "${query}"` : ''}
      </Text>

      {/* Liste */}
      <FlatList
        data={filtered}
        keyExtractor={f => f.category + f.key}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item: food }) => (
          <TouchableOpacity style={styles.foodRow} onPress={() => setSelected(food)} activeOpacity={0.7}>
            <View style={styles.foodLeft}>
              <Text style={styles.foodName}>{formatName(food.key)}</Text>
              <Text style={styles.foodCat}>{food.categoryLabel}</Text>
            </View>
            <View style={styles.foodRight}>
              <Text style={styles.foodCal}>{food.calories} kcal</Text>
              <Text style={styles.foodPer}>/ 100g</Text>
            </View>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyText}>Sonuç bulunamadı</Text>
          </View>
        }
      />

      {/* Detay Modal */}
      <Modal visible={!!selected} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selected && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{formatName(selected.key)}</Text>
                  <TouchableOpacity onPress={() => setSelected(null)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalCat}>{selected.categoryLabel}</Text>
                <Text style={styles.modalPer}>Her 100g için besin değerleri:</Text>

                <View style={styles.modalGrid}>
                  <ModalStat label="Kalori" value={selected.calories} unit="kcal" color={THEME.colors.accent} />
                  <ModalStat label="Protein" value={selected.protein} unit="g" color={THEME.colors.protein} />
                  <ModalStat label="Karb" value={selected.carbs} unit="g" color={THEME.colors.carbs} />
                  <ModalStat label="Yağ" value={selected.fat} unit="g" color={THEME.colors.fat} />
                </View>

                {/* Makro Dağılım Çubuğu */}
                {(selected.protein + selected.carbs + selected.fat) > 0 && (
                  <View style={styles.macroBar}>
                    <View style={[styles.macroSeg, { flex: selected.protein, backgroundColor: THEME.colors.protein }]} />
                    <View style={[styles.macroSeg, { flex: selected.carbs, backgroundColor: THEME.colors.carbs }]} />
                    <View style={[styles.macroSeg, { flex: selected.fat, backgroundColor: THEME.colors.fat }]} />
                  </View>
                )}
                <View style={styles.macroLegend}>
                  <Text style={[styles.legendDot, { color: THEME.colors.protein }]}>● P</Text>
                  <Text style={[styles.legendDot, { color: THEME.colors.carbs }]}>● K</Text>
                  <Text style={[styles.legendDot, { color: THEME.colors.fat }]}>● Y</Text>
                </View>

                <TouchableOpacity style={styles.closeModalBtn} onPress={() => setSelected(null)}>
                  <Text style={styles.closeModalBtnText}>Kapat</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function ModalStat({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <View style={[mStyles.stat, { borderColor: color + '40' }]}>
      <Text style={[mStyles.val, { color }]}>{value}</Text>
      <Text style={mStyles.unit}>{unit}</Text>
      <Text style={mStyles.label}>{label}</Text>
    </View>
  )
}

const mStyles = StyleSheet.create({
  stat: {
    flex: 1, alignItems: 'center', padding: 12,
    backgroundColor: THEME.colors.bg, borderRadius: 12, borderWidth: 1
  },
  val: { fontSize: 22, fontWeight: '700' },
  unit: { fontSize: 11, color: THEME.colors.textMuted },
  label: { fontSize: 11, color: THEME.colors.textSecondary, marginTop: 2 },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8 },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: THEME.colors.bgCard, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  backBtnText: { color: THEME.colors.textSecondary, fontSize: 14 },
  title: { flex: 1, fontSize: 22, fontWeight: '700', color: THEME.colors.text },
  count: { fontSize: 12, color: THEME.colors.textMuted },

  searchRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12 },
  searchInput: {
    flex: 1, backgroundColor: THEME.colors.bgCard,
    borderRadius: 12, padding: 12, paddingRight: 40,
    color: THEME.colors.text, fontSize: 15,
    borderWidth: 1, borderColor: THEME.colors.border
  },
  clearBtn: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
  clearBtnText: { color: THEME.colors.textMuted, fontSize: 14 },

  catList: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  catChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 18, backgroundColor: THEME.colors.bgCard,
    borderWidth: 1, borderColor: THEME.colors.border
  },
  catChipActive: { backgroundColor: `${THEME.colors.primary}20`, borderColor: THEME.colors.primary },
  catChipText: { color: THEME.colors.textSecondary, fontSize: 12 },
  catChipTextActive: { color: THEME.colors.primary, fontWeight: '600' },

  resultCount: { fontSize: 12, color: THEME.colors.textMuted, paddingHorizontal: 16, marginBottom: 8 },
  listContent: { paddingHorizontal: 16 },
  foodRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 12
  },
  foodLeft: { flex: 1 },
  foodName: { fontSize: 14, color: THEME.colors.text, fontWeight: '500' },
  foodCat: { fontSize: 11, color: THEME.colors.textMuted, marginTop: 2 },
  foodRight: { alignItems: 'flex-end' },
  foodCal: { fontSize: 15, fontWeight: '700', color: THEME.colors.accent },
  foodPer: { fontSize: 10, color: THEME.colors.textMuted },
  separator: { height: 1, backgroundColor: THEME.colors.border },
  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 15, color: THEME.colors.textSecondary },

  modalOverlay: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: THEME.colors.bgCard,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
    borderTopWidth: 1, borderColor: THEME.colors.border
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: THEME.colors.text, flex: 1 },
  modalClose: { fontSize: 18, color: THEME.colors.textSecondary, padding: 4 },
  modalCat: { fontSize: 13, color: THEME.colors.textMuted, marginBottom: 16 },
  modalPer: { fontSize: 12, color: THEME.colors.textSecondary, marginBottom: 12 },
  modalGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  macroBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  macroSeg: { height: 8 },
  macroLegend: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  legendDot: { fontSize: 12 },
  closeModalBtn: {
    borderWidth: 1, borderColor: THEME.colors.border,
    borderRadius: 12, padding: 14, alignItems: 'center'
  },
  closeModalBtnText: { color: THEME.colors.textSecondary, fontSize: 15 },
})
