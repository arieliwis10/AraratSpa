from django.core.management.base import BaseCommand
from core.models import Maquina, CategoriaMaquina

# Mapeo de los valores viejos (hardcodeados en el código) a los nombres
# reales que van a quedar como filas en la tabla CategoriaMaquina.
MAPEO = {
    'AUTOCARGABLE': 'Autocargable',
    'GRUA_HORQUILLA': 'Grúa Horquilla',
}


class Command(BaseCommand):
    help = (
        'Migra las máquinas del campo categoria viejo (texto fijo, '
        'AUTOCARGABLE/GRUA_HORQUILLA) al nuevo modelo CategoriaMaquina '
        '(FK dinámica). Correr una sola vez, después de aplicar la '
        'migración que agrega el campo categoria_fk.'
    )

    def handle(self, *args, **options):
        categorias = {}
        for clave, nombre in MAPEO.items():
            cat, creada = CategoriaMaquina.objects.get_or_create(nombre=nombre)
            categorias[clave] = cat
            if creada:
                self.stdout.write(self.style.SUCCESS(f'Categoría creada: {nombre}'))
            else:
                self.stdout.write(f'Categoría ya existía: {nombre}')

        actualizadas = 0
        for m in Maquina.objects.exclude(categoria=''):
            cat = categorias.get(m.categoria)
            if cat:
                m.categoria_fk = cat
                m.save(update_fields=['categoria_fk'])
                actualizadas += 1

        self.stdout.write(self.style.SUCCESS(
            f'Se migraron {actualizadas} máquinas a la nueva categoría dinámica.'
        ))