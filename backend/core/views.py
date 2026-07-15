from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .models import Usuario, TrabajoMaestranza, MaterialUsado, Maquina, ReservaMaquina
from .serializers import (
    UsuarioSerializer, UsuarioCreateSerializer,
    TrabajoMaestranzaSerializer, MaterialUsadoSerializer,
    MaquinaSerializer, ReservaMaquinaSerializer
)


class EsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.rol == 'ADMIN'


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
        # Editar/eliminar el registro completo (incluye asignar trabajador) es solo del admin
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
        """Para admin O el trabajador asignado: solo estado, avance y tiempo de entrega."""
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

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def agregar_material(self, request, pk=None):
        trabajo = self.get_object()
        if not self._puede_operar(request, trabajo):
            return Response({'error': 'No autorizado'}, status=403)
        serializer = MaterialUsadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(trabajo=trabajo)
        return Response(TrabajoMaestranzaSerializer(trabajo).data)


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