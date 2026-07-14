from rest_framework.routers import DefaultRouter
from .views import UsuarioViewSet, TrabajoMaestranzaViewSet, MaquinaViewSet, ReservaMaquinaViewSet

router = DefaultRouter()
router.register('usuarios', UsuarioViewSet)
router.register('trabajos-maestranza', TrabajoMaestranzaViewSet, basename='trabajo-maestranza')
router.register('maquinas', MaquinaViewSet)
router.register('reservas-maquinas', ReservaMaquinaViewSet, basename='reserva-maquina')

urlpatterns = router.urls