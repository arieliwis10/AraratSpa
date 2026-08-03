from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.core.mail import EmailMultiAlternatives
from django.db import models
from rest_framework.views import APIView
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
import base64

from .models import (
    Usuario, Empresa, Responsable, TrabajoMaestranza, MaterialUsado,
    ComentarioTrabajo, SolicitudMaterial, Maquina, ReservaMaquina, ProductoFerreteria, PedidoFerreteria, ItemPedidoFerreteria,
    ProductoFlexible, FlexibleDetalle, ProductoGas, PedidoGas, ItemPedidoGas, Cotizacion, TareaAgenda,
    PushSubscription
)
from .serializers import (
    UsuarioSerializer, UsuarioCreateSerializer, EmpresaSerializer, ResponsableSerializer,
    TrabajoMaestranzaSerializer, MaterialUsadoSerializer, ComentarioTrabajoSerializer,
    SolicitudMaterialSerializer, MaquinaSerializer, ReservaMaquinaSerializer,
    ProductoFerreteriaSerializer, PedidoFerreteriaSerializer, ItemPedidoFerreteriaSerializer,
    ProductoFlexibleSerializer, FlexibleDetalleSerializer, ProductoGasSerializer, PedidoGasSerializer, ItemPedidoGasSerializer,
    CotizacionSerializer, TareaAgendaSerializer
)
from .push_utils import enviar_push


class EsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.rol == 'ADMIN'


# URL pública donde queda alojado el logo (reemplaza por la ruta real una vez que lo subas)
LOGO_URL = 'https://araratchile.com/wp-content/uploads/2023/02/Logos-16-1536x521.png'

# Ferretería Industrial (INSUMOS): destinatarios específicos.
# El "reply_to" es la cuenta a la que le debe llegar si el destinatario responde el correo.
FERRETERIA_INSUMOS_FROM_EMAIL = 'notificaciones@araratchile.com'  # usado como reply_to
FERRETERIA_INSUMOS_JEFE_EMAIL = 'ventasapp@araratchile.com'
FERRETERIA_INSUMOS_VENDEDOR_EMAIL = 'ariel_18gol@hotmail.com'

FACTURACION_EMAIL = 'facturacionapp@araratchile.com'

# Repuestos industriales (REPUESTOS): destinatario (como estaba)
REPUESTOS_FROM_EMAIL = 'notificaciones@araratchile.com'  # usado como reply_to
REPUESTOS_JEFE_EMAIL = 'ventasrepuestos@araratchile.com'

def health_check(request):
    return JsonResponse({"status": "ok"})


def _notificar_admins_push(titulo, cuerpo, url='/admin'):
    """
    Manda un push a todos los usuarios ADMIN que tengan al menos una
    suscripción activa. Es el equivalente push de
    Usuario.objects.filter(rol='ADMIN') que ya usás para los emails a admins.
    """
    admins = Usuario.objects.filter(rol='ADMIN')
    for admin in admins:
        enviar_push(admin, titulo, cuerpo, url)


def _notificar_responsables(trabajo):
    """
    Envía un correo (HTML + texto plano) al email de la empresa y a todos
    los responsables de la empresa del cliente cuando un trabajo se marca
    como Terminado. Si algo falla (SMTP caído, sin destinatarios, etc.) no
    bloquea el flujo del trabajo.
    """
    empresa = trabajo.cliente.empresa if trabajo.cliente else None

    destinatarios = set()

    if trabajo.cliente and trabajo.cliente.email:
        destinatarios.add(trabajo.cliente.email)

    if trabajo.responsable and trabajo.responsable.email:
        destinatarios.add(trabajo.responsable.email)

    if not destinatarios:
        return

    destinatarios = list(destinatarios)

    nombre_responsable = trabajo.responsable.nombre if trabajo.responsable else 'tu empresa'
    categoria = trabajo.get_categoria_display()
    asunto = f'Trabajo #{trabajo.correlativo} completado — Ararat'

    mensaje_intro = (
        f'Te escribo para informarte que hemos finalizado '
        f'el trabajo solicitado por {nombre_responsable}.'
    )

    texto_plano = (
        f'Hola,\n\n'
        f'{mensaje_intro}\n\n'
        f'Descripción: {trabajo.descripcion}\n\n'
        f'Ingresa al sistema para elegir retiro o delivery: https://app.araratchile.com\n\n'
        f'Ararat Estructuras Metálicas'
    )

    html = f'''
    <html>
    <body style="margin:0; padding:0; background-color:#f3f4f6; font-family: Arial, Helvetica, sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6; padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <tr>
                <td style="background-color:#0f0f0f; padding:18px 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:middle; padding-right:12px;">
                        <img src="{LOGO_URL}" alt="Ararat" height="48" style="display:block; height:48px; width:auto;">
                      </td>
                      <td style="vertical-align:middle;">
                        <span style="color:#ffffff; font-size:16px; font-weight:bold;">NOTIFICACION DE SOLICITUD</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="background-color:#be1e1e; height:4px; font-size:0; line-height:0;">&nbsp;</td>
              </tr>
              <tr>
                <td style="padding:28px 24px;">
                  <p style="margin:0 0 16px 0; font-size:20px; color:#111827;">{empresa.nombre}:</p>
                  <p style="margin:0 0 20px 0; font-size:15px; color:#111827; line-height:1.5;">
                    {mensaje_intro}
                  </p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; margin-bottom:20px;">
                    <tr>
                      <td style="padding:14px 16px; width:52px; vertical-align:top;">
                        <table role="presentation" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="background-color:#e0e7ff; border-radius:4px; padding:4px 8px;">
                              <span style="font-size:13px; font-weight:bold; color:#1e3a8a; white-space:nowrap;">
                                #{trabajo.correlativo}
                              </span>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td style="padding:14px 16px 14px 0; vertical-align:top;">
                        <p style="margin:0 0 2px 0; font-size:13px; color:#6b7280; text-transform:uppercase; font-weight:bold;">
                          {categoria}
                        </p>
                        <p style="margin:0 0 6px 0; font-size:13px; color:#374151; font-weight:bold;">
                          {empresa.nombre}
                        </p>
                        <p style="margin:0; font-size:14px; color:#111827;">
                          {trabajo.descripcion}
                        </p>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:0 0 24px 0; font-size:14px; color:#374151; line-height:1.5;">
                    Ingresa al sistema para elegir cómo quieres recibirlo (Retiro en local o Despacho).
                  </p>
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background-color:#1e3a8a; border-radius:6px;">
                        <a href="https://app.araratchile.com" target="_blank"
                           style="display:inline-block; padding:12px 24px; font-size:14px; font-weight:bold; color:#ffffff; text-decoration:none;">
                          Ir al sistema
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="background-color:#f9fafb; padding:16px 24px; border-top:1px solid #e5e7eb;">
                  <p style="margin:0; font-size:12px; color:#9ca3af;">
                    Ararat Estructuras Metálicas SPA &middot; La Rinconada de Huelquén Sitio 4 Lote B, Paine<br>
                    Este es un correo automático, no es necesario responderlo.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    '''

    try:
        email = EmailMultiAlternatives(
            subject=asunto,
            body=texto_plano,
            from_email=None,
            to=destinatarios,
        )
        email.attach_alternative(html, 'text/html')
        email.send(fail_silently=True)
    except Exception:
        pass

    if trabajo.cliente:
        enviar_push(
            trabajo.cliente,
            f'Trabajo #{trabajo.correlativo} completado',
            'Elige retiro o despacho para tu pedido.',
            '/cliente'
        )

def _notificar_reserva_maquina(reserva):
    """
    Envía un correo al cliente que hizo la reserva y al responsable
    indicado, confirmando la solicitud de arriendo y mostrando quién la pidió.
    """
    destinatarios = set()
    if reserva.cliente.email:
        destinatarios.add(reserva.cliente.email)
    if reserva.responsable and reserva.responsable.email:
        destinatarios.add(reserva.responsable.email)

    if not destinatarios:
        return

    destinatarios = list(destinatarios)
    nombre_responsable = reserva.responsable.nombre if reserva.responsable else 'Sin especificar'
    if reserva.modalidad_entrega == 'DESPACHO':
        modalidad_label = f'Despacho — {reserva.direccion_entrega}' if reserva.direccion_entrega else 'Despacho'
    else:
        modalidad_label = 'Retiro en local'
    total = reserva.precio_total

    fecha_inicio_fmt = reserva.fecha_inicio.strftime('%d/%m/%Y')
    fecha_fin_fmt = reserva.fecha_fin.strftime('%d/%m/%Y')

    texto_plano = (
        f'Hola,\n\n'
        f'Se registró tu solicitud de arriendo de {reserva.maquina.nombre}.\n\n'
        f'Desde: {fecha_inicio_fmt}\n'
        f'Hasta: {fecha_fin_fmt}\n'
        f'Solicitado por: {nombre_responsable}\n'
        f'Modalidad: {modalidad_label}\n'
        + (f'Total IVA incluido: ${total:,.0f}'.replace(',', '.') + '\n\n' if total is not None else '\n')
        + f'Queda pendiente de aprobación. Puedes revisar el estado en https://app.araratchile.com\n\n'
        f'Ararat Estructuras Metálicas'
    )

    celda_borde = 'padding:8px 12px; border:1px solid #d1d5db; text-align:left;'
    fila_total_html = (
        f'<tr><td style="{celda_borde} font-weight:bold;">Total IVA incluido</td>'
        f'<td style="{celda_borde} font-weight:bold;">${total:,.0f}</td></tr>'.replace(',', '.')
        if total is not None else ''
    )

    html = f'''
    <html>
    <body style="margin:0; padding:0; background-color:#f3f4f6; font-family: Arial, Helvetica, sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6; padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <tr>
                <td style="background-color:#0f0f0f; padding:18px 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:middle; padding-right:12px;">
                        <img src="{LOGO_URL}" alt="Ararat" height="48" style="display:block; height:48px; width:auto;">
                      </td>
                      <td style="vertical-align:middle;">
                        <span style="color:#ffffff; font-size:16px; font-weight:bold;">SOLICITUD DE ARRIENDO</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="background-color:#be1e1e; height:4px; font-size:0; line-height:0;">&nbsp;</td>
              </tr>
              <tr>
                <td style="padding:24px;">
                  <p style="margin:0 0 16px 0; font-size:15px; color:#111827;">
                    Se registró la solicitud de arriendo de <strong>{reserva.maquina.nombre}</strong>.
                  </p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin:0 0 16px 0;">
                    <tr><td style="{celda_borde} font-weight:bold; width:40%;">Desde</td><td style="{celda_borde}">{fecha_inicio_fmt}</td></tr>
                    <tr><td style="{celda_borde} font-weight:bold;">Hasta</td><td style="{celda_borde}">{fecha_fin_fmt}</td></tr>
                    <tr><td style="{celda_borde} font-weight:bold;">Solicitado por</td><td style="{celda_borde}">{nombre_responsable}</td></tr>
                    <tr><td style="{celda_borde} font-weight:bold;">Modalidad</td><td style="{celda_borde}">{modalidad_label}</td></tr>
                    {fila_total_html}
                  </table>
                  <p style="margin:0; font-size:13px; color:#6b7280;">
                    Queda pendiente de aprobación por parte de Ararat.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background-color:#f9fafb; padding:16px 24px; border-top:1px solid #e5e7eb;">
                  <p style="margin:0; font-size:12px; color:#9ca3af;">
                    Ararat Estructuras Metálicas SPA &middot; La Rinconada de Huelquén Sitio 4 Lote B, Paine<br>
                    Este es un correo automático, no es necesario responderlo.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    '''

    try:
        email = EmailMultiAlternatives(
            subject=f'Solicitud de arriendo — {reserva.maquina.nombre}',
            body=texto_plano,
            from_email=None,
            to=destinatarios,
        )
        email.attach_alternative(html, 'text/html')
        email.send(fail_silently=True)
    except Exception:
        pass

    # Push a los admins: es a ellos a quienes les corresponde aprobar/rechazar
    _notificar_admins_push(
        'Nueva solicitud de arriendo',
        f'{reserva.maquina.nombre} — pendiente de aprobación',
        '/admin'
    )

def _notificar_reserva_aprobada(reserva):
    """
    Envía un correo al cliente y al responsable cuando el admin aprueba
    una reserva de máquina.
    """
    destinatarios = set()
    if reserva.cliente.email:
        destinatarios.add(reserva.cliente.email)
    if reserva.responsable and reserva.responsable.email:
        destinatarios.add(reserva.responsable.email)

    if not destinatarios:
        return

    destinatarios = list(destinatarios)
    nombre_responsable = reserva.responsable.nombre if reserva.responsable else 'Sin especificar'
    fecha_inicio_fmt = reserva.fecha_inicio.strftime('%d/%m/%Y')
    fecha_fin_fmt = reserva.fecha_fin.strftime('%d/%m/%Y')

    if reserva.modalidad_entrega == 'DESPACHO':
        modalidad_label = f'Despacho — {reserva.direccion_entrega}' if reserva.direccion_entrega else 'Despacho'
    else:
        modalidad_label = 'Retiro en local'

    texto_plano = (
        f'Hola,\n\n'
        f'Tu solicitud de arriendo de {reserva.maquina.nombre} fue APROBADA.\n\n'
        f'Desde: {fecha_inicio_fmt}\n'
        f'Hasta: {fecha_fin_fmt}\n'
        f'Solicitado por: {nombre_responsable}\n'
        f'Modalidad: {modalidad_label}\n\n'
        f'Revisa el detalle en https://app.araratchile.com\n\n'
        f'Ararat Estructuras Metálicas'
    )

    celda_borde = 'padding:8px 12px; border:1px solid #d1d5db; text-align:left;'

    html = f'''
    <html>
    <body style="margin:0; padding:0; background-color:#f3f4f6; font-family: Arial, Helvetica, sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6; padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <tr>
                <td style="background-color:#0f0f0f; padding:18px 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:middle; padding-right:12px;">
                        <img src="{LOGO_URL}" alt="Ararat" height="48" style="display:block; height:48px; width:auto;">
                      </td>
                      <td style="vertical-align:middle;">
                        <span style="color:#ffffff; font-size:16px; font-weight:bold;">ARRIENDO APROBADO</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="background-color:#22c55e; height:4px; font-size:0; line-height:0;">&nbsp;</td>
              </tr>
              <tr>
                <td style="padding:24px;">
                  <p style="margin:0 0 16px 0; font-size:15px; color:#111827;">
                    Tu solicitud de arriendo de <strong>{reserva.maquina.nombre}</strong> fue <strong>aprobada</strong>.
                  </p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin:0 0 16px 0;">
                    <tr><td style="{celda_borde} font-weight:bold; width:40%;">Desde</td><td style="{celda_borde}">{fecha_inicio_fmt}</td></tr>
                    <tr><td style="{celda_borde} font-weight:bold;">Hasta</td><td style="{celda_borde}">{fecha_fin_fmt}</td></tr>
                    <tr><td style="{celda_borde} font-weight:bold;">Solicitado por</td><td style="{celda_borde}">{nombre_responsable}</td></tr>
                    <tr><td style="{celda_borde} font-weight:bold;">Modalidad</td><td style="{celda_borde}">{modalidad_label}</td></tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="background-color:#f9fafb; padding:16px 24px; border-top:1px solid #e5e7eb;">
                  <p style="margin:0; font-size:12px; color:#9ca3af;">
                    Ararat Estructuras Metálicas SPA &middot; La Rinconada de Huelquén Sitio 4 Lote B, Paine<br>
                    Este es un correo automático, no es necesario responderlo.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    '''

    try:
        email = EmailMultiAlternatives(
            subject=f'Arriendo aprobado — {reserva.maquina.nombre}',
            body=texto_plano,
            from_email=None,
            to=destinatarios,
        )
        email.attach_alternative(html, 'text/html')
        email.send(fail_silently=True)
    except Exception:
        pass

    enviar_push(
        reserva.cliente,
        'Arriendo aprobado',
        f'{reserva.maquina.nombre} — tu reserva fue aprobada.',
        '/cliente'
    )

def _enviar_correo_pedido(pedido, destinatarios, asunto, mostrar_precio, reply_to):
    """
    Arma y envía el correo de un pedido de ferretería/repuestos.
    Si mostrar_precio=True, la tabla incluye SKU y Precio; si es False,
    solo Producto, SKU y Cantidad (sin precio) — pensado para el vendedor.

    El correo sale con from_email=None (usa DEFAULT_FROM_EMAIL, la cuenta
    real autenticada en el servidor SMTP), para no ser rechazado/filtrado
    por SPF/DKIM. El parámetro reply_to hace que, si el destinatario aprieta
    "Responder", le llegue a la persona/cuenta que corresponde.
    """
    empresa = pedido.cliente.empresa
    categoria = pedido.get_categoria_display()
    nombre_responsable = pedido.responsable.nombre if pedido.responsable else 'Sin especificar'
    items = pedido.items.all()

    if mostrar_precio:
        filas_texto = '\n'.join(
            f"- {item.nombre} (SKU: {item.sku or '-'}) x{item.cantidad} "
            f"— ${item.precio or 0:,.0f}".replace(',', '.')
            for item in items
        )
        total = sum((item.precio or 0) * item.cantidad for item in items)
    else:
        filas_texto = '\n'.join(
            f"- {item.nombre} (SKU: {item.sku or '-'}) x{item.cantidad}"
            for item in items
        )
        total = None

    texto_plano = (
        f'Nueva solicitud de {categoria}.\n\n'
        f'Empresa: {empresa.nombre if empresa else "-"}\n'
        f'Solicitado por: {nombre_responsable}\n'
        f'Centro de costo: {pedido.centro_costo}\n\n'
        f'Ítems pedidos:\n{filas_texto}\n\n'
        + (f'Total: ${total:,.0f}'.replace(',', '.') + '\n\n' if total is not None else '')
        + f'Revisa el detalle en el sistema: https://app.araratchile.com'
    )

    celda_borde = 'padding:8px 12px; border:1px solid #d1d5db; text-align:center;'
    encabezado_borde = 'padding:8px 12px; border:1px solid #d1d5db; text-align:center; background-color:#111827; color:#ffffff; font-size:12px; font-weight:bold;'

    if mostrar_precio:
        filas_html = ''.join(
            f'<tr>'
            f'<td style="{celda_borde}">{item.nombre}</td>'
            f'<td style="{celda_borde}">{item.cantidad}</td>'
            f'<td style="{celda_borde}">{item.sku or "-"}</td>'
            f'<td style="{celda_borde}">${(item.precio or 0):,.0f}</td>'
            f'</tr>'.replace(',', '.')
            for item in items
        )
        encabezados_html = (
            f'<td style="{encabezado_borde}">Producto</td>'
            f'<td style="{encabezado_borde}">Cantidad</td>'
            f'<td style="{encabezado_borde}">SKU</td>'
            f'<td style="{encabezado_borde}">Precio</td>'
        )
        fila_total_html = (
            f'<tr><td colspan="3" style="{celda_borde} font-weight:bold;">Total + IVA</td>'
            f'<td style="{celda_borde} font-weight:bold;">${total:,.0f}</td></tr>'.replace(',', '.')
        )
    else:
        filas_html = ''.join(
            f'<tr>'
            f'<td style="{celda_borde}">{item.nombre}</td>'
            f'<td style="{celda_borde}">{item.cantidad}</td>'
            f'<td style="{celda_borde}">{item.sku or "-"}</td>'
            f'</tr>'
            for item in items
        )
        encabezados_html = (
            f'<td style="{encabezado_borde}">Producto</td>'
            f'<td style="{encabezado_borde}">Cantidad</td>'
            f'<td style="{encabezado_borde}">SKU</td>'
        )
        fila_total_html = ''

    html = f'''
    <html>
    <body style="margin:0; padding:0; background-color:#f3f4f6; font-family: Arial, Helvetica, sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6; padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <tr>
                <td style="background-color:#0f0f0f; padding:18px 24px;">
                  <span style="color:#ffffff; font-size:16px; font-weight:bold;">Solicitud De Cotizacion Ararat</span>
                </td>
              </tr>
              <tr>
                <td style="background-color:#be1e1e; height:4px; font-size:0; line-height:0;">&nbsp;</td>
              </tr>
              <tr>
                <td style="padding:24px;">
                  <p style="margin:0 0 4px 0; font-size:14px; color:#111827;">Estimados,</p>
                  <p style="margin:0 0 16px 0; font-size:14px; color:#111827;">Junto con saludar, les solicitamos por favor generar a la brevedad una cotización para los siguientes productos, considerando precio mayorista:</p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin:0 0 16px 0; width:100%;">
                    <tr>{encabezados_html}</tr>
                    {filas_html}
                    {fila_total_html}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    '''

    email = EmailMultiAlternatives(
        subject=asunto,
        body=texto_plano,
        from_email=None,
        to=destinatarios,
        reply_to=[reply_to],
    )
    email.attach_alternative(html, 'text/html')
    email.send(fail_silently=False)


def _notificar_pedido_ferreteria(pedido):
    """
    Envía la(s) notificación(es) de un pedido nuevo. El remitente técnico
    (From) siempre es la cuenta real autenticada (DEFAULT_FROM_EMAIL) para
    pasar SPF/DKIM; el "Responder a" queda con la cuenta correspondiente:

    - Ferretería Industrial (INSUMOS): DOS correos, ambos con
      reply_to=soldadurasararat@gmail.com:
        1) a ventasapp@araratchile.com, con producto/sku/cantidad/precio + total
        2) a ariel_18gol@hotmail.com (vendedor), con producto/sku/cantidad, sin precio
    - Repuestos industriales (REPUESTOS): un solo correo, reply_to=ventasapp@araratchile.com,
      a soldadurasararat@gmail.com, con la tabla completa.
    """
    categoria_label = pedido.get_categoria_display()
    empresa = pedido.cliente.empresa
    nombre_empresa = empresa.nombre if empresa else ''

    if pedido.categoria == PedidoFerreteria.Categoria.INSUMOS:
        asunto_jefe = f'{categoria_label} — {nombre_empresa}'
        asunto_vendedor = f'Solicitud de cotización'

        _enviar_correo_pedido(
            pedido, [FERRETERIA_INSUMOS_JEFE_EMAIL], asunto_jefe,
            mostrar_precio=True, reply_to=FERRETERIA_INSUMOS_FROM_EMAIL
        )
        _enviar_correo_pedido(
            pedido, [FERRETERIA_INSUMOS_VENDEDOR_EMAIL], asunto_vendedor,
            mostrar_precio=False, reply_to=FERRETERIA_INSUMOS_FROM_EMAIL
        )
    else:
        asunto = f'Nueva solicitud de {categoria_label} — {nombre_empresa}'
        _enviar_correo_pedido(
            pedido, [REPUESTOS_JEFE_EMAIL], asunto,
            mostrar_precio=True, reply_to=REPUESTOS_FROM_EMAIL
        )

    # Estos destinatarios (jefe/vendedor de ferretería) son emails externos,
    # no Usuarios del sistema, así que no reciben push - solo email.
    # Sí avisamos a los admins internos, igual que con las demás solicitudes.
    _notificar_admins_push(
        f'Nuevo pedido de {categoria_label}',
        f'{nombre_empresa} — revisar en el sistema',
        '/admin'
    )


class EmpresaViewSet(viewsets.ModelViewSet):
    queryset = Empresa.objects.all()
    serializer_class = EmpresaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [EsAdmin()]
        return [permissions.IsAuthenticated()]


class ResponsableViewSet(viewsets.ModelViewSet):
    serializer_class = ResponsableSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.rol == 'ADMIN':
            return Responsable.objects.all()
        elif user.rol == 'CLIENTE' and user.empresa:
            return Responsable.objects.filter(empresa=user.empresa)
        return Responsable.objects.none()

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [EsAdmin()]
        return [permissions.IsAuthenticated()]


class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all()
    permission_classes = [EsAdmin]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return UsuarioCreateSerializer
        return UsuarioSerializer

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        serializer = UsuarioSerializer(request.user)
        return Response(serializer.data)


def _notificar_nuevo_trabajo(trabajo):
    """
    Envía un correo a todos los admins con email cargado cuando un cliente
    crea un trabajo de Maestranza de cualquier categoría, para que se
    enteren de la solicitud sin tener que estar mirando el panel.
    """
    destinatarios = list(
        Usuario.objects.filter(rol='ADMIN').exclude(email='').values_list('email', flat=True)
    )
    if not destinatarios:
        return

    empresa = trabajo.cliente.empresa if trabajo.cliente else None
    nombre_empresa = empresa.nombre if empresa else (trabajo.cliente.username if trabajo.cliente else '-')
    nombre_responsable = trabajo.responsable.nombre if trabajo.responsable else 'Sin especificar'
    categoria_label = trabajo.get_categoria_display()

    texto_plano = (
        f'Nueva solicitud de {categoria_label}.\n\n'
        f'Empresa: {nombre_empresa}\n'
        f'Solicitado por: {nombre_responsable}\n'
        f'Centro de costo: {trabajo.centro_costo}\n\n'
        f'Descripción:\n{trabajo.descripcion}\n\n'
        f'Revísalo en https://app.araratchile.com\n\n'
        f'Ararat Estructuras Metálicas'
    )

    celda_borde = 'padding:8px 12px; border:1px solid #d1d5db; text-align:left;'
    html = f'''
    <html>
    <body style="margin:0; padding:0; background-color:#f3f4f6; font-family: Arial, Helvetica, sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6; padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <tr>
                <td style="background-color:#0f0f0f; padding:18px 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:middle; padding-right:12px;">
                        <img src="{LOGO_URL}" alt="Ararat" height="48" style="display:block; height:48px; width:auto;">
                      </td>
                      <td style="vertical-align:middle;">
                        <span style="color:#ffffff; font-size:16px; font-weight:bold;">NUEVA SOLICITUD — {categoria_label.upper()}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="background-color:#be1e1e; height:4px; font-size:0; line-height:0;">&nbsp;</td>
              </tr>
              <tr>
                <td style="padding:24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin:0 0 16px 0;">
                    <tr><td style="{celda_borde} font-weight:bold; width:40%;">Empresa</td><td style="{celda_borde}">{nombre_empresa}</td></tr>
                    <tr><td style="{celda_borde} font-weight:bold;">Solicitado por</td><td style="{celda_borde}">{nombre_responsable}</td></tr>
                    <tr><td style="{celda_borde} font-weight:bold;">Centro de costo</td><td style="{celda_borde}">{trabajo.centro_costo}</td></tr>
                  </table>
                  <p style="margin:0; font-size:14px; color:#111827; white-space:pre-line;">{trabajo.descripcion}</p>
                </td>
              </tr>
              <tr>
                <td style="background-color:#f9fafb; padding:16px 24px; border-top:1px solid #e5e7eb;">
                  <p style="margin:0; font-size:12px; color:#9ca3af;">
                    Ararat Estructuras Metálicas SPA &middot; La Rinconada de Huelquén Sitio 4 Lote B, Paine<br>
                    Este es un correo automático, no es necesario responderlo.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    '''

    try:
        email = EmailMultiAlternatives(
            subject=f'Nueva solicitud de {categoria_label} — {nombre_empresa}',
            body=texto_plano,
            from_email=None,
            to=destinatarios,
        )
        email.attach_alternative(html, 'text/html')
        email.send(fail_silently=True)
    except Exception:
        pass

    _notificar_admins_push(
        f'Nueva solicitud de {categoria_label}',
        f'{nombre_empresa} — {nombre_responsable}',
        '/admin'
    )


def _notificar_trabajo_aprobado(trabajo):
    """
    Envía un correo al cliente y al responsable del trabajo cuando el admin
    lo aprueba, avisando que el trabajo quedó en proceso.
    """
    destinatarios = set()
    if trabajo.cliente and trabajo.cliente.email:
        destinatarios.add(trabajo.cliente.email)
    if trabajo.responsable and trabajo.responsable.email:
        destinatarios.add(trabajo.responsable.email)
    if not destinatarios:
        return
    destinatarios = list(destinatarios)

    empresa = trabajo.cliente.empresa if trabajo.cliente else None
    nombre_empresa = empresa.nombre if empresa else 'tu empresa'
    categoria_label = trabajo.get_categoria_display()

    texto_plano = (
        f'Hola,\n\n'
        f'Tu solicitud de {categoria_label} (#{trabajo.correlativo}) fue aprobada '
        f'y ya está en proceso.\n\n'
        f'Descripción: {trabajo.descripcion}\n\n'
        f'Puedes revisar el avance en https://app.araratchile.com\n\n'
        f'Ararat Estructuras Metálicas'
    )

    celda_borde = 'padding:8px 12px; border:1px solid #d1d5db; text-align:left;'
    html = f'''
    <html>
    <body style="margin:0; padding:0; background-color:#f3f4f6; font-family: Arial, Helvetica, sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6; padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <tr>
                <td style="background-color:#0f0f0f; padding:18px 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:middle; padding-right:12px;">
                        <img src="{LOGO_URL}" alt="Ararat" height="48" style="display:block; height:48px; width:auto;">
                      </td>
                      <td style="vertical-align:middle;">
                        <span style="color:#ffffff; font-size:16px; font-weight:bold;">TRABAJO EN PROCESO</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="background-color:#be1e1e; height:4px; font-size:0; line-height:0;">&nbsp;</td>
              </tr>
              <tr>
                <td style="padding:24px;">
                  <p style="margin:0 0 16px 0; font-size:15px; color:#111827;">
                    Se aprobó tu solicitud de <strong>{categoria_label}</strong> y ya está en proceso.
                  </p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin:0 0 16px 0;">
                    <tr><td style="{celda_borde} font-weight:bold; width:40%;">Empresa</td><td style="{celda_borde}">{nombre_empresa}</td></tr>
                    <tr><td style="{celda_borde} font-weight:bold;">Trabajo</td><td style="{celda_borde}">#{trabajo.correlativo}</td></tr>
                  </table>
                  <p style="margin:0; font-size:14px; color:#111827;">{trabajo.descripcion}</p>
                </td>
              </tr>
              <tr>
                <td style="background-color:#f9fafb; padding:16px 24px; border-top:1px solid #e5e7eb;">
                  <p style="margin:0; font-size:12px; color:#9ca3af;">
                    Ararat Estructuras Metálicas SPA &middot; La Rinconada de Huelquén Sitio 4 Lote B, Paine<br>
                    Este es un correo automático, no es necesario responderlo.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    '''

    try:
        email = EmailMultiAlternatives(
            subject=f'Trabajo #{trabajo.correlativo} en proceso — Ararat',
            body=texto_plano,
            from_email=None,
            to=destinatarios,
        )
        email.attach_alternative(html, 'text/html')
        email.send(fail_silently=True)
    except Exception:
        pass

    if trabajo.cliente:
        enviar_push(
            trabajo.cliente,
            f'Trabajo #{trabajo.correlativo} en proceso',
            'Tu solicitud fue aprobada y ya está en curso.',
            '/cliente'
        )


def _notificar_comentario_admin(trabajo, comentario):
    """
    Correo a los admins cuando el CLIENTE agrega un comentario a un trabajo
    (no se notifica cuando el que comenta es el propio admin).
    """
    destinatarios = list(
        Usuario.objects.filter(rol='ADMIN').exclude(email='').values_list('email', flat=True)
    )
    if not destinatarios:
        return

    empresa = trabajo.cliente.empresa if trabajo.cliente else None
    nombre_empresa = empresa.nombre if empresa else '-'
    autor = comentario.responsable.nombre if comentario.responsable else trabajo.cliente.username

    texto_plano = (
        f'{autor} ({nombre_empresa}) comentó en el trabajo #{trabajo.correlativo} '
        f'({trabajo.get_categoria_display()}):\n\n'
        f'"{comentario.mensaje}"\n\n'
        f'Revísalo en https://app.araratchile.com\n\n'
        f'Ararat Estructuras Metálicas'
    )

    try:
        email = EmailMultiAlternatives(
            subject=f'Nuevo comentario — Trabajo #{trabajo.correlativo}',
            body=texto_plano,
            from_email=None,
            to=destinatarios,
        )
        email.send(fail_silently=True)
    except Exception:
        pass

    _notificar_admins_push(
        f'Nuevo comentario — Trabajo #{trabajo.correlativo}',
        f'{autor} ({nombre_empresa}): {comentario.mensaje[:80]}',
        '/admin'
    )


def _notificar_completado_admin(trabajo):
    """Correo a los admins cuando un trabajo se marca como Terminado."""
    destinatarios = list(
        Usuario.objects.filter(rol='ADMIN').exclude(email='').values_list('email', flat=True)
    )
    if not destinatarios:
        return

    empresa = trabajo.cliente.empresa if trabajo.cliente else None
    nombre_empresa = empresa.nombre if empresa else '-'

    texto_plano = (
        f'El trabajo #{trabajo.correlativo} ({trabajo.get_categoria_display()}) de '
        f'{nombre_empresa} se marcó como Terminado. Ya se notificó al cliente para '
        f'que elija retiro o despacho.\n\n'
        f'Ararat Estructuras Metálicas'
    )

    try:
        email = EmailMultiAlternatives(
            subject=f'Trabajo #{trabajo.correlativo} completado — {nombre_empresa}',
            body=texto_plano,
            from_email=None,
            to=destinatarios,
        )
        email.send(fail_silently=True)
    except Exception:
        pass

    _notificar_admins_push(
        f'Trabajo #{trabajo.correlativo} completado',
        f'{nombre_empresa} — ya se notificó al cliente',
        '/admin'
    )


def _notificar_modalidad_admin(trabajo):
    """Correo a los admins cuando el cliente elige retiro/despacho."""
    destinatarios = list(
        Usuario.objects.filter(rol='ADMIN').exclude(email='').values_list('email', flat=True)
    )
    if not destinatarios:
        return

    empresa = trabajo.cliente.empresa if trabajo.cliente else None
    nombre_empresa = empresa.nombre if empresa else '-'
    modalidad_label = (
        f'Despacho — {trabajo.direccion_entrega}' if trabajo.modalidad_entrega == 'DELIVERY'
        else 'Retiro en local'
    )

    texto_plano = (
        f'{nombre_empresa} eligió cómo recibir el trabajo #{trabajo.correlativo} '
        f'({trabajo.get_categoria_display()}):\n\n'
        f'{modalidad_label}\n\n'
        f'Ararat Estructuras Metálicas'
    )

    try:
        email = EmailMultiAlternatives(
            subject=f'Modalidad de entrega elegida — Trabajo #{trabajo.correlativo}',
            body=texto_plano,
            from_email=None,
            to=destinatarios,
        )
        email.send(fail_silently=True)
    except Exception:
        pass

    _notificar_admins_push(
        f'Modalidad elegida — Trabajo #{trabajo.correlativo}',
        f'{nombre_empresa}: {modalidad_label}',
        '/admin'
    )


class TrabajoMaestranzaViewSet(viewsets.ModelViewSet):
    serializer_class = TrabajoMaestranzaSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        if user.rol == 'ADMIN':
            qs = TrabajoMaestranza.objects.all()
            empresa_id = self.request.query_params.get('empresa')
            if empresa_id:
                qs = qs.filter(cliente__empresa_id=empresa_id)
            return qs.order_by('-created_at')
        elif user.rol == 'TRABAJADOR':
            return TrabajoMaestranza.objects.filter(asignado_a=user).order_by('-created_at')
        return TrabajoMaestranza.objects.filter(cliente=user).order_by('-created_at')

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            return [EsAdmin()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        trabajo = serializer.save(cliente=self.request.user)
        _notificar_nuevo_trabajo(trabajo)

    def perform_update(self, serializer):
        estaba_aprobado = serializer.instance.aprobado
        asignado_anterior_id = serializer.instance.asignado_a_id
        trabajo = serializer.save()
        if trabajo.aprobado and not estaba_aprobado:
            _notificar_trabajo_aprobado(trabajo)
        # Aviso push al Trabajador cuando se le asigna (o reasigna) el trabajo.
        # No hay email para esto hoy, así que el push es el único aviso instantáneo.
        if trabajo.asignado_a_id and trabajo.asignado_a_id != asignado_anterior_id:
            enviar_push(
                trabajo.asignado_a,
                'Nuevo trabajo asignado',
                f'#{trabajo.correlativo} — {trabajo.descripcion[:60]}',
                '/trabajador'
            )

    def _puede_operar(self, request, trabajo):
        return request.user.rol == 'ADMIN' or trabajo.asignado_a_id == request.user.id

    @action(detail=True, methods=['patch'], permission_classes=[EsAdmin])
    def aprobar(self, request, pk=None):
        trabajo = self.get_object()
        trabajo.aprobado = True
        trabajo.save()
        _notificar_trabajo_aprobado(trabajo)
        return Response(TrabajoMaestranzaSerializer(trabajo).data)

    @action(detail=True, methods=['patch'], permission_classes=[permissions.IsAuthenticated])
    def actualizar_foto(self, request, pk=None):
        trabajo = self.get_object()
        if trabajo.cliente != request.user:
            return Response({'error': 'No autorizado'}, status=403)
        if trabajo.estado != 'PENDIENTE':
            return Response(
                {'error': 'Solo puedes agregar o cambiar la foto mientras el trabajo está pendiente'},
                status=400,
            )
        foto = request.FILES.get('foto')
        if not foto:
            return Response({'error': 'Falta la foto'}, status=400)
        trabajo.foto = foto
        trabajo.save()
        return Response(TrabajoMaestranzaSerializer(trabajo).data)

    @action(detail=True, methods=['patch'], permission_classes=[permissions.IsAuthenticated])
    def actualizar_progreso(self, request, pk=None):
        trabajo = self.get_object()
        if not self._puede_operar(request, trabajo):
            return Response({'error': 'No autorizado'}, status=403)

        if 'estado' in request.data:
            trabajo.estado = request.data['estado']
        if 'avance' in request.data:
            avance = request.data['avance']
            if avance in (None, ''):
                avance = 0
            try:
                avance = int(avance)
            except (TypeError, ValueError):
                return Response({'error': 'El avance debe ser un número entre 0 y 100.'}, status=400)
            if not (0 <= avance <= 100):
                return Response({'error': 'El avance debe estar entre 0 y 100.'}, status=400)
            trabajo.avance = avance
        if 'tiempo_entrega' in request.data:
            trabajo.tiempo_entrega = request.data['tiempo_entrega'] or None

        trabajo.save()
        return Response(TrabajoMaestranzaSerializer(trabajo).data)

    @action(detail=True, methods=['patch'])
    def marcar_completado(self, request, pk=None):
        trabajo = self.get_object()

        if hasattr(trabajo, 'detalle_flexible'):
            faltantes = trabajo.detalle_flexible.productos_faltantes()
            if faltantes:
                return Response(
                    {
                        'error': 'No se puede completar el trabajo: faltan productos en el catálogo de Flexibles.',
                        'productos_faltantes': faltantes,
                    },
                    status=400,
                )
        trabajo.estado = 'TERMINADO'
        trabajo.avance = 100
        if hasattr(trabajo, 'detalle_flexible'):
            trabajo.detalle_flexible.descontar_stock()

        trabajo.save()
        _notificar_responsables(trabajo)
        _notificar_completado_admin(trabajo)
        return Response(TrabajoMaestranzaSerializer(trabajo).data)

    @action(detail=True, methods=['patch'], permission_classes=[permissions.IsAuthenticated])
    def elegir_entrega(self, request, pk=None):
        trabajo = self.get_object()
        if trabajo.cliente != request.user:
            return Response({'error': 'No autorizado'}, status=403)
        if trabajo.estado != 'TERMINADO':
            return Response({'error': 'El trabajo todavía no está completado'}, status=400)

        modalidad = request.data.get('modalidad_entrega')
        direccion = request.data.get('direccion_entrega', '')
        if modalidad not in ['RETIRO', 'DELIVERY']:
            return Response({'error': 'Modalidad inválida'}, status=400)
        if modalidad == 'DELIVERY' and not direccion.strip():
            return Response({'error': 'Falta la dirección de entrega'}, status=400)

        trabajo.modalidad_entrega = modalidad
        trabajo.direccion_entrega = direccion if modalidad == 'DELIVERY' else ''
        trabajo.save()
        _notificar_modalidad_admin(trabajo)
        return Response(TrabajoMaestranzaSerializer(trabajo).data)

    @action(detail=True, methods=['patch'], permission_classes=[permissions.IsAuthenticated])
    def reportar_retraso(self, request, pk=None):
        trabajo = self.get_object()
        if not self._puede_operar(request, trabajo):
            return Response({'error': 'No autorizado'}, status=403)

        from django.utils import timezone
        motivo = request.data.get('motivo', '')
        trabajo.retrasado = True
        trabajo.motivo_retraso = motivo
        trabajo.fecha_retraso = timezone.now()
        trabajo.save()

        SolicitudMaterial.objects.create(trabajo=trabajo, descripcion=motivo)

        _notificar_admins_push(
            f'Retraso reportado — Trabajo #{trabajo.correlativo}',
            motivo[:100] if motivo else 'Sin motivo especificado',
            '/admin'
        )

        return Response(TrabajoMaestranzaSerializer(trabajo).data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def agregar_material(self, request, pk=None):
        trabajo = self.get_object()
        if not self._puede_operar(request, trabajo):
            return Response({'error': 'No autorizado'}, status=403)
        serializer = MaterialUsadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(trabajo=trabajo)
        return Response(TrabajoMaestranzaSerializer(trabajo).data)

    @action(detail=True, methods=['post'])
    def guardar_detalle_flexible(self, request, pk=None):
        trabajo = self.get_object()
        detalle = FlexibleDetalle.objects.filter(trabajo=trabajo).first()

        if detalle:
            serializer = FlexibleDetalleSerializer(detalle, data=request.data, partial=True)
        else:
            serializer = FlexibleDetalleSerializer(data={**request.data, 'trabajo': trabajo.id})

        serializer.is_valid(raise_exception=True)
        serializer.save(trabajo=trabajo)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def agregar_comentario(self, request, pk=None):
        """
        Chat/notas entre el cliente y el admin sobre un trabajo ya aprobado.
        get_queryset ya limita qué trabajos puede ver cada rol, así que si
        el cliente llega aquí es porque el trabajo es suyo.
        """
        trabajo = self.get_object()
        user = request.user

        if user.rol not in ['ADMIN', 'CLIENTE']:
            return Response({'error': 'No autorizado'}, status=403)

        if not trabajo.aprobado:
            return Response({'error': 'El trabajo todavía no ha sido aprobado'}, status=400)

        mensaje = (request.data.get('mensaje') or '').strip()
        if not mensaje:
            return Response({'error': 'Escribe un mensaje'}, status=400)

        responsable_obj = None
        if user.rol == 'CLIENTE':
            responsable_id = request.data.get('responsable')
            if not responsable_id:
                return Response({'error': 'Selecciona quién de tu empresa está comentando'}, status=400)
            try:
                responsable_obj = Responsable.objects.get(id=responsable_id, empresa=user.empresa)
            except Responsable.DoesNotExist:
                return Response({'error': 'Responsable inválido'}, status=400)

        comentario = ComentarioTrabajo.objects.create(
            trabajo=trabajo, autor=user, responsable=responsable_obj, mensaje=mensaje,
            visto_admin=(user.rol != 'CLIENTE'),
        )
        if user.rol == 'CLIENTE':
            _notificar_comentario_admin(trabajo, comentario)
        else:
            # Comentario del admin: avisamos al cliente por push (no había
            # ningún aviso instantáneo para este caso).
            if trabajo.cliente:
                enviar_push(
                    trabajo.cliente,
                    f'Nuevo comentario — Trabajo #{trabajo.correlativo}',
                    mensaje[:80],
                    '/cliente'
                )
        return Response(TrabajoMaestranzaSerializer(trabajo).data)

    @action(detail=True, methods=['patch'], permission_classes=[EsAdmin])
    def marcar_comentarios_vistos(self, request, pk=None):
        trabajo = self.get_object()
        trabajo.comentarios.filter(visto_admin=False).update(visto_admin=True)
        return Response({'ok': True})


class SolicitudMaterialViewSet(viewsets.ModelViewSet):
    serializer_class = SolicitudMaterialSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.rol == 'ADMIN':
            return SolicitudMaterial.objects.all().order_by('-created_at')
        elif user.rol == 'TRABAJADOR':
            from django.db.models import Q
            return SolicitudMaterial.objects.filter(
                Q(trabajo__asignado_a=user) | Q(solicitante=user)
            ).order_by('-created_at')
        return SolicitudMaterial.objects.none()

    def _resolver(self, solicitud, lugar_compra=''):
        from django.utils import timezone
        solicitud.estado = 'RECIBIDO'
        solicitud.lugar_compra = lugar_compra
        solicitud.resuelto_en = timezone.now()
        solicitud.save()
        if solicitud.trabajo:
            solicitud.trabajo.retrasado = False
            solicitud.trabajo.save()

        # Avisa por push a quien la haya originado (trabajo asignado o solicitante suelto)
        destinatario = None
        if solicitud.trabajo and solicitud.trabajo.asignado_a:
            destinatario = solicitud.trabajo.asignado_a
        elif solicitud.solicitante:
            destinatario = solicitud.solicitante
        if destinatario:
            enviar_push(
                destinatario,
                'Solicitud resuelta',
                solicitud.descripcion[:80],
                '/trabajador'
            )

    def _puede_operar_solicitud(self, request, solicitud):
        user = request.user
        if user.rol == 'ADMIN':
            return True
        if solicitud.trabajo:
            return solicitud.trabajo.asignado_a_id == user.id
        return solicitud.solicitante_id == user.id

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def solicitar(self, request):
        """
        Pedido suelto de herramienta/material, sin trabajo asociado.
        Queda registrado quién lo pidió (solicitante) y cuándo (created_at),
        a modo de evidencia.
        """
        descripcion = (request.data.get('descripcion') or '').strip()
        if not descripcion:
            return Response({'error': 'Escribe qué necesitas'}, status=400)

        solicitud = SolicitudMaterial.objects.create(
            solicitante=request.user, descripcion=descripcion
        )
        _notificar_admins_push(
            'Nueva solicitud de herramienta/material',
            f'{request.user.username}: {descripcion[:80]}',
            '/admin'
        )
        return Response(SolicitudMaterialSerializer(solicitud).data, status=201)

    @action(detail=True, methods=['patch'], permission_classes=[permissions.IsAuthenticated])
    def hay_en_bodega(self, request, pk=None):
        solicitud = self.get_object()
        if not self._puede_operar_solicitud(request, solicitud):
            return Response({'error': 'No autorizado'}, status=403)
        self._resolver(solicitud, lugar_compra='Bodega propia')
        return Response(SolicitudMaterialSerializer(solicitud).data)

    @action(detail=True, methods=['patch'], permission_classes=[EsAdmin])
    def enviar_a_compras(self, request, pk=None):
        solicitud = self.get_object()
        solicitud.estado = 'PENDIENTE'
        solicitud.save()
        return Response(SolicitudMaterialSerializer(solicitud).data)

    @action(detail=True, methods=['patch'], permission_classes=[permissions.IsAuthenticated])
    def marcar_recibido(self, request, pk=None):
        solicitud = self.get_object()
        if not self._puede_operar_solicitud(request, solicitud):
            return Response({'error': 'No autorizado'}, status=403)
        lugar_compra = request.data.get('lugar_compra', '')
        self._resolver(solicitud, lugar_compra=lugar_compra)
        return Response(SolicitudMaterialSerializer(solicitud).data)


class MaquinaViewSet(viewsets.ModelViewSet):
    queryset = Maquina.objects.all()
    serializer_class = MaquinaSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [EsAdmin()]
        return [permissions.IsAuthenticated()]

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def cotizar(self, request, pk=None):
        from datetime import date

        maquina = self.get_object()
        fecha_inicio_str = request.query_params.get('fecha_inicio')
        fecha_fin_str = request.query_params.get('fecha_fin')
        modalidad = request.query_params.get('modalidad', 'RETIRO')

        if not fecha_inicio_str or not fecha_fin_str:
            return Response({'error': 'Faltan fecha_inicio y fecha_fin'}, status=400)

        try:
            fecha_inicio = date.fromisoformat(fecha_inicio_str)
            fecha_fin = date.fromisoformat(fecha_fin_str)
        except ValueError:
            return Response({'error': 'Formato de fecha inválido'}, status=400)

        if fecha_fin < fecha_inicio:
            return Response({'error': 'La fecha de término no puede ser anterior a la de inicio'}, status=400)

        resultado = maquina.calcular_precio(fecha_inicio, fecha_fin, con_despacho=(modalidad == 'DESPACHO'))

        if resultado is None:
            return Response(
                {'error': 'La máquina no tiene configurada la tarifa para esta duración'}, status=400
            )

        return Response(resultado)


class ReservaMaquinaViewSet(viewsets.ModelViewSet):
    serializer_class = ReservaMaquinaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.rol == 'ADMIN':
            qs = ReservaMaquina.objects.all()
            cliente_id = self.request.query_params.get('cliente')
            if cliente_id:
                qs = qs.filter(cliente_id=cliente_id)
            return qs.order_by('-created_at')
        return ReservaMaquina.objects.filter(cliente=user).order_by('-created_at')

    def perform_create(self, serializer):
        fecha_inicio = serializer.validated_data['fecha_inicio']
        fecha_fin = serializer.validated_data['fecha_fin']
        maquina = serializer.validated_data['maquina']
        modalidad = serializer.validated_data.get('modalidad_entrega', 'RETIRO')

        cotizacion = maquina.calcular_precio(fecha_inicio, fecha_fin, con_despacho=(modalidad == 'DESPACHO'))

        extra = {}
        if cotizacion:
            extra = {
                'dias': cotizacion['dias'],
                'tarifa_aplicada': cotizacion['tarifa_aplicada'],
                'precio_neto': cotizacion['precio_neto'],
                'precio_despacho': cotizacion['precio_despacho'],
                'iva': cotizacion['iva'],
                'precio_total': cotizacion['precio_total'],
            }

        reserva = serializer.save(cliente=self.request.user, estado='PENDIENTE', **extra)
        _notificar_reserva_maquina(reserva)

    @action(detail=True, methods=['patch'], permission_classes=[EsAdmin])
    def cambiar_estado(self, request, pk=None):
        reserva = self.get_object()
        nuevo_estado = request.data.get('estado')
        if nuevo_estado not in ['APROBADA', 'RECHAZADA', 'PENDIENTE']:
            return Response({'error': 'Estado inválido'}, status=400)

        estado_anterior = reserva.estado
        reserva.estado = nuevo_estado
        reserva.save()

        if nuevo_estado == 'APROBADA' and estado_anterior != 'APROBADA':
            _notificar_reserva_aprobada(reserva)
        elif nuevo_estado == 'RECHAZADA' and estado_anterior != 'RECHAZADA':
            enviar_push(
                reserva.cliente,
                'Arriendo rechazado',
                f'{reserva.maquina.nombre} — tu solicitud fue rechazada.',
                '/cliente'
            )

        return Response(ReservaMaquinaSerializer(reserva).data)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def marcar_vistas(self, request):
        """El cliente llama esto al entrar a la sección de arriendos, para
        limpiar el contador de aprobaciones pendientes de revisar."""
        ReservaMaquina.objects.filter(
            cliente=request.user, estado='APROBADA', visto=False
        ).update(visto=True)
        return Response({'ok': True})


class ProductoFerreteriaViewSet(viewsets.ModelViewSet):
    serializer_class = ProductoFerreteriaSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = ProductoFerreteria.objects.all()
        user = self.request.user
        # Los clientes solo ven productos activos; el admin ve todo (para poder reactivar)
        if user.rol != 'ADMIN':
            qs = qs.filter(activo=True)
        categoria = self.request.query_params.get('categoria')
        if categoria:
            qs = qs.filter(categoria=categoria)
        return qs

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [EsAdmin()]
        return [permissions.IsAuthenticated()]


class PedidoFerreteriaViewSet(viewsets.ModelViewSet):
    serializer_class = PedidoFerreteriaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.rol == 'ADMIN':
            qs = PedidoFerreteria.objects.all()
            categoria = self.request.query_params.get('categoria')
            if categoria:
                qs = qs.filter(categoria=categoria)
            return qs
        return PedidoFerreteria.objects.filter(cliente=user)

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            return [EsAdmin()]
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def solicitar(self, request):
        user = request.user
        if user.rol != 'CLIENTE':
            return Response({'error': 'No autorizado'}, status=403)

        categoria = request.data.get('categoria')
        if categoria not in [PedidoFerreteria.Categoria.INSUMOS, PedidoFerreteria.Categoria.REPUESTOS]:
            return Response({'error': 'Categoría inválida'}, status=400)

        responsable_id = request.data.get('responsable')
        if not responsable_id:
            return Response({'error': 'Selecciona quién de tu empresa encarga este pedido'}, status=400)
        try:
            responsable = Responsable.objects.get(id=responsable_id, empresa=user.empresa)
        except Responsable.DoesNotExist:
            return Response({'error': 'Responsable inválido'}, status=400)

        centro_costo = (request.data.get('centro_costo') or '').strip()
        if not centro_costo:
            return Response({'error': 'Falta el centro de costo'}, status=400)

        items = request.data.get('items', [])
        if not items:
            return Response({'error': 'El carrito está vacío'}, status=400)

        pedido = PedidoFerreteria.objects.create(
            cliente=user, responsable=responsable, categoria=categoria, centro_costo=centro_costo
        )
        for item in items:
            producto_id = item.get('producto_id') or None
            producto_obj = ProductoFerreteria.objects.filter(id=producto_id).first() if producto_id else None
            ItemPedidoFerreteria.objects.create(
                pedido=pedido,
                producto=producto_obj,
                nombre=item.get('nombre', ''),
                sku=producto_obj.sku if producto_obj else '',
                precio=producto_obj.precio if producto_obj else None,
                cantidad=item.get('cantidad', 1),
            )

        _notificar_pedido_ferreteria(pedido)

        return Response(PedidoFerreteriaSerializer(pedido).data, status=201)

    @action(detail=True, methods=['patch'], permission_classes=[EsAdmin])
    def marcar_revisado(self, request, pk=None):
        pedido = self.get_object()
        pedido.estado = 'REVISADO'
        pedido.save()
        enviar_push(
            pedido.cliente,
            'Pedido revisado',
            f'{pedido.get_categoria_display()} — tu pedido fue revisado.',
            '/cliente'
        )
        return Response(PedidoFerreteriaSerializer(pedido).data)


class ProductoFlexibleViewSet(viewsets.ModelViewSet):
    serializer_class = ProductoFlexibleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = ProductoFlexible.objects.all()
        user = self.request.user
        if user.rol != 'ADMIN':
            qs = qs.filter(activo=True)
        categoria = self.request.query_params.get('categoria')
        if categoria:
            qs = qs.filter(categoria=categoria)
        return qs

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [EsAdmin()]
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=['get'])
    def stock_bajo(self, request):
        productos = ProductoFlexible.objects.filter(stock_actual__lte=models.F('stock_minimo'))
        serializer = self.get_serializer(productos, many=True)
        return Response(serializer.data)

class ProductoGasViewSet(viewsets.ModelViewSet):
    serializer_class = ProductoGasSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = ProductoGas.objects.all()
        if self.request.user.rol != 'ADMIN':
            qs = qs.filter(activo=True)
        return qs

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [EsAdmin()]
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=['get'])
    def stock_bajo(self, request):
        productos = ProductoGas.objects.filter(stock_actual__lte=models.F('stock_minimo'), activo=True)
        serializer = self.get_serializer(productos, many=True)
        return Response(serializer.data)


class PedidoGasViewSet(viewsets.ModelViewSet):
    serializer_class = PedidoGasSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.rol == 'ADMIN':
            return PedidoGas.objects.all()
        return PedidoGas.objects.filter(cliente=user)

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            return [EsAdmin()]
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def solicitar(self, request):
        user = request.user
        if user.rol != 'CLIENTE':
            return Response({'error': 'No autorizado'}, status=403)

        responsable_id = request.data.get('responsable')
        if not responsable_id:
            return Response({'error': 'Selecciona quién de tu empresa encarga este pedido'}, status=400)
        try:
            responsable = Responsable.objects.get(id=responsable_id, empresa=user.empresa)
        except Responsable.DoesNotExist:
            return Response({'error': 'Responsable inválido'}, status=400)

        centro_costo = (request.data.get('centro_costo') or '').strip()
        if not centro_costo:
            return Response({'error': 'Falta el centro de costo'}, status=400)

        items = request.data.get('items', [])
        if not items:
            return Response({'error': 'El carrito está vacío'}, status=400)

        pedido = PedidoGas.objects.create(cliente=user, responsable=responsable, centro_costo=centro_costo)
        for item in items:
            producto_id = item.get('producto_id') or None
            producto_obj = ProductoGas.objects.filter(id=producto_id).first() if producto_id else None
            ItemPedidoGas.objects.create(
                pedido=pedido,
                producto=producto_obj,
                nombre=item.get('nombre', ''),
                precio=producto_obj.precio if producto_obj else None,
                cantidad=item.get('cantidad', 1),
            )

        _notificar_admins_push(
            'Nuevo pedido de Gas Licuado',
            f'{user.empresa.nombre if user.empresa else user.username} — {len(items)} ítem(s)',
            '/admin'
        )

        return Response(PedidoGasSerializer(pedido).data, status=201)

    @action(detail=True, methods=['patch'], permission_classes=[EsAdmin])
    def marcar_revisado(self, request, pk=None):
        pedido = self.get_object()
        if pedido.estado != 'REVISADO':
            for item in pedido.items.all():
                if item.producto:
                    item.producto.stock_actual = max(0, item.producto.stock_actual - item.cantidad)
                    item.producto.save()
            pedido.estado = 'REVISADO'
            pedido.save()
            enviar_push(
                pedido.cliente,
                'Pedido de gas revisado',
                'Tu pedido de Gas Licuado fue revisado.',
                '/cliente'
            )
        return Response(PedidoGasSerializer(pedido).data)

class ResumenPendientesView(APIView):
    """Cuenta de ítems pendientes por sección, para las alertas del panel admin."""
    permission_classes = [EsAdmin]

    def get(self, request):
        maestranza_por_aprobar_o_asignar = TrabajoMaestranza.objects.filter(
            models.Q(aprobado=False) | models.Q(estado='PENDIENTE', asignado_a__isnull=True)
        ).exclude(estado='TERMINADO').count()

        solicitudes_por_revisar = SolicitudMaterial.objects.filter(estado='REVISION').count()

        comentarios_sin_ver = ComentarioTrabajo.objects.filter(visto_admin=False).count()

        return Response({
            'maestranza': maestranza_por_aprobar_o_asignar + solicitudes_por_revisar + comentarios_sin_ver,
            'ferreteria': PedidoFerreteria.objects.filter(
                estado=PedidoFerreteria.Estado.PENDIENTE
            ).count(),
            'flexibles': ProductoFlexible.objects.filter(
                activo=True, stock_actual__lte=models.F('stock_minimo')
            ).count(),
            'maquinas': ReservaMaquina.objects.filter(
                estado=ReservaMaquina.Estado.PENDIENTE
            ).count(),
            'compras': SolicitudMaterial.objects.filter(
                estado='PENDIENTE'
            ).count(),
        })

class ResumenClienteView(APIView):
    """
    Cuenta de pendientes por revisar para el cliente logueado, usada para
    las alertas numéricas en los banners de la pantalla de inicio:
      - maestranza: trabajos TERMINADOS a los que aún no eligió retiro/despacho
      - arriendos: reservas APROBADAS que todavía no ha visto
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.rol != 'CLIENTE':
            return Response({'maestranza': 0, 'arriendos': 0})

        maestranza = TrabajoMaestranza.objects.filter(
            cliente=user, estado='TERMINADO', modalidad_entrega__isnull=True
        ).count()

        arriendos = ReservaMaquina.objects.filter(
            cliente=user, estado='APROBADA', visto=False
        ).count()

        return Response({'maestranza': maestranza, 'arriendos': arriendos})

class CotizacionViewSet(viewsets.ModelViewSet):
    serializer_class = CotizacionSerializer
    permission_classes = [EsAdmin]

    def get_queryset(self):
        return Cotizacion.objects.select_related('trabajo', 'empresa').all()

    def perform_create(self, serializer):
        trabajo = serializer.validated_data.get('trabajo')
        empresa = serializer.validated_data.get('empresa')
        # Si no se mandó empresa explícita (caso normal: cotización desde
        # un trabajo), se deriva de la empresa del cliente del trabajo.
        if not empresa and trabajo and trabajo.cliente:
            empresa = trabajo.cliente.empresa
        serializer.save(empresa=empresa, creado_por=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[EsAdmin])
    def enviar_correo(self, request, pk=None):
        cotizacion = self.get_object()

        pdf_base64 = request.data.get('pdf_base64')
        if not pdf_base64:
            return Response({'error': 'Falta el PDF de la cotización'}, status=400)

        # Prioridad: si tiene empresa registrada, usa su email. Si no,
        # usa el email de contacto puntual (persona sin empresa).
        empresa = cotizacion.empresa
        if empresa and empresa.email:
            email_destino = empresa.email
        elif cotizacion.cliente_email:
            email_destino = cotizacion.cliente_email
        else:
            return Response(
                {'error': 'No hay un email de destino cargado para esta cotización.'},
                status=400,
            )

        try:
            if ',' in pdf_base64:
                pdf_base64 = pdf_base64.split(',', 1)[1]
            pdf_bytes = base64.b64decode(pdf_base64)
        except Exception:
            return Response({'error': 'El PDF recibido no es válido'}, status=400)

        destinatarios = [email_destino, FACTURACION_EMAIL]
        nombre_destino = empresa.nombre if empresa else cotizacion.mandante
        total_fmt = f'${cotizacion.total:,.0f}'.replace(',', '.')

        texto_plano = (
            f'Hola,\n\n'
            f'Te compartimos la cotización folio {cotizacion.folio}'
            + (f' para la obra "{cotizacion.obra}"' if cotizacion.obra else '') + '.\n\n'
            f'Total: {total_fmt} (IVA incluido)\n\n'
            f'Encuentras el detalle completo en el PDF adjunto.\n\n'
            f'Ararat Estructuras Metálicas'
        )

        celda_borde = 'padding:8px 12px; border:1px solid #d1d5db; text-align:left;'
        html = f'''
        <html>
        <body style="margin:0; padding:0; background-color:#f3f4f6; font-family: Arial, Helvetica, sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6; padding:24px 0;">
            <tr>
              <td align="center">
                <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="background-color:#0f0f0f; padding:18px 24px;">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="vertical-align:middle; padding-right:12px;">
                            <img src="{LOGO_URL}" alt="Ararat" height="48" style="display:block; height:48px; width:auto;">
                          </td>
                          <td style="vertical-align:middle;">
                            <span style="color:#ffffff; font-size:16px; font-weight:bold;">COTIZACIÓN {cotizacion.folio}</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color:#be1e1e; height:4px; font-size:0; line-height:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="padding:24px;">
                      <p style="margin:0 0 16px 0; font-size:15px; color:#111827;">
                        Te compartimos la cotización solicitada{f' para la obra <strong>{cotizacion.obra}</strong>' if cotizacion.obra else ''}.
                      </p>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin:0 0 16px 0;">
                        <tr><td style="{celda_borde} font-weight:bold; width:40%;">Empresa</td><td style="{celda_borde}">{nombre_empresa}</td></tr>
                        <tr><td style="{celda_borde} font-weight:bold;">Folio</td><td style="{celda_borde}">{cotizacion.folio}</td></tr>
                        <tr><td style="{celda_borde} font-weight:bold;">Total (IVA incluido)</td><td style="{celda_borde} font-weight:bold;">{total_fmt}</td></tr>
                      </table>
                      <p style="margin:0; font-size:13px; color:#6b7280;">
                        El detalle completo va en el PDF adjunto a este correo.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color:#f9fafb; padding:16px 24px; border-top:1px solid #e5e7eb;">
                      <p style="margin:0; font-size:12px; color:#9ca3af;">
                        Ararat Estructuras Metálicas SPA &middot; La Rinconada de Huelquén Sitio 4 Lote B, Paine<br>
                        Este es un correo automático, no es necesario responderlo.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
        '''

        try:
            email = EmailMultiAlternatives(
                subject=f'Cotización {cotizacion.folio} — Ararat',
                body=texto_plano,
                from_email=None,
                to=destinatarios,
            )
            email.attach_alternative(html, 'text/html')
            email.attach(f'cotizacion_{cotizacion.folio}.pdf', pdf_bytes, 'application/pdf')
            email.send(fail_silently=False)
        except Exception as e:
            return Response({'error': f'No se pudo enviar el correo: {e}'}, status=500)

        return Response({'ok': True})

class TareaAgendaViewSet(viewsets.ModelViewSet):
    serializer_class = TareaAgendaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.rol == 'ADMIN':
            qs = TareaAgenda.objects.all()
        elif user.rol == 'TRABAJADOR':
            qs = TareaAgenda.objects.filter(asignado_a=user)
        else:
            return TareaAgenda.objects.none()

        mes = self.request.query_params.get('mes')  # formato "YYYY-MM"
        if mes and '-' in mes:
            anio_str, mes_str = mes.split('-')
            try:
                qs = qs.filter(fecha__year=int(anio_str), fecha__month=int(mes_str))
            except ValueError:
                pass
        return qs

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [EsAdmin()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        tarea = serializer.save(creado_por=self.request.user)
        if tarea.asignado_a:
            enviar_push(
                tarea.asignado_a,
                'Nueva tarea en tu agenda',
                f'{tarea.titulo} — {tarea.fecha.strftime("%d/%m/%Y")}',
                '/trabajador'
            )

    @action(detail=True, methods=['patch'], permission_classes=[permissions.IsAuthenticated])
    def marcar_completada(self, request, pk=None):
        tarea = self.get_object()
        user = request.user
        if user.rol != 'ADMIN' and tarea.asignado_a_id != user.id:
            return Response({'error': 'No autorizado'}, status=403)
        tarea.completada = not tarea.completada
        tarea.save()
        return Response(TareaAgendaSerializer(tarea).data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def guardar_push_subscription(request):
    endpoint = request.data.get('endpoint')
    keys = request.data.get('keys', {})
    p256dh = keys.get('p256dh')
    auth = keys.get('auth')

    if not endpoint or not p256dh or not auth:
        return Response({'error': 'Datos de suscripción incompletos'}, status=400)

    # update_or_create evita duplicados si el mismo dispositivo se re-suscribe
    PushSubscription.objects.update_or_create(
        endpoint=endpoint,
        defaults={
            'usuario': request.user,
            'p256dh': p256dh,
            'auth': auth,
        }
    )
    return Response({'status': 'ok'})