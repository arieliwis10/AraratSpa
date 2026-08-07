from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    UsuarioViewSet, EmpresaViewSet, ResponsableViewSet, TrabajoMaestranzaViewSet,
    MaquinaViewSet, ReservaMaquinaViewSet, SolicitudMaterialViewSet,
    ProductoFerreteriaViewSet, PedidoFerreteriaViewSet, ProductoFlexibleViewSet, ProductoGasViewSet, PedidoGasViewSet,
    ResumenPendientesView, ResumenClienteView, CotizacionViewSet, TareaAgendaViewSet, guardar_push_subscription, CategoriaMaquinaViewSet
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
router.register(r'productos-flexibles', ProductoFlexibleViewSet, basename='productos-flexibles')
router.register(r'productos-gas', ProductoGasViewSet, basename='producto-gas')
router.register(r'pedidos-gas', PedidoGasViewSet, basename='pedido-gas')
router.register(r'cotizaciones', CotizacionViewSet, basename='cotizacion')
router.register(r'tareas-agenda', TareaAgendaViewSet, basename='tarea-agenda')
router.register(r'categorias-maquinas', CategoriaMaquinaViewSet)


urlpatterns = router.urls + [
    path('resumen-pendientes/', ResumenPendientesView.as_view(), name='resumen-pendientes'),
    path('resumen-cliente/', ResumenClienteView.as_view(), name='resumen-cliente'),
    path('push-subscription/', guardar_push_subscription, name='push-subscription'),
]