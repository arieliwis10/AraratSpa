from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Usuario, TrabajoMaestranza, MaterialUsado, Maquina, ReservaMaquina


class UsuarioAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('Información adicional', {'fields': ('rol', 'telefono')}),
    )
    list_display = ('username', 'email', 'rol', 'is_active')
    list_filter = ('rol',)


admin.site.register(Usuario, UsuarioAdmin)
admin.site.register(TrabajoMaestranza)
admin.site.register(MaterialUsado)
admin.site.register(Maquina)
admin.site.register(ReservaMaquina)