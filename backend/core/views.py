from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
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
            cliente_id = self.request.query_params.get('cliente')
            if cliente_id:
                qs = qs.filter(cliente_id=cliente_id)
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
            return SolicitudMaterial.objects.filter(trabajo__asignado_a=user).order_by('-created_at')
        return SolicitudMaterial.objects.none()

    def _resolver(self, solicitud, lugar_compra=''):
        from django.utils import timezone
        solicitud.estado = 'RECIBIDO'
        solicitud.lugar_compra = lugar_compra
        solicitud.resuelto_en = timezone.now()
        solicitud.save()
        solicitud.trabajo.retrasado = False
        solicitud.trabajo.save()

    @action(detail=True, methods=['patch'], permission_classes=[permissions.IsAuthenticated])
    def hay_en_bodega(self, request, pk=None):
        solicitud = self.get_object()
        user = request.user
        if user.rol != 'ADMIN' and solicitud.trabajo.asignado_a_id != user.id:
            return Response({'error': 'No autorizado'}, status=403)
        self._resolver(solicitud, lugar_compra='Bodega propia')
        return Response(SolicitudMaterialSerializer(solicitud).data)

    @action(detail=True, methods=['patch'], permission_classes=[EsAdmin])
    def enviar_a_compras(self, request, pk=None):
        solicitud = self.get_object()
        solicitud.estado = 'PENDIENTE'
        solicitud.save()
        return Response(SolicitudMaterialSerializer(solicitud).data)

    @action(detail=True, methods=['patch'], permission_classes=[EsAdmin])
    def marcar_recibido(self, request, pk=None):
        solicitud = self.get_object()
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