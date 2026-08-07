from django.core.management.base import BaseCommand, CommandError
from core.models import Maquina, CategoriaMaquina


class Command(BaseCommand):
    help = (
        'Asigna una categoría (dinámica, se crea si no existe) a todas las '
        'máquinas cuyo nombre empieza con el prefijo indicado, sin crear ni '
        'eliminar nada.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--nombre-base', type=str, required=True,
            help='Prefijo a buscar (guion bajo en vez de espacio). '
                 'Ej: Autocargable_A4B_20 busca las que empiezan con "Autocargable A4B 20-"'
        )
        parser.add_argument(
            '--categoria', type=str, required=True,
            help='Nombre de la categoría (guion bajo en vez de espacio). Si no '
                 'existe todavía, se crea automáticamente.'
        )

    def handle(self, *args, **options):
        prefijo = options['nombre_base'].replace('_', ' ')
        categoria_nombre = options['categoria'].replace('_', ' ')

        categoria, creada = CategoriaMaquina.objects.get_or_create(nombre=categoria_nombre)
        if creada:
            self.stdout.write(self.style.SUCCESS(f'Categoría nueva creada: "{categoria_nombre}"'))

        qs = Maquina.objects.filter(nombre__startswith=f'{prefijo}-')

        if not qs.exists():
            raise CommandError(
                f'No se encontró ninguna máquina cuyo nombre empiece con "{prefijo}-". '
                f'Revisa que --nombre-base sea igual al nombre real guardado.'
            )

        actualizadas = qs.update(categoria_fk=categoria)
        self.stdout.write(self.style.SUCCESS(
            f'Se asignó la categoría "{categoria_nombre}" a {actualizadas} máquinas '
            f'que empiezan con "{prefijo}-".'
        ))


# ---------------------------------------------------------------------------
# EJEMPLOS DE USO
#
# Autocargables:
# manage.py asignar_categoria_maquinas --nombre-base Autocargable_A4B_20 --categoria Autocargable
#
# Grúas horquilla:
# manage.py asignar_categoria_maquinas --nombre-base Grua_Horquilla_G2.5T_15 --categoria Grua_Horquilla
# ---------------------------------------------------------------------------