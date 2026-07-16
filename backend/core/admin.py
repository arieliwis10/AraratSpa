from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    Usuario, Empresa, Responsable, TrabajoMaestranza, MaterialUsado,
    SolicitudMaterial, Maquina, ReservaMaquina
)


class UsuarioAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('Información adicional', {'fields': ('rol', 'telefono', 'empresa')}),
    )
    list_display = ('username', 'email', 'rol', 'empresa', 'is_active')
    list_filter = ('rol', 'empresa')


admin.site.register(Usuario, UsuarioAdmin)
admin.site.register(Empresa)
admin.site.register(Responsable)
admin.site.register(TrabajoMaestranza)
admin.site.register(MaterialUsado)
admin.site.register(SolicitudMaterial)
admin.site.register(Maquina)
admin.site.register(ReservaMaquina)