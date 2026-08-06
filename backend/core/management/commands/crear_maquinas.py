from django.core.management.base import BaseCommand, CommandError
from core.models import Maquina


# Descripción por defecto para las máquinas autocargables A4B 20.
# Se usa automáticamente si no pasás --descripcion al correr el comando.
DESCRIPCION_AUTOCARGABLE_A4B_20 = (
    "- Autocargable Reforzado\n"
    "- Capacidad 4 Bins\n"
    "- Incluye 1 Neumatico de Repuesto\n"
    "- Sistema Hidraulico Doble Seguridad\n"
    "- Sistema de Lubricacion En Balancin, Masa\n"
    "- Sistema de Lubricacion En Transmision Cadena"
)


class Command(BaseCommand):
    help = (
        'Crea varias máquinas iguales de una vez (mismo nombre base numerado '
        'correlativamente con guión, ej: "Autocargable A4B 20-1", '
        '"Autocargable A4B 20-2", etc.), misma descripción y precios. Útil '
        'para cargar lotes de maquinaria idéntica sin pasar una por una por '
        'el formulario del panel admin. Después se entra al panel a subirle '
        'la foto a cada una individualmente.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--nombre-base', type=str, required=True,
            help='Ej: "Autocargable A4B 20" -> genera "Autocargable A4B 20-1", "...-2", ...'
        )
        parser.add_argument('--cantidad', type=int, required=True)
        parser.add_argument(
            '--descripcion', type=str, default=DESCRIPCION_AUTOCARGABLE_A4B_20,
            help='Misma descripción para todas. Si no se pasa, usa la descripción '
                 'por defecto del autocargable A4B 20 (con viñetas por guión).'
        )
        parser.add_argument('--precio-dia', type=str, default=None)
        parser.add_argument('--precio-semana', type=str, default=None)
        parser.add_argument('--precio-mes', type=str, default=None)
        parser.add_argument('--precio-despacho', type=str, default=None)
        parser.add_argument(
            '--desde', type=int, default=1,
            help='Número inicial del correlativo en el nombre (por defecto arranca en 1)'
        )
        parser.add_argument(
            '--inactivas', action='store_true',
            help='Crearlas como inactivas (no visibles para clientes) en vez de activas por defecto. '
                 'Útil si querés subirles la foto antes de que se vean en el catálogo.'
        )

    def handle(self, *args, **options):
        nombre_base = options['nombre_base']
        cantidad = options['cantidad']
        descripcion = options['descripcion']
        desde = options['desde']

        if cantidad <= 0:
            raise CommandError('La cantidad debe ser mayor a 0')

        creadas = []
        for i in range(desde, desde + cantidad):
            maquina = Maquina.objects.create(
                nombre=f'{nombre_base}-{i}',
                descripcion=descripcion,
                precio_dia=options['precio_dia'] or None,
                precio_semana=options['precio_semana'] or None,
                precio_mes=options['precio_mes'] or None,
                precio_despacho=options['precio_despacho'] or None,
                activo=not options['inactivas'],
            )
            creadas.append(maquina)

        self.stdout.write(self.style.SUCCESS(
            f'Se crearon {len(creadas)} máquinas: '
            + ', '.join(m.nombre for m in creadas)
        ))