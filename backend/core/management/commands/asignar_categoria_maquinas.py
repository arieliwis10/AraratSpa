from django.core.management.base import BaseCommand, CommandError
from core.models import Maquina


class Command(BaseCommand):
    help = (
        'Asigna una categoría a todas las máquinas cuyo nombre empieza con el '
        'prefijo indicado, sin crear ni eliminar nada. Pensado para categorizar '
        'lotes que ya existían antes de agregar el campo categoría al sistema.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--nombre-base', type=str, required=True,
            help='Prefijo a buscar (guion bajo en vez de espacio). '
                 'Ej: Autocargable_A4B_20 busca las que empiezan con "Autocargable A4B 20-"'
        )
        parser.add_argument(
            '--categoria', type=str, required=True,
            choices=['AUTOCARGABLE', 'GRUA_HORQUILLA'],
        )

    def handle(self, *args, **options):
        prefijo = options['nombre_base'].replace('_', ' ')
        categoria = options['categoria']

        qs = Maquina.objects.filter(nombre__startswith=f'{prefijo}-')

        if not qs.exists():
            raise CommandError(
                f'No se encontró ninguna máquina cuyo nombre empiece con "{prefijo}-". '
                f'Revisa que --nombre-base sea igual al nombre real guardado.'
            )

        actualizadas = qs.update(categoria=categoria)
        self.stdout.write(self.style.SUCCESS(
            f'Se asignó la categoría "{categoria}" a {actualizadas} máquinas '
            f'que empiezan con "{prefijo}-".'
        ))


# manage.py asignar_categoria_maquinas --nombre-base Autocargable_A4B_20 --categoria AUTOCARGABLE

# manage.py asignar_categoria_maquinas --nombre-base G2.5T_10 --categoria GRUA_HORQUILLA