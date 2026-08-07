from django.core.management.base import BaseCommand
from core.models import Maquina


class Command(BaseCommand):
    help = (
        'Verifica que la migración de categoria (texto viejo) a categoria_fk '
        '(FK nueva) se haya copiado bien, antes de borrar el campo viejo del '
        'modelo (Paso 3). No modifica nada, solo informa.'
    )

    def handle(self, *args, **options):
        total = Maquina.objects.count()
        con_categoria_vieja = Maquina.objects.exclude(categoria='').count()
        con_categoria_nueva = Maquina.objects.exclude(categoria_fk__isnull=True).count()

        self.stdout.write(f'Total de máquinas: {total}')
        self.stdout.write(f'Con categoría vieja (texto): {con_categoria_vieja}')
        self.stdout.write(f'Con categoría nueva (FK): {con_categoria_nueva}')

        if con_categoria_vieja != con_categoria_nueva:
            self.stdout.write(self.style.WARNING(
                'Los números NO coinciden. No apliques el Paso 3 (borrar el '
                'campo viejo del models.py) todavía — revisa si corriste '
                'migrar_categorias_maquina.'
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f'Coinciden ({con_categoria_nueva} máquinas migradas). '
                f'Es seguro seguir con el Paso 3.'
            ))