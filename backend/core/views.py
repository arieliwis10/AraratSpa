from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.core.mail import EmailMultiAlternatives
from .models import (
    Usuario, Empresa, Responsable, TrabajoMaestranza, MaterialUsado,
    ComentarioTrabajo, SolicitudMaterial, Maquina, ReservaMaquina
)
from .serializers import (
    UsuarioSerializer, UsuarioCreateSerializer, EmpresaSerializer, ResponsableSerializer,
    TrabajoMaestranzaSerializer, MaterialUsadoSerializer, ComentarioTrabajoSerializer,
    SolicitudMaterialSerializer, MaquinaSerializer, ReservaMaquinaSerializer
)


class EsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.rol == 'ADMIN'



# URL pública donde queda alojado el logo (reemplaza por la ruta real una vez que lo subas)
LOGO_URL = 'https://araratchile.com/wp-content/uploads/2023/02/Logos-16-1536x521.png'


def _notificar_responsables(trabajo):
    """
    Envía un correo (HTML + texto plano) a todos los responsables de la
    empresa del cliente cuando un trabajo se marca como Terminado. Si algo
    falla (SMTP caído, sin responsables con email, etc.) no bloquea el
    flujo del trabajo.
    """
    empresa = trabajo.cliente.empresa if trabajo.cliente else None
    if not empresa:
        return

    responsables_con_email = empresa.responsables.exclude(email__isnull=True).exclude(email='')
    if not responsables_con_email.exists():
        return

    destinatarios = [r.email for r in responsables_con_email]

    categoria = trabajo.get_categoria_display()
    asunto = f'Trabajo #{trabajo.correlativo} completado — Ararat'

    texto_plano = (
        f'Hola,\n\n'
        f'El trabajo "{categoria}" #{trabajo.correlativo} de {empresa.nombre} ya está terminado.\n\n'
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
                  <p style="margin:0 0 16px 0; font-size:15px; color:#111827;">Hola,</p>
                  <p style="margin:0 0 20px 0; font-size:15px; color:#111827; line-height:1.5;">
                    El siguiente trabajo ya está <strong>terminado</strong>:
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
                    Ingresa al sistema para elegir cómo quieres recibirlo (retiro en local o delivery).
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