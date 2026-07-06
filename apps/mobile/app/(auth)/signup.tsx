import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert
} from 'react-native'
import { router } from 'expo-router'
import { authService } from '../../lib/services'
import { THEME } from '@nutrition/tokens'

export default function SignupScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = async () => {
    if (!name || !email || !password) {
      Alert.alert('Hata', 'Tüm alanları doldurunuz.')
      return
    }
    if (password !== confirmPassword) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor.')
      return
    }
    if (password.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalıdır.')
      return
    }

    setLoading(true)
    try {
      await authService.signUp({ email, password, name })
      Alert.alert(
        'Hesap Oluşturuldu!',
        'E-postanı doğrula ve giriş yap.',
        [{ text: 'Giriş Yap', onPress: () => router.replace('/(auth)/login') }]
      )
    } catch (error: any) {
      Alert.alert('Kayıt Başarısız', error.message || 'Bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Geri</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Hesap Oluştur</Text>
          <Text style={styles.subtitle}>Ücretsiz başla, hedefine ulaş</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ad Soyad</Text>
            <TextInput
              style={styles.input}
              placeholder="Adın ve Soyadın"
              placeholderTextColor={THEME.colors.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

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
              placeholder="En az 6 karakter"
              placeholderTextColor={THEME.colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Şifre Tekrar</Text>
            <TextInput
              style={styles.input}
              placeholder="Şifreni tekrar gir"
              placeholderTextColor={THEME.colors.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity style={styles.btn} onPress={handleSignup} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Hesap Oluştur</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 60 },
  header: { marginBottom: 24 },
  backBtn: { marginBottom: 20 },
  backText: { color: THEME.colors.primary, fontSize: 15 },
  title: { fontSize: 28, fontWeight: '700', color: THEME.colors.text, marginBottom: 6 },
  subtitle: { fontSize: 15, color: THEME.colors.textSecondary },
  card: {
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: THEME.colors.border
  },
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
})
