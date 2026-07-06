import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert
} from 'react-native'
import { router } from 'expo-router'
import { authService } from '../../lib/auth'
import { THEME } from '../../lib/constants'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Hata', 'E-posta ve şifre giriniz.')
      return
    }
    setLoading(true)
    try {
      await authService.signIn({ email, password })
      router.replace('/')
    } catch (error: any) {
      Alert.alert('Giriş Başarısız', error.message || 'Lütfen bilgilerinizi kontrol edin.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Logo / Başlık */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🥗</Text>
          </View>
          <Text style={styles.title}>Beslenme Takip</Text>
          <Text style={styles.subtitle}>AI destekli beslenme asistanın</Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Giriş Yap</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-posta</Text>
            <TextInput
              style={styles.input}
              placeholder="ornek@email.com"
              placeholderTextColor={THEME.colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Şifre</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={THEME.colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Giriş Yap</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>veya</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.outlineBtn} onPress={() => router.push('/(auth)/signup')}>
            <Text style={styles.outlineBtnText}>Hesap Oluştur</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: THEME.colors.bgCardAlt,
    borderWidth: 1, borderColor: THEME.colors.border,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16
  },
  logoEmoji: { fontSize: 40 },
  title: { fontSize: 28, fontWeight: '700', color: THEME.colors.text, marginBottom: 6 },
  subtitle: { fontSize: 15, color: THEME.colors.textSecondary },
  card: {
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: THEME.colors.border
  },
  cardTitle: { fontSize: 20, fontWeight: '600', color: THEME.colors.text, marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, color: THEME.colors.textSecondary, marginBottom: 8, fontWeight: '500' },
  input: {
    backgroundColor: THEME.colors.bgCardAlt,
    borderWidth: 1, borderColor: THEME.colors.border,
    borderRadius: 12, padding: 14,
    color: THEME.colors.text, fontSize: 15
  },
  btn: {
    backgroundColor: THEME.colors.primary,
    borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 8
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: THEME.colors.border },
  dividerText: { color: THEME.colors.textMuted, marginHorizontal: 12, fontSize: 13 },
  outlineBtn: {
    borderWidth: 1, borderColor: THEME.colors.border,
    borderRadius: 12, padding: 16, alignItems: 'center'
  },
  outlineBtnText: { color: THEME.colors.text, fontSize: 16, fontWeight: '500' },
})
