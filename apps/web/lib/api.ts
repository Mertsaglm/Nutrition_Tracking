// API route yardımcıları — JSON zarfı + CORS (mobil istemci cross-origin çağırır).
import { NextResponse } from 'next/server'
import { toAppError } from '@nutrition/core'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export function apiSuccess<T>(data: T) {
  return NextResponse.json({ success: true, data }, { headers: CORS_HEADERS })
}

export function apiError(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status, headers: CORS_HEADERS })
}

/** Preflight (OPTIONS) yanıtı. */
export function apiOptions() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

/** Yakalanan hatayı kullanıcı-dostu mesajla API hatasına çevirir (sunucu tarafında log'lar). */
export function apiCatch(error: unknown) {
  const appError = toAppError(error)
  console.error('[API]', appError.code, appError.message)
  return apiError(appError.userMessage, 500)
}
