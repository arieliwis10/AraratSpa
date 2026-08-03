// Convierte la VAPID public key (base64 url-safe) al formato Uint8Array
// que pide la Push API del navegador
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function suscribirsePush() {
  // Chequeos de soporte (iOS viejo, navegadores sin push, etc.)
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Este navegador no soporta notificaciones push');
    return null;
  }

  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') {
    console.warn('Usuario no dio permiso de notificaciones');
    return null;
  }

  const registration = await navigator.serviceWorker.ready;

  // Si ya existe una suscripción activa, la reusa en vez de crear otra
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
    });
  }

  return subscription;
}