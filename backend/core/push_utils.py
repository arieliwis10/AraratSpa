import os
import json
from pywebpush import webpush, WebPushException
from .models import PushSubscription


def enviar_push(usuario, titulo, cuerpo, url='/'):
    """
    Envía una notificación push a todos los dispositivos suscritos de un usuario.
    Si una suscripción ya no es válida (410/404), la elimina automáticamente.
    """
    suscripciones = PushSubscription.objects.filter(usuario=usuario)

    vapid_private_key = os.environ.get('VAPID_PRIVATE_KEY', '').strip()
    vapid_claims = {
        "sub": os.environ.get('VAPID_CLAIMS_EMAIL', '').strip()
    }

    payload = json.dumps({
        'title': titulo,
        'body': cuerpo,
        'url': url,
    })

    for sub in suscripciones:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {
                        "p256dh": sub.p256dh,
                        "auth": sub.auth,
                    }
                },
                data=payload,
                vapid_private_key=vapid_private_key,
                vapid_claims=vapid_claims,
            )
        except WebPushException as ex:
            # 410 Gone / 404 Not Found = el navegador invalidó esa suscripción
            if ex.response is not None and ex.response.status_code in (404, 410):
                sub.delete()
            else:
                print(f"Error enviando push a {sub.endpoint}: {ex}")