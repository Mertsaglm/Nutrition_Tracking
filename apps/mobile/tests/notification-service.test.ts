// ============================================================================
// lib/notification-service.ts — öğün hatırlatma bildirimleri.
//
// KRİTİK ORTAM KURALI: Expo Go (SDK 53+) bildirim native modülünü içermez.
// `expo-notifications` orada import edilirse modül yüklenirken konsola ERROR
// basar. Bu yüzden modül YALNIZCA desteklenen ortamlarda, tembel (lazy) olarak
// yüklenir; Expo Go'da tüm metotlar sessizce no-op çalışır.
//
// Ayrıca servis ASLA fırlatmaz: bildirim izni reddedilse de, native çağrı
// patlasa da uygulama akışı kesilmemelidir.
// ============================================================================
import Module from 'node:module'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MEAL_TYPES, selectMealTypes } from '@nutrition/core'

// --- Ortam mock'ları --------------------------------------------------------
let executionEnvironment = 'storeClient'
let platformOS = 'ios'

vi.mock('expo-constants', () => ({
  default: {
    get executionEnvironment() {
      return executionEnvironment
    },
  },
  ExecutionEnvironment: { StoreClient: 'storeClient', Standalone: 'standalone', Bare: 'bare' },
}))

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return platformOS
    },
  },
}))

/** expo-notifications yerine geçen sahte native modül. */
function createNotificationsMock() {
  return {
    setNotificationHandler: vi.fn(),
    setNotificationChannelAsync: vi.fn().mockResolvedValue(undefined),
    getPermissionsAsync: vi.fn().mockResolvedValue({ status: 'undetermined' }),
    requestPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
    scheduleNotificationAsync: vi.fn().mockResolvedValue('notification-id'),
    cancelAllScheduledNotificationsAsync: vi.fn().mockResolvedValue(undefined),
    getAllScheduledNotificationsAsync: vi.fn().mockResolvedValue([]),
    AndroidImportance: { DEFAULT: 3 },
    SchedulableTriggerInputTypes: { DAILY: 'daily', TIME_INTERVAL: 'timeInterval' },
  }
}

type NotificationsMock = ReturnType<typeof createNotificationsMock>

// Servis `require('expo-notifications')` ile TEMBEL yükleme yapar. Bu bilinçli
// bir tasarım (Expo Go'da modül hiç yüklenmemeli), ama testte araya girmek için
// Node'un CommonJS yükleyicisini geçici olarak yönlendirmemiz gerekiyor.
type ModuleLoader = (request: string, parent: unknown, isMain: boolean) => unknown
const moduleInternals = Module as unknown as { _load: ModuleLoader }
const originalLoad = moduleInternals._load

/** `expo-notifications` isteklerini yakalayan yükleyici kurar. */
function interceptNativeModule(handler: () => unknown): string[] {
  const requested: string[] = []
  moduleInternals._load = function (request, parent, isMain) {
    if (request === 'expo-notifications') {
      requested.push(request)
      return handler()
    }
    return originalLoad.call(this, request, parent, isMain)
  }
  return requested
}

function restoreNativeModule() {
  moduleInternals._load = originalLoad
}

/** Servisi belirtilen ortamda yükler. */
async function loadService(options: { expoGo: boolean; notifications?: NotificationsMock | null }) {
  executionEnvironment = options.expoGo ? 'storeClient' : 'standalone'
  const notifications = options.notifications ?? createNotificationsMock()

  const requested = interceptNativeModule(() => {
    if (options.notifications === null) throw new Error('native modül yok')
    return notifications
  })

  vi.resetModules()
  const { notificationService } = await import('../lib/notification-service')
  return { notificationService, notifications, requested }
}

describe('Expo Go ortamı (bildirim desteği yok)', () => {
  afterEach(() => {
    restoreNativeModule()
    vi.resetModules()
  })

  it('desteklenmediğini bildirir', async () => {
    const { notificationService } = await loadService({ expoGo: true })
    expect(notificationService.isSupported).toBe(false)
  })

  it('native modülü HİÇ yüklemez (konsol hatası basılmaz)', async () => {
    const { requested } = await loadService({ expoGo: true })
    expect(requested).toEqual([])
  })

  it('tüm metotlar sessizce çalışır (fırlatmaz)', async () => {
    const { notificationService } = await loadService({ expoGo: true })

    await expect(notificationService.requestPermission()).resolves.toBe(false)
    await expect(notificationService.scheduleAllMealReminders(3)).resolves.toBeUndefined()
    await expect(notificationService.cancelAllMealReminders()).resolves.toBeUndefined()
    await expect(notificationService.getScheduledCount()).resolves.toBe(0)
    await expect(notificationService.sendTestNotification()).resolves.toBeUndefined()
  })
})

describe('native modül yüklenemezse', () => {
  afterEach(() => {
    restoreNativeModule()
    vi.resetModules()
  })

  it('desteklenmiyor olarak davranır', async () => {
    const { notificationService } = await loadService({ expoGo: false, notifications: null })
    expect(notificationService.isSupported).toBe(false)
    await expect(notificationService.requestPermission()).resolves.toBe(false)
  })
})

describe('desteklenen ortam (development / production build)', () => {
  beforeEach(() => {
    platformOS = 'ios'
  })

  afterEach(() => {
    restoreNativeModule()
    vi.resetModules()
  })

  it('desteklendiğini bildirir', async () => {
    const { notificationService } = await loadService({ expoGo: false })
    expect(notificationService.isSupported).toBe(true)
  })

  it('yüklenirken bildirim davranışını yapılandırır', async () => {
    const { notifications } = await loadService({ expoGo: false })

    expect(notifications.setNotificationHandler).toHaveBeenCalledTimes(1)
    const handler = notifications.setNotificationHandler.mock.calls[0][0] as {
      handleNotification: () => Promise<Record<string, boolean>>
    }
    await expect(handler.handleNotification()).resolves.toMatchObject({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    })
  })

  describe('requestPermission', () => {
    it('izin zaten verilmişse tekrar sormaz', async () => {
      const { notificationService, notifications } = await loadService({ expoGo: false })
      notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' })

      await expect(notificationService.requestPermission()).resolves.toBe(true)
      expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled()
    })

    it('izin yoksa kullanıcıdan ister', async () => {
      const { notificationService, notifications } = await loadService({ expoGo: false })
      notifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' })
      notifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' })

      await expect(notificationService.requestPermission()).resolves.toBe(true)
      expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1)
    })

    it('kullanıcı reddederse false döner', async () => {
      const { notificationService, notifications } = await loadService({ expoGo: false })
      notifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' })

      await expect(notificationService.requestPermission()).resolves.toBe(false)
    })

    it('Android’de bildirim kanalı oluşturur', async () => {
      platformOS = 'android'
      const { notificationService, notifications } = await loadService({ expoGo: false })

      await notificationService.requestPermission()

      expect(notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'ogun-hatirlatma',
        expect.objectContaining({ name: 'Öğün Hatırlatmaları', sound: 'default' })
      )
    })

    it('iOS’ta kanal oluşturmaz', async () => {
      platformOS = 'ios'
      const { notificationService, notifications } = await loadService({ expoGo: false })

      await notificationService.requestPermission()
      expect(notifications.setNotificationChannelAsync).not.toHaveBeenCalled()
    })

    it('native hata durumunda false döner (fırlatmaz)', async () => {
      const { notificationService, notifications } = await loadService({ expoGo: false })
      notifications.getPermissionsAsync.mockRejectedValue(new Error('native patladı'))

      await expect(notificationService.requestPermission()).resolves.toBe(false)
    })
  })

  describe('scheduleAllMealReminders', () => {
    it('önce eski hatırlatmaları iptal eder', async () => {
      const { notificationService, notifications } = await loadService({ expoGo: false })
      notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' })

      await notificationService.scheduleAllMealReminders(3)
      expect(notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled()
    })

    it('öğün sayısı kadar günlük hatırlatma kurar', async () => {
      const { notificationService, notifications } = await loadService({ expoGo: false })
      notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' })

      await notificationService.scheduleAllMealReminders(3)
      expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3)
    })

    it('varsayılan öğün sayısı 3’tür', async () => {
      const { notificationService, notifications } = await loadService({ expoGo: false })
      notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' })

      await notificationService.scheduleAllMealReminders()
      expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3)
    })

    it('hatırlatmalar beslenme planındaki öğünlerle aynıdır', async () => {
      // Regresyon: eskiden MEAL_TYPES'ın ilk N'i alınıyordu ve 3 öğünlük planda
      // Akşam yerine Kuşluk için hatırlatma kuruluyordu. Artık tek kaynak
      // `selectMealTypes` (calculator.ts) — plan ve hatırlatma aynı listedir.
      const { notificationService, notifications } = await loadService({ expoGo: false })
      notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' })

      await notificationService.scheduleAllMealReminders(3)

      const scheduled = notifications.scheduleNotificationAsync.mock.calls.map(
        ([input]) => (input as { content: { data: { mealType: string } } }).content.data.mealType
      )
      expect(scheduled).toEqual(['Kahvaltı', 'Öğle', 'Akşam'])
      expect(scheduled).toEqual(selectMealTypes(3).map((meal) => meal.name))
    })

    it.each([4, 5, 6])('%i öğünde de plan listesiyle aynı kalır', async (count) => {
      const { notificationService, notifications } = await loadService({ expoGo: false })
      notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' })

      await notificationService.scheduleAllMealReminders(count)

      const scheduled = notifications.scheduleNotificationAsync.mock.calls.map(
        ([input]) => (input as { content: { data: { mealType: string } } }).content.data.mealType
      )
      expect(scheduled).toEqual(selectMealTypes(count).map((meal) => meal.name))
    })

    it('bildirim saatlerini MEAL_TYPES’tan alır', async () => {
      const { notificationService, notifications } = await loadService({ expoGo: false })
      notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' })

      await notificationService.scheduleAllMealReminders(1)

      const [input] = notifications.scheduleNotificationAsync.mock.calls[0]
      const [hour, minute] = MEAL_TYPES.Kahvaltı.time.split(':').map(Number)
      expect((input as { trigger: unknown }).trigger).toEqual({
        type: 'daily',
        hour,
        minute,
      })
    })

    it('bildirim metni öğün adını içerir', async () => {
      const { notificationService, notifications } = await loadService({ expoGo: false })
      notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' })

      await notificationService.scheduleAllMealReminders(1)

      const [input] = notifications.scheduleNotificationAsync.mock.calls[0]
      const content = (input as { content: { title: string; body: string } }).content
      expect(content.title).toContain('Kahvaltı')
      expect(content.body).toContain('kahvaltı')
    })

    it('altıya kadar öğün destekler', async () => {
      const { notificationService, notifications } = await loadService({ expoGo: false })
      notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' })

      await notificationService.scheduleAllMealReminders(6)
      expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(6)
    })

    it('izin verilmezse hiç bildirim kurmaz', async () => {
      const { notificationService, notifications } = await loadService({ expoGo: false })
      notifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' })
      notifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' })

      await notificationService.scheduleAllMealReminders(3)
      expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled()
    })

    it('native hata akışı kesmez', async () => {
      const { notificationService, notifications } = await loadService({ expoGo: false })
      notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' })
      notifications.scheduleNotificationAsync.mockRejectedValue(new Error('kurulamadı'))

      await expect(notificationService.scheduleAllMealReminders(3)).resolves.toBeUndefined()
    })
  })

  describe('cancelAllMealReminders', () => {
    it('tüm planlanmış bildirimleri iptal eder', async () => {
      const { notificationService, notifications } = await loadService({ expoGo: false })
      await notificationService.cancelAllMealReminders()
      expect(notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1)
    })

    it('hata durumunda fırlatmaz', async () => {
      const { notificationService, notifications } = await loadService({ expoGo: false })
      notifications.cancelAllScheduledNotificationsAsync.mockRejectedValue(new Error('hata'))
      await expect(notificationService.cancelAllMealReminders()).resolves.toBeUndefined()
    })
  })

  describe('getScheduledCount', () => {
    it('planlanmış bildirim sayısını döner', async () => {
      const { notificationService, notifications } = await loadService({ expoGo: false })
      notifications.getAllScheduledNotificationsAsync.mockResolvedValue([{}, {}, {}])
      await expect(notificationService.getScheduledCount()).resolves.toBe(3)
    })

    it('hata durumunda 0 döner', async () => {
      const { notificationService, notifications } = await loadService({ expoGo: false })
      notifications.getAllScheduledNotificationsAsync.mockRejectedValue(new Error('hata'))
      await expect(notificationService.getScheduledCount()).resolves.toBe(0)
    })
  })

  describe('sendTestNotification', () => {
    it('2 saniye sonra tetiklenen bir test bildirimi kurar', async () => {
      const { notificationService, notifications } = await loadService({ expoGo: false })
      await notificationService.sendTestNotification()

      const [input] = notifications.scheduleNotificationAsync.mock.calls[0]
      expect((input as { trigger: unknown }).trigger).toEqual({
        type: 'timeInterval',
        seconds: 2,
      })
    })

    it('hata durumunda fırlatmaz', async () => {
      const { notificationService, notifications } = await loadService({ expoGo: false })
      notifications.scheduleNotificationAsync.mockRejectedValue(new Error('hata'))
      await expect(notificationService.sendTestNotification()).resolves.toBeUndefined()
    })
  })
})

describe('servis yüzeyi', () => {
  afterEach(() => {
    restoreNativeModule()
    vi.resetModules()
  })

  it('beklenen metotları sunar', async () => {
    const { notificationService } = await loadService({ expoGo: true })
    expect(Object.keys(notificationService).sort()).toEqual([
      'cancelAllMealReminders',
      'getScheduledCount',
      'isSupported',
      'requestPermission',
      'scheduleAllMealReminders',
      'sendTestNotification',
    ])
  })
})
