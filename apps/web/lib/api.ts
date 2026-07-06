// API route yardımcıları — JSON zarfı + CORS (mobil istemci cross-origin çağırır).
import { NextResponse } from 'next/server'
import { AppError } from '@nutrition/core'

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

/** Yakalanan hatayı kullanıcı-dostu mesajla API hatasına çevirir. */
export function apiCatch(error: unknown) {
  const message = error instanceof AppError ? error.userMessage : 'Beklenmeyen bir hata oluştu'
  return apiError(message, 500)
}
