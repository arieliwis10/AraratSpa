from django.core.management.base import BaseCommand, CommandError
from core.models import Maquina


class Command(BaseCommand):
    help = (
        'Crea varias máquinas iguales de una vez (mismo nombre base numerado '
        'correlativamente con guión, ej: "G2.5T 10-80", "G2.5T 10-81", etc.), '
        'misma descripción y precios. Útil para cargar lotes de maquinaria '
        'idéntica sin pasar una por una por el formulario del panel admin. '
        'Después se entra al panel a subirle la foto a cada una individualmente.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--nombre-base', type=str, required=True,
            help='Ej: "G2.5T 10" -> genera "G2.5T 10-80", "G2.5T 10-81", ...'
        )
        parser.add_argument('--cantidad', type=int, required=True)
        parser.add_argument(
            '--descripcion', type=str, default='',
            help='Misma descripción para todas, pasada directo por línea de comandos. '
                 'Si tiene tildes, paréntesis o comillas, mejor usar --descripcion-file.'
        )
        parser.add_argument(
            '--descripcion-file', type=str, default=None,
            help='Ruta a un archivo .txt con la descripción (una línea por punto, '
                 'con guion "-" o asterisco "*" al inicio). Evita problemas de '
                 'tildes/comillas/paréntesis que puede tener escribirla directo '
                 'en la terminal o en el campo de cPanel. Si se pasa, tiene '
                 'prioridad sobre --descripcion.'
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

        if options['descripcion_file']:
            try:
                with open(options['descripcion_file'], encoding='utf-8') as f:
                    descripcion = f.read().strip()
            except FileNotFoundError:
                raise CommandError(
                    f"No se encontró el archivo '{options['descripcion_file']}'. "
                    f"Verifica la ruta (relativa a donde estás parado al correr el comando, "
                    f"normalmente la carpeta del proyecto donde está manage.py)."
                )

        if not descripcion:
            raise CommandError(
                'Falta la descripción. Pasa --descripcion "texto con guiones" '
                'o --descripcion-file ruta/al/archivo.txt'
            )

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