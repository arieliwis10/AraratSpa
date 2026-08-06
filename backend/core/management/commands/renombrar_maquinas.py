from django.core.management.base import BaseCommand, CommandError
from core.models import Maquina


class Command(BaseCommand):
    help = (
        'Renombra el prefijo de un lote de máquinas creado con crear_maquinas, '
        'manteniendo el número final (el "-N" de cada una). Útil para corregir '
        'un typo o cambiar el formato del nombre base sin tener que editar '
        'máquina por máquina desde el panel admin.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--nombre-actual', type=str, required=True,
            help='Prefijo actual, tal como está guardado (guion bajo en vez de '
                 'espacio si lo corres desde cPanel). Ej: Autocargable_A4B_20'
        )
        parser.add_argument(
            '--nombre-nuevo', type=str, required=True,
            help='Prefijo nuevo (guion bajo en vez de espacio). Ej: Autocargable_A4B20'
        )

    def handle(self, *args, **options):
        prefijo_actual = options['nombre_actual'].replace('_', ' ')
        prefijo_nuevo = options['nombre_nuevo'].replace('_', ' ')

        maquinas = Maquina.objects.filter(nombre__startswith=f'{prefijo_actual}-')

        if not maquinas.exists():
            raise CommandError(
                f'No se encontró ninguna máquina cuyo nombre empiece con "{prefijo_actual}-". '
                f'Revisa que --nombre-actual sea igual al que usaste en crear_maquinas.'
            )

        actualizadas = 0
        for m in maquinas:
            sufijo = m.nombre[len(prefijo_actual):]  # incluye el "-N" del final
            m.nombre = f'{prefijo_nuevo}{sufijo}'
            m.save(update_fields=['nombre'])
            actualizadas += 1

        self.stdout.write(self.style.SUCCESS(
            f'Se renombraron {actualizadas} máquinas: '
            f'"{prefijo_actual}-N" -> "{prefijo_nuevo}-N"'
        ))

# manage.py renombrar_maquinas --nombre-actual G2.5T_10 --nombre-nuevo Grua Horquilla G2.5T_10