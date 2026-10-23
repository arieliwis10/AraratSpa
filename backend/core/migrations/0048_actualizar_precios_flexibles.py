import re
from decimal import Decimal

from django.db import migrations


# Listados entregados por Ararat: son el catálogo oficial de flexibles. Se
# actualizan los productos que ya existen, se crean los que falten y se
# eliminan los repetidos y los que no están en estas listas.
DIAMETROS = ['1/4"', '5/16"', '3/8"', '1/2"', '5/8"', '3/4"', '1"']
STOCK = Decimal('100')

# Mangueras: precio por metro, stock en metros.
MANGUERAS = {
    'R1': [12000, 13000, 14000, 16000, 22000, 24000, 30000],
    'R2': [13500, 14500, 15500, 17500, 23500, 25500, 31500],
}

# Terminales: precio por unidad. Son los mismos para mangueras R1 y R2.
TERMINALES = {
    'Macho Recto': [5000, 6000, 8000, 10000, 12000, 14000, 16000],
    'Hembra Recto': [5000, 6000, 8000, 10000, 12000, 14000, 16000],
    '45': [5500, 6500, 8500, 10500, 12500, 14500, 16500],
    '90': [5500, 6500, 8500, 10500, 12500, 14500, 16500],
}
# Los terminales en ángulo quedan con un nombre general ('45' / '90'): todos
# los que ya existan con ese número en el nombre ('H 45', 'H45', 'JIC 45'...)
# tienen el mismo precio y se unifican bajo ese nombre.
NOMBRES_POR_ANGULO = {'45', '90'}

# Férulas: precio por unidad. Hay un solo tipo, así que se buscan solo por diámetro.
FERULAS = [6000, 7000, 8000, 10000, 11000, 12000, 11500]


def _valor_diametro(texto):
    # Copia de ProductoFlexible.valor_diametro: en una migración no se pueden
    # usar los métodos del modelo. Permite reconocer '1/4', '1/4"' y '1/4 "'
    # como el mismo diámetro.
    limpio = (texto or '').replace('"', '').replace("''", '').replace(',', '.').strip()
    try:
        total = 0.0
        for parte in limpio.replace('-', ' ').split():
            if '/' in parte:
                num, den = parte.split('/')
                total += float(num) / float(den)
            else:
                total += float(parte)
        return total if limpio else None
    except (ValueError, ZeroDivisionError):
        return None


def _clave_nombre(nombre):
    # 'Macho Recto' y 'macho  recto' se tratan como el mismo nombre.
    return ''.join((nombre or '').split()).casefold()


def _coincide_nombre(existente, nombre):
    if nombre in NOMBRES_POR_ANGULO:
        # '45' coincide con 'H 45', 'H45', 'JIC 45', 'JIC45'... pero no con '145'.
        return re.search(rf'(?<!\d){nombre}(?!\d)', existente or '') is not None
    return _clave_nombre(existente) == _clave_nombre(nombre)


def _aplicar(ProductoFlexible, coincidencias, *, categoria, unidad, nombre, diametro, precio):
    """
    Deja un solo producto para (nombre, diámetro) con el precio y stock nuevos
    y devuelve su id. Si varios existentes coinciden (ej. 'H45 1/2"' y
    'JIC 45 1/2"' pasan a ser '45 1/2"'), se conserva uno; los demás los
    elimina _eliminar_sobrantes.
    """
    if not coincidencias:
        return ProductoFlexible.objects.create(
            categoria=categoria, nombre=nombre, diametro=diametro,
            unidad_medida=unidad, precio=Decimal(precio), stock_actual=STOCK,
        ).pk

    # Prioridad: el que ya tiene exactamente el nombre final, luego el activo, luego el más antiguo.
    coincidencias.sort(key=lambda p: (p.nombre != nombre, not p.activo, p.pk))
    principal = coincidencias[0]

    principal.nombre = nombre
    principal.diametro = diametro
    principal.precio = Decimal(precio)
    principal.stock_actual = STOCK
    principal.unidad_medida = unidad
    principal.activo = True
    principal.save()
    return principal.pk


def _actualizar(ProductoFlexible, categoria, unidad, listado):
    existentes = list(ProductoFlexible.objects.filter(categoria=categoria))
    conservados = set()

    for nombre, precios in listado.items():
        for diametro, precio in zip(DIAMETROS, precios):
            valor = _valor_diametro(diametro)
            coincidencias = [
                p for p in existentes
                if p.pk not in conservados
                and _coincide_nombre(p.nombre, nombre) and _valor_diametro(p.diametro) == valor
            ]
            conservados.add(_aplicar(
                ProductoFlexible, coincidencias, categoria=categoria, unidad=unidad,
                nombre=nombre, diametro=diametro, precio=precio,
            ))
    return conservados


def _eliminar_sobrantes(ProductoFlexible, FlexibleDetalle, conservados):
    """
    Elimina los flexibles que no están en el catálogo oficial (repetidos y
    sobrantes). Por seguridad, si alguno ya está usado en un trabajo se
    desactiva en vez de eliminarse, para que ese trabajo no pierda el dato.
    """
    usados = set()
    for campo in ('manguera_id', 'terminal_entrada_id', 'terminal_salida_id', 'ferula_id'):
        usados.update(FlexibleDetalle.objects.exclude(**{campo: None}).values_list(campo, flat=True))

    sobrantes = ProductoFlexible.objects.exclude(pk__in=conservados)
    sobrantes.filter(pk__in=usados).update(activo=False)
    sobrantes.exclude(pk__in=usados).delete()


def _actualizar_ferulas(ProductoFlexible):
    existentes = list(ProductoFlexible.objects.filter(categoria='FERULA'))
    # Se conserva el nombre que ya usan las férulas cargadas.
    nombres = [p.nombre for p in existentes if p.nombre.strip()]
    nombre = max(set(nombres), key=nombres.count) if nombres else 'Férula'

    conservados = set()
    for diametro, precio in zip(DIAMETROS, FERULAS):
        valor = _valor_diametro(diametro)
        coincidencias = [p for p in existentes if _valor_diametro(p.diametro) == valor]
        conservados.add(_aplicar(
            ProductoFlexible, coincidencias, categoria='FERULA', unidad='UNIDAD',
            nombre=nombre, diametro=diametro, precio=precio,
        ))
    return conservados


def actualizar_flexibles(apps, schema_editor):
    ProductoFlexible = apps.get_model('core', 'ProductoFlexible')
    FlexibleDetalle = apps.get_model('core', 'FlexibleDetalle')
    conservados = (
        _actualizar(ProductoFlexible, 'MANGUERA', 'METRO', MANGUERAS)
        | _actualizar(ProductoFlexible, 'TERMINAL', 'UNIDAD', TERMINALES)
        | _actualizar_ferulas(ProductoFlexible)
    )
    _eliminar_sobrantes(ProductoFlexible, FlexibleDetalle, conservados)


def revertir(apps, schema_editor):
    # Los precios y stock anteriores no se guardan, así que no hay vuelta atrás automática.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0047_trabajomaestranza_fecha_termino'),
    ]

    operations = [
        migrations.RunPython(actualizar_flexibles, revertir),
    ]
