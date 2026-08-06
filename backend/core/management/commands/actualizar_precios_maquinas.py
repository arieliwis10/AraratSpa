from django.core.management.base import BaseCommand, CommandError
from core.models import Maquina


class Command(BaseCommand):
    help = (
        'Actualiza los precios (día/semana/mes/despacho) de todas las máquinas '
        'cuyo nombre empieza con el prefijo indicado, SIN crear duplicados. '
        'Pensado para usar junto con crear_maquinas: primero se crea el lote '
        'con crear_maquinas, y si después hay que corregir un precio para todo '
        'el lote, se usa este comando en vez de volver a correr crear_maquinas '
        '(que crearía máquinas nuevas en vez de editar las existentes).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--nombre-base', type=str, required=True,
            help='El mismo --nombre-base que usaste al crearlas con crear_maquinas '
                 '(guion bajo en vez de espacio si lo corres desde cPanel). '
                 'Ej: Autocargable_A4B_20 actualiza todas las que empiecen '
                 'con "Autocargable A4B 20-".'
        )
        parser.add_argument('--precio-dia', type=str, default=None)
        parser.add_argument('--precio-semana', type=str, default=None)
        parser.add_argument('--precio-mes', type=str, default=None)
        parser.add_argument('--precio-despacho', type=str, default=None)

    def handle(self, *args, **options):
        prefijo = options['nombre_base'].replace('_', ' ')
        qs = Maquina.objects.filter(nombre__startswith=f'{prefijo}-')

        if not qs.exists():
            raise CommandError(
                f'No se encontró ninguna máquina cuyo nombre empiece con "{prefijo}-". '
                f'Revisa que --nombre-base sea igual al que usaste en crear_maquinas.'
            )

        cambios = {}
        if options['precio_dia'] is not None:
            cambios['precio_dia'] = options['precio_dia']
        if options['precio_semana'] is not None:
            cambios['precio_semana'] = options['precio_semana']
        if options['precio_mes'] is not None:
            cambios['precio_mes'] = options['precio_mes']
        if options['precio_despacho'] is not None:
            cambios['precio_despacho'] = options['precio_despacho']

        if not cambios:
            raise CommandError(
                'No pasaste ningún precio para actualizar '
                '(--precio-dia, --precio-semana, --precio-mes, --precio-despacho)'
            )

        actualizadas = qs.update(**cambios)
        self.stdout.write(self.style.SUCCESS(
            f'Se actualizaron {actualizadas} máquinas que empiezan con "{prefijo}-".'
        ))


# manage.py actualizar_precios_maquinas --nombre-base Autocargable_A4B_20 --precio-dia 45000
# manage.py actualizar_precios_maquinas --nombre-base Autocargable_A4B_20 --precio-dia 45000 --precio-semana 180000 --precio-mes 600000

# manage.py actualizar_precios_maquinas --nombre-base Grua Horquilla G2.5T_10 --precio-dia 60000
# manage.py actualizar_precios_maquinas --nombre-base Grua Horquilla G2.5T_10 --precio-dia 60000 --precio-semana 220000 --precio-mes 800000