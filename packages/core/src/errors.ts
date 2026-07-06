// ============================================================================
// Platformdan bağımsız hata yönetimi
// ============================================================================
import { ERROR_MESSAGES } from './config'

export type AppErrorCode =
  | 'INVALID_API_KEY'
  | 'RATE_LIMIT'
  | 'QUOTA_EXCEEDED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'VALIDATION_ERROR'
  | 'API_ERROR'
  | 'UNKNOWN_ERROR'

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly details?: unknown

  constructor(code: AppErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.details = details
  }

  /** Kullanıcıya gösterilecek güvenli, anlaşılır mesaj. */
  get userMessage(): string {
    switch (this.code) {
      case 'INVALID_API_KEY':
        return ERROR_MESSAGES.api.invalidKey
      case 'RATE_LIMIT':
        return ERROR_MESSAGES.api.rateLimit
      case 'QUOTA_EXCEEDED':
        return ERROR_MESSAGES.api.quotaExceeded
      case 'NETWORK_ERROR':
        return ERROR_MESSAGES.api.network
      case 'TIMEOUT':
        return ERROR_MESSAGES.api.timeout
      case 'VALIDATION_ERROR':
        return this.message
      default:
        return ERROR_MESSAGES.api.generic
    }
  }
}

/** Herhangi bir hatayı, öncelikli olarak AI/HTTP hatalarını AppError'a çevirir. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error

  const message = error instanceof Error ? error.message : String(error)

  if (/api[_\s-]?key|permission|invalid.*key/i.test(message)) {
    return new AppError('INVALID_API_KEY', ERROR_MESSAGES.api.invalidKey, message)
  }
  if (/429|rate.?limit/i.test(message)) {
    return new AppError('RATE_LIMIT', ERROR_MESSAGES.api.rateLimit, message)
  }
  if (/quota|exceeded/i.test(message)) {
    return new AppError('QUOTA_EXCEEDED', ERROR_MESSAGES.api.quotaExceeded, message)
  }
  if (/network|fetch failed|timeout|ETIMEDOUT|ENOTFOUND/i.test(message)) {
    return new AppError('NETWORK_ERROR', ERROR_MESSAGES.api.network, message)
  }

  return new AppError('UNKNOWN_ERROR', message || ERROR_MESSAGES.api.generic, error)
}
