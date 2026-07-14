from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
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
        if self.action == 'create':
            return UsuarioCreateSerializer
        return UsuarioSerializer

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        serializer = UsuarioSerializer(request.user)
        return Response(serializer.data)


class TrabajoMaestranzaViewSet(viewsets.ModelViewSet):
    serializer_class = TrabajoMaestranzaSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

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

    def perform_create(self, serializer):
        serializer.save(cliente=self.request.user)

    @action(detail=True, methods=['patch'], permission_classes=[EsAdmin])
    def aprobar(self, request, pk=None):
        trabajo = self.get_object()
        trabajo.aprobado = True
        trabajo.save()
        return Response(TrabajoMaestranzaSerializer(trabajo).data)

    @action(detail=True, methods=['post'], permission_classes=[EsAdmin])
    def agregar_material(self, request, pk=None):
        trabajo = self.get_object()
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