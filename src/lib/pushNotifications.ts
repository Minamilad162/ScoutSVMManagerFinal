import { supabase } from './supabase'

export type PushSubscriptionResult =
  | { status: 'unsupported' }
  | { status: 'missing-user' }
  | { status: 'missing-vapid' }
  | { status: 'permission-default' }
  | { status: 'permission-denied' }
  | { status: 'subscribed' }

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

function bufToBase64(buf: ArrayBuffer | null) {
  if (!buf) return ''
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export function isPushSupported() {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window
}

export function getPushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

export async function ensurePushSubscription(
  userId?: string | null,
  options: { requestPermission?: boolean } = {}
): Promise<PushSubscriptionResult> {
  try {
    if (!isPushSupported()) return { status: 'unsupported' }
    if (!userId) return { status: 'missing-user' }

    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
    if (!vapidPublicKey) {
      console.warn('VITE_VAPID_PUBLIC_KEY is missing')
      return { status: 'missing-vapid' }
    }

    if (Notification.permission === 'denied') return { status: 'permission-denied' }

    if (Notification.permission === 'default') {
      if (!options.requestPermission) return { status: 'permission-default' }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        return { status: permission === 'denied' ? 'permission-denied' : 'permission-default' }
      }
    }

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
    }

    const endpoint = sub.endpoint
    const p256dh = bufToBase64(sub.getKey('p256dh'))
    const auth = bufToBase64(sub.getKey('auth'))

    const { error } = await supabase
      .from('webpush_subscriptions')
      .upsert({ user_id: userId, endpoint, p256dh, auth }, { onConflict: 'user_id,endpoint' } as any)

    if (error) throw error
    return { status: 'subscribed' }
  } catch (error) {
    console.warn('push subscription failed', error)
    throw error
  }
}
