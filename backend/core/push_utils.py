import os
import json
from pywebpush import webpush, WebPushException
from .models import PushSubscription

def _calcular_badge_count(usuario):
    from django.db import models as dj_models
    from .models import (
        TrabajoMaestranza, SolicitudMaterial, ComentarioTrabajo,
        PedidoFerreteria, ProductoFlexible, ReservaMaquina, TareaAgenda
    )

    if usuario.rol == 'ADMIN':
        maestranza_por_aprobar_o_asignar = TrabajoMaestranza.objects.filter(
            dj_models.Q(aprobado=False) | dj_models.Q(estado='PENDIENTE', asignado_a__isnull=True)
        ).exclude(estado='TERMINADO').count()

        solicitudes_por_revisar = SolicitudMaterial.objects.filter(estado='REVISION').count()
        comentarios_sin_ver = ComentarioTrabajo.objects.filter(visto_admin=False).count()
        ferreteria = PedidoFerreteria.objects.filter(estado=PedidoFerreteria.Estado.PENDIENTE).count()
        flexibles = ProductoFlexible.objects.filter(
            activo=True, stock_actual__lte=dj_models.F('stock_minimo')
        ).count()
        maquinas = ReservaMaquina.objects.filter(estado=ReservaMaquina.Estado.PENDIENTE).count()
        compras = SolicitudMaterial.objects.filter(estado='PENDIENTE').count()

        return (maestranza_por_aprobar_o_asignar + solicitudes_por_revisar
                + comentarios_sin_ver + ferreteria + flexibles + maquinas + compras)

    elif usuario.rol == 'CLIENTE':
        maestranza = TrabajoMaestranza.objects.filter(
            cliente=usuario, estado='TERMINADO', modalidad_entrega__isnull=True
        ).count()
        arriendos = ReservaMaquina.objects.filter(
            cliente=usuario, estado='APROBADA', visto=False
        ).count()
        return maestranza + arriendos

    elif usuario.rol == 'TRABAJADOR':
        trabajos_pendientes = TrabajoMaestranza.objects.filter(
            asignado_a=usuario
        ).exclude(estado='TERMINADO').count()
        tareas_pendientes = TareaAgenda.objects.filter(
            asignado_a=usuario, completada=False
        ).count()
        return trabajos_pendientes + tareas_pendientes

    return 0

def enviar_push(usuario, titulo, cuerpo, url='/'):
    suscripciones = PushSubscription.objects.filter(usuario=usuario)
    if not suscripciones.exists():
        return

    vapid_private_key = os.environ.get('VAPID_PRIVATE_KEY', '').strip()
    vapid_claims = {
        "sub": os.environ.get('VAPID_CLAIMS_EMAIL', '').strip()
    }

    badge_count = _calcular_badge_count(usuario)

    payload = json.dumps({
        'title': titulo,
        'body': cuerpo,
        'url': url,
        'badgeCount': badge_count,
    })

    for sub in suscripciones:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth}
                },
                data=payload,
                vapid_private_key=vapid_private_key,
                vapid_claims=vapid_claims,
            )
        except WebPushException as ex:
            if ex.response is not None and ex.response.status_code in (404, 410):
                sub.delete()
            else:
                print(f"Error enviando push a {sub.endpoint}: {ex}")
