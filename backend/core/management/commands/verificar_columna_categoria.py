from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = (
        'Verifica en la base de datos REAL (consulta SQL directa, sin pasar '
        'por el modelo de Django) si la columna categoria vieja todavía '
        'existe en la tabla core_maquina, y si tiene datos cargados. '
        'Diagnóstico de emergencia, no modifica nada.'
    )

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            cursor.execute("SHOW COLUMNS FROM core_maquina LIKE 'categoria'")
            existe = cursor.fetchone()

            if not existe:
                self.stdout.write(self.style.ERROR(
                    'La columna "categoria" YA NO EXISTE en la base de datos. '
                    'Si esa información no se había guardado antes en '
                    'categoria_fk, esa información ya no está disponible.'
                ))
                return

            self.stdout.write(self.style.SUCCESS(
                'La columna "categoria" todavía existe en la base de datos. '
                'Los datos NO se perdieron.'
            ))
            cursor.execute(
                "SELECT id, nombre, categoria FROM core_maquina "
                "WHERE categoria != '' AND categoria IS NOT NULL"
            )
            filas = cursor.fetchall()
            self.stdout.write(f'{len(filas)} máquina(s) con categoría vieja cargada todavía:')
            for id_, nombre, categoria in filas[:5]:
                self.stdout.write(f'  #{id_} {nombre}: {categoria}')
            if len(filas) > 5:
                self.stdout.write(f'  ... y {len(filas) - 5} más')