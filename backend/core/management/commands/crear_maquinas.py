from django.core.management.base import BaseCommand, CommandError
from core.models import Maquina


class Command(BaseCommand):
    help = (
        'Crea varias máquinas iguales de una vez (mismo nombre base numerado '
        'correlativamente con guión, misma categoría, descripción y precios). '
        'Útil para cargar lotes de maquinaria idéntica sin pasar una por una '
        'por el formulario del panel admin. Después se entra al panel a '
        'subirle la foto a cada una individualmente.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--nombre-base', type=str, required=True,
            help='Ej: "G2.5T 10" -> genera "G2.5T 10-80", "G2.5T 10-81", ... '
                 'Si lo corres desde el campo de cPanel (que no respeta comillas '
                 'ni espacios como un solo argumento), usa guion bajo en vez de '
                 'espacio: "G2.5T_10" se convierte solo en "G2.5T 10".'
        )
        parser.add_argument(
            '--categoria', type=str, required=True,
            choices=['AUTOCARGABLE', 'GRUA_HORQUILLA'],
            help='Categoría de la máquina, para que el cliente pueda filtrar '
                 'por tipo en la app.'
        )
        parser.add_argument('--cantidad', type=int, required=True)
        parser.add_argument(
            '--descripcion', type=str, default='',
            help='Misma descripción para todas, pasada directo por línea de comandos. '
                 'Si tiene tildes, paréntesis o comillas, mejor usar --descripcion-file.'
        )
        parser.add_argument(
            '--descripcion-file', type=str, default=None,
            help='Ruta a un archivo .txt con la descripción. Si se pasa, tiene '
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
            help='Crearlas como inactivas (no visibles para clientes) en vez de activas por defecto.'
        )

    def handle(self, *args, **options):
        nombre_base = options['nombre_base'].replace('_', ' ')
        categoria = options['categoria']
        cantidad = options['cantidad']
        descripcion = options['descripcion']
        desde = options['desde']

        if options['descripcion_file']:
            try:
                with open(options['descripcion_file'], encoding='utf-8') as f:
                    descripcion = f.read().strip()
            except FileNotFoundError:
                raise CommandError(f"No se encontró el archivo '{options['descripcion_file']}'.")

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
                categoria=categoria,
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