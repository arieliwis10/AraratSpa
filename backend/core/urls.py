from rest_framework.routers import DefaultRouter
from .views import (
    UsuarioViewSet, EmpresaViewSet, ResponsableViewSet, TrabajoMaestranzaViewSet,
    MaquinaViewSet, ReservaMaquinaViewSet, SolicitudMaterialViewSet,
    ProductoFerreteriaViewSet, PedidoFerreteriaViewSet
)

router = DefaultRouter()
router.register('usuarios', UsuarioViewSet)
router.register('empresas', EmpresaViewSet)
router.register('responsables', ResponsableViewSet, basename='responsable')
router.register('trabajos-maestranza', TrabajoMaestranzaViewSet, basename='trabajo-maestranza')
router.register('maquinas', MaquinaViewSet)
router.register('reservas-maquinas', ReservaMaquinaViewSet, basename='reserva-maquina')
router.register('solicitudes-material', SolicitudMaterialViewSet, basename='solicitud-material')
router.register('productos-ferreteria', ProductoFerreteriaViewSet, basename='producto-ferreteria')
router.register('pedidos-ferreteria', PedidoFerreteriaViewSet, basename='pedido-ferreteria')

urlpatterns = router.urls