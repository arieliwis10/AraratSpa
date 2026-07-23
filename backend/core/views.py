from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.core.mail import EmailMultiAlternatives
from .models import (
    Usuario, Empresa, Responsable, TrabajoMaestranza, MaterialUsado,
    ComentarioTrabajo, SolicitudMaterial, Maquina, ReservaMaquina, ProductoFerreteria,
    PedidoFerreteria, ItemPedidoFerreteria
)
from .serializers import (
    UsuarioSerializer, UsuarioCreateSerializer, EmpresaSerializer, ResponsableSerializer,
    TrabajoMaestranzaSerializer, MaterialUsadoSerializer, ComentarioTrabajoSerializer,
    SolicitudMaterialSerializer, MaquinaSerializer, ReservaMaquinaSerializer,
    ProductoFerreteriaSerializer, PedidoFerreteriaSerializer
)


class EsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.rol == 'ADMIN'


# URL pública donde queda alojado el logo (reemplaza por la ruta real una vez que lo subas)
LOGO_URL = 'https://araratchile.com/wp-content/uploads/2023/02/Logos-16-1536x521.png'

# Ferretería Industrial (INSUMOS): destinatarios específicos.
# El "reply_to" es la cuenta a la que le debe llegar si el destinatario responde el correo.
FERRETERIA_INSUMOS_FROM_EMAIL = 'soldadurasararat@gmail.com'  # usado como reply_to
FERRETERIA_INSUMOS_JEFE_EMAIL = 'ventasapp@araratchile.com'
FERRETERIA_INSUMOS_VENDEDOR_EMAIL = 'ariel_18gol@hotmail.com'

# Repuestos industriales (REPUESTOS): destinatario (como estaba)
REPUESTOS_FROM_EMAIL = 'soldadurasararat@gmail.com'  # usado como reply_to
REPUESTOS_JEFE_EMAIL = 'ventasapp@araratchile.com'


def _notificar_responsables(trabajo):
    """
    Envía un correo (HTML + texto plano) al email de la empresa y a todos
    los responsables de la empresa del cliente cuando un trabajo se marca
    como Terminado. Si algo falla (SMTP caído, sin destinatarios, etc.) no
    bloquea el flujo del trabajo.
    """
    empresa = trabajo.cliente.empresa if trabajo.cliente else None
    if not empresa:
        return

    destinatarios = set()

    if empresa.email:
        destinatarios.add(empresa.email)

    responsables_con_email = empresa.responsables.exclude(email__isnull=True).exclude(email='')
    for r in responsables_con_email:
        destinatarios.add(r.email)

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
            f'<td style="{celda_borde}">{item.sku or "-"}</td>'
            f'<td style="{celda_borde}">{item.cantidad}</td>'
            f'<td style="{celda_borde}">${(item.precio or 0):,.0f}</td>'
            f'</tr>'.replace(',', '.')
            for item in items
        )
        encabezados_html = (
            f'<td style="{encabezado_borde}">Producto</td>'
            f'<td style="{encabezado_borde}">SKU</td>'
            f'<td style="{encabezado_borde}">Cantidad</td>'
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
        serializer.save(cliente=self.request.user)

    def _puede_operar(self, request, trabajo):
        return request.user.rol == 'ADMIN' or trabajo.asignado_a_id == request.user.id

    @action(detail=True, methods=['patch'], permission_classes=[EsAdmin])
    def aprobar(self, request, pk=None):
        trabajo = self.get_object()
        trabajo.aprobado = True
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
            trabajo.avance = request.data['avance']
        if 'tiempo_entrega' in request.data:
            trabajo.tiempo_entrega = request.data['tiempo_entrega'] or None

        trabajo.save()
        return Response(TrabajoMaestranzaSerializer(trabajo).data)

    @action(detail=True, methods=['patch'], permission_classes=[permissions.IsAuthenticated])
    def marcar_completado(self, request, pk=None):
        trabajo = self.get_object()
        if not self._puede_operar(request, trabajo):
            return Response({'error': 'No autorizado'}, status=403)
        trabajo.estado = 'TERMINADO'
        trabajo.avance = 100
        trabajo.save()
        _notificar_responsables(trabajo)
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

        ComentarioTrabajo.objects.create(
            trabajo=trabajo, autor=user, responsable=responsable_obj, mensaje=mensaje
        )
        return Response(TrabajoMaestranzaSerializer(trabajo).data)


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
        return Response(PedidoFerreteriaSerializer(pedido).data)


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
        serializer.save(cliente=self.request.user, estado='PENDIENTE')

    @action(detail=True, methods=['patch'], permission_classes=[EsAdmin])
    def cambiar_estado(self, request, pk=None):
        reserva = self.get_object()
        nuevo_estado = request.data.get('estado')
        if nuevo_estado not in ['APROBADA', 'RECHAZADA', 'PENDIENTE']:
            return Response({'error': 'Estado inválido'}, status=400)
        reserva.estado = nuevo_estado
        reserva.save()
        return Response(ReservaMaquinaSerializer(reserva).data)