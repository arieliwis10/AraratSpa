from django.contrib.auth.models import AbstractUser
from django.db import models
from datetime import date
from calendar import monthrange
from decimal import Decimal, ROUND_HALF_UP
from django.utils import timezone
from django.conf import settings

class Empresa(models.Model):
    nombre = models.CharField(max_length=150)
    rut = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True, null=True)

    def __str__(self):
        return self.nombre


class Responsable(models.Model):
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='responsables')
    nombre = models.CharField(max_length=150)
    telefono = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True, null=True)

    def __str__(self):
        return f"{self.nombre} ({self.empresa.nombre})"


class Usuario(AbstractUser):
    class Rol(models.TextChoices):
        ADMIN = 'ADMIN', 'Administrador'
        CLIENTE = 'CLIENTE', 'Cliente'
        TRABAJADOR = 'TRABAJADOR', 'Trabajador'

    rol = models.CharField(max_length=20, choices=Rol.choices, default=Rol.CLIENTE)
    telefono = models.CharField(max_length=20, blank=True)
    empresa = models.ForeignKey(
        Empresa, on_delete=models.SET_NULL, null=True, blank=True, related_name='clientes'
    )

    def __str__(self):
        return f"{self.username} ({self.get_rol_display()})"


class TrabajoMaestranza(models.Model):
    class Categoria(models.TextChoices):
        SOLDADURA = 'SOLDADURA', 'Soldadura'
        TORNO = 'TORNO', 'Torno mecánico'
        INSUMOS = 'INSUMOS', 'Insumos ferretería'
        REPUESTOS = 'REPUESTOS', 'Repuestos industriales'
        FLEXIBLES = 'FLEXIBLES', 'Flexibles hidráulicos'
        FABRICACION = 'FABRICACION', 'Fabricación de equipos especiales y proyecto'

    class Estado(models.TextChoices):
        PENDIENTE = 'PENDIENTE', 'Pendiente'
        EN_PROGRESO = 'EN_PROGRESO', 'En progreso'
        TERMINADO = 'TERMINADO', 'Terminado'

    class Entrega(models.TextChoices):
        RETIRO = 'RETIRO', 'Retiro en local'
        DESPACHO = 'DESPACHO', 'Despacho'

    cliente = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='trabajos_maestranza',
        limit_choices_to={'rol': 'CLIENTE'}
    )
    asignado_a = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='trabajos_asignados', limit_choices_to={'rol': 'TRABAJADOR'}
    )
    responsable = models.ForeignKey(
        Responsable, on_delete=models.SET_NULL, null=True, blank=True, related_name='trabajos'
    )

    correlativo = models.PositiveIntegerField(default=0)

    categoria = models.CharField(max_length=20, choices=Categoria.choices)
    descripcion = models.TextField()
    centro_costo = models.CharField(max_length=100)
    foto = models.ImageField(upload_to='maestranza/', blank=True, null=True)

    aprobado = models.BooleanField(default=False)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PENDIENTE)
    avance = models.PositiveSmallIntegerField(default=0)
    tiempo_entrega = models.DateField(null=True, blank=True)
    modalidad_entrega = models.CharField(max_length=20, choices=Entrega.choices, null=True, blank=True)
    direccion_entrega = models.CharField(max_length=255, blank=True)

    retrasado = models.BooleanField(default=False)
    motivo_retraso = models.TextField(blank=True)
    fecha_retraso = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.correlativo:
            empresa = self.cliente.empresa
            if empresa:
                ultimo = TrabajoMaestranza.objects.filter(
                    cliente__empresa=empresa
                ).order_by('-correlativo').first()
                self.correlativo = (ultimo.correlativo + 1) if ultimo else 1
            else:
                self.correlativo = 1
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_categoria_display()} - {self.cliente.username}"


class MaterialUsado(models.Model):
    trabajo = models.ForeignKey(TrabajoMaestranza, on_delete=models.CASCADE, related_name='materiales')
    nombre = models.CharField(max_length=200)
    cantidad = models.CharField(max_length=50)  # texto libre, ej: "5 m", "2 kg", "3 planchas"
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nombre} ({self.cantidad})"


class ComentarioTrabajo(models.Model):
    """Mensajes/notas entre cliente y admin sobre un trabajo, una vez aprobado."""
    trabajo = models.ForeignKey(TrabajoMaestranza, on_delete=models.CASCADE, related_name='comentarios')
    autor = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='comentarios_trabajo')
    # Qué persona de la empresa (no necesariamente quien tiene el login) escribió el comentario.
    # Solo aplica a comentarios de clientes; para el admin queda en None.
    responsable = models.ForeignKey(
        Responsable, on_delete=models.SET_NULL, null=True, blank=True, related_name='comentarios_trabajo'
    )
    mensaje = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    # True si el admin ya revisó este comentario. Los comentarios que escribe
    # el propio admin se guardan como ya vistos (no tiene sentido alertarse a
    # sí mismo); solo los del cliente arrancan en False.
    visto_admin = models.BooleanField(default=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.autor.username}: {self.mensaje[:30]}"


class SolicitudMaterial(models.Model):
    class Estado(models.TextChoices):
        REVISION = 'REVISION', 'En revisión'
        PENDIENTE = 'PENDIENTE', 'Pendiente de compra'
        RECIBIDO = 'RECIBIDO', 'Recibido'

    # Opcional: solo se completa si la solicitud viene de "Reportar retraso"
    # (anexa a un trabajo). Los pedidos sueltos de herramienta/material no
    # llevan trabajo asociado.
    trabajo = models.ForeignKey(
        TrabajoMaestranza, on_delete=models.CASCADE, related_name='solicitudes_material',
        null=True, blank=True
    )
    # Quién hizo el pedido — queda como evidencia junto con created_at (fecha/hora).
    solicitante = models.ForeignKey(
        'Usuario', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='solicitudes_material_creadas'
    )
    descripcion = models.TextField(blank=True)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.REVISION)
    lugar_compra = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    resuelto_en = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        referencia = self.trabajo if self.trabajo else (self.solicitante or 'sin solicitante')
        return f"Solicitud de {referencia} ({self.estado})"

class CategoriaMaquina(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    imagen = models.ImageField(upload_to='categorias_maquinas/', blank=True, null=True)
    activa = models.BooleanField(default=True)  # false = oculta para clientes
    orden = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['orden', 'nombre']

    def __str__(self):
        return self.nombre

class Maquina(models.Model):
    categoria_fk = models.ForeignKey(
        'CategoriaMaquina', on_delete=models.SET_NULL, null=True, blank=True, related_name='maquinas'
    )
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True)
    imagen = models.ImageField(upload_to='maquinas/', blank=True, null=True)

    precio_hora = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    precio_dia = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    precio_semana = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    precio_mes = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    precio_despacho = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    activo = models.BooleanField(default=True)

    IVA = Decimal('0.19')

    def __str__(self):
        return self.nombre

    @staticmethod
    def _dias_facturables_mensual(fecha_inicio, fecha_fin):
        """
        Cuenta los días facturables tratando cada "mes" completo (mismo día
        del mes que fecha_inicio, o el último día si el mes de destino es
        más corto) como 30 días, más los días que sobren como resto.

        Así una reserva de un mes calendario completo (ej. 21-08 a 21-09)
        siempre cobra 30 días, sin importar si ese mes tuvo 28, 30 o 31
        días reales.
        """
        meses = 0
        cursor = fecha_inicio
        anio, mes, dia = fecha_inicio.year, fecha_inicio.month, fecha_inicio.day

        while True:
            siguiente_mes = mes + 1
            siguiente_anio = anio
            if siguiente_mes > 12:
                siguiente_mes = 1
                siguiente_anio += 1
            ultimo_dia_siguiente = monthrange(siguiente_anio, siguiente_mes)[1]
            dia_ajustado = min(dia, ultimo_dia_siguiente)
            candidato = date(siguiente_anio, siguiente_mes, dia_ajustado)

            if candidato > fecha_fin:
                break

            meses += 1
            cursor = candidato
            anio, mes = siguiente_anio, siguiente_mes

        dias_restantes = (fecha_fin - cursor).days
        return meses * 30 + dias_restantes

    def calcular_precio(self, fecha_inicio, fecha_fin, con_despacho=False):
        """
        Calcula neto/despacho/IVA/total para una reserva entre fecha_inicio
        y fecha_fin (inclusive), según el tramo:
          - 1 a 3 días reales: precio_dia * días
          - 4 a 17 días reales: (precio_semana / 7) * días
          - 18+ días reales: (precio_mes / 30) * días facturables, donde
            los días facturables cuentan cada mes completo como 30 días
            (ver _dias_facturables_mensual).

        Si con_despacho=True y la máquina tiene precio_despacho configurado,
        se suma al neto antes de calcular el IVA.

        Devuelve None si la máquina no tiene configurado el precio del
        tramo que corresponde a esa duración.
        """
        dias_reales = (fecha_fin - fecha_inicio).days + 1

        if dias_reales <= 3:
            tarifa_aplicada = 'dia'
            dias_facturables = dias_reales
            precio_base = self.precio_dia
            neto_arriendo = precio_base * dias_facturables if precio_base is not None else None
        elif dias_reales <= 17:
            tarifa_aplicada = 'semana'
            dias_facturables = dias_reales
            precio_base = self.precio_semana
            neto_arriendo = (precio_base / Decimal('7')) * dias_facturables if precio_base is not None else None
        else:
            tarifa_aplicada = 'mes'
            dias_facturables = self._dias_facturables_mensual(fecha_inicio, fecha_fin)
            precio_base = self.precio_mes
            neto_arriendo = (precio_base / Decimal('30')) * dias_facturables if precio_base is not None else None

        if neto_arriendo is None:
            return None

        neto_arriendo = neto_arriendo.quantize(Decimal('1'), rounding=ROUND_HALF_UP)

        despacho = Decimal('0')
        if con_despacho and self.precio_despacho:
            despacho = self.precio_despacho

        neto = neto_arriendo + despacho
        iva = (neto * self.IVA).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
        total = neto + iva

        return {
            'dias': dias_facturables,
            'tarifa_aplicada': tarifa_aplicada,
            'precio_neto': neto_arriendo,
            'precio_despacho': despacho,
            'iva': iva,
            'precio_total': total,
        }


class ReservaMaquina(models.Model):
    class Estado(models.TextChoices):
        PENDIENTE = 'PENDIENTE', 'Pendiente'
        APROBADA = 'APROBADA', 'Aprobada'
        RECHAZADA = 'RECHAZADA', 'Rechazada'

    class Entrega(models.TextChoices):
        RETIRO = 'RETIRO', 'Retira en local'
        DESPACHO = 'DESPACHO', 'Entrega en obra'

    maquina = models.ForeignKey(Maquina, on_delete=models.CASCADE, related_name='reservas')
    cliente = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='reservas',
        limit_choices_to={'rol': 'CLIENTE'}
    )
    responsable = models.ForeignKey(
        Responsable, on_delete=models.SET_NULL, null=True, blank=True, related_name='reservas_maquina'
    )
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField()
    modalidad_entrega = models.CharField(max_length=20, choices=Entrega.choices, default=Entrega.RETIRO)
    direccion_entrega = models.CharField(max_length=255, blank=True)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PENDIENTE)
    visto = models.BooleanField(default=False)  # si el cliente ya revisó la aprobación
    terminos_aceptados = models.BooleanField(default=False)
    fecha_aceptacion_terminos = models.DateTimeField(null=True, blank=True)

    # Precio calculado al momento de crear la reserva (queda "congelado"
    # aunque después cambien los precios de la máquina).
    dias = models.PositiveIntegerField(null=True, blank=True)
    tarifa_aplicada = models.CharField(max_length=10, blank=True)
    precio_neto = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    precio_despacho = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    iva = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    precio_total = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.maquina.nombre} - {self.cliente.username} ({self.fecha_inicio} a {self.fecha_fin})"

class ProductoFerreteria(models.Model):
    class Categoria(models.TextChoices):
        INSUMOS = 'INSUMOS', 'Insumos ferretería'
        REPUESTOS = 'REPUESTOS', 'Repuestos industriales'

    nombre = models.CharField(max_length=200)
    sku = models.CharField(max_length=50, blank=True)
    descripcion = models.CharField(max_length=255, blank=True)
    categoria = models.CharField(max_length=20, choices=Categoria.choices)
    precio = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    imagen = models.ImageField(upload_to='ferreteria/', blank=True, null=True)
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class PedidoFerreteria(models.Model):
    class Categoria(models.TextChoices):
        INSUMOS = 'INSUMOS', 'Insumos ferretería'
        REPUESTOS = 'REPUESTOS', 'Repuestos industriales'

    class Estado(models.TextChoices):
        PENDIENTE = 'PENDIENTE', 'Pendiente'
        REVISADO = 'REVISADO', 'Revisado'

    cliente = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='pedidos_ferreteria',
        limit_choices_to={'rol': 'CLIENTE'}
    )
    responsable = models.ForeignKey(
        Responsable, on_delete=models.SET_NULL, null=True, blank=True, related_name='pedidos_ferreteria'
    )
    categoria = models.CharField(max_length=20, choices=Categoria.choices)
    centro_costo = models.CharField(max_length=100)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PENDIENTE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Pedido {self.get_categoria_display()} - {self.cliente.username}"


class ItemPedidoFerreteria(models.Model):
    pedido = models.ForeignKey(PedidoFerreteria, on_delete=models.CASCADE, related_name='items')
    producto = models.ForeignKey(ProductoFerreteria, on_delete=models.SET_NULL, null=True, blank=True)
    nombre = models.CharField(max_length=200)
    sku = models.CharField(max_length=50, blank=True)
    precio = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    cantidad = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f"{self.nombre} x{self.cantidad}"

class ProductoFlexible(models.Model):
    class Categoria(models.TextChoices):
        MANGUERA = 'MANGUERA', 'Manguera'
        TERMINAL = 'TERMINAL', 'Terminal'
        FERULA = 'FERULA', 'Férula'

    class Unidad(models.TextChoices):
        METRO = 'METRO', 'Metro'
        UNIDAD = 'UNIDAD', 'Unidad'

    categoria = models.CharField(max_length=20, choices=Categoria.choices)
    # Nombre libre dentro de la categoría: "R1", "R2" para mangueras;
    # "JIC", "Hembra Recto", "H45", "H90", "Compacto", etc. para terminales.
    # El admin puede agregar los que necesite, sin límite de tipos fijos.
    nombre = models.CharField(max_length=100)
    diametro = models.CharField(max_length=20, blank=True)
    unidad_medida = models.CharField(max_length=10, choices=Unidad.choices)
    precio = models.DecimalField(max_digits=10, decimal_places=2)
    stock_actual = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    stock_minimo = models.DecimalField(max_digits=10, decimal_places=2, default=5)
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['categoria', 'nombre', 'diametro']

    def __str__(self):
        base = f"{self.get_categoria_display()} {self.nombre}"
        if self.diametro:
            base += f" {self.diametro}"
        return base

    @property
    def stock_bajo(self):
        return self.stock_actual <= self.stock_minimo


class FlexibleDetalle(models.Model):
    trabajo = models.OneToOneField(
        TrabajoMaestranza, on_delete=models.CASCADE, related_name='detalle_flexible'
    )
    manguera = models.ForeignKey(
        ProductoFlexible, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='detalles_manguera'
    )
    largo_metros = models.DecimalField(max_digits=6, decimal_places=2)
    terminal_entrada = models.ForeignKey(
        ProductoFlexible, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='detalles_terminal_entrada'
    )
    terminal_salida = models.ForeignKey(
        ProductoFlexible, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='detalles_terminal_salida'
    )
    ferula = models.ForeignKey(
        ProductoFlexible, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='detalles_ferula'
    )
    cantidad_ferulas = models.PositiveSmallIntegerField(choices=[(1, '1'), (2, '2')], default=2)
    precio_total = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    # Evita descontar el stock dos veces si el trabajo se re-guarda
    stock_descontado = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Flexible {self.manguera} - {self.trabajo}"

    def terminales_usados(self):
        return [t for t in [self.terminal_entrada, self.terminal_salida] if t]

    def descontar_stock(self):
        if self.stock_descontado:
            return

        if self.manguera:
            self.manguera.stock_actual -= self.largo_metros
            self.manguera.save()

        for terminal in self.terminales_usados():
            terminal.stock_actual -= 1
            terminal.save()

        if self.ferula:
            self.ferula.stock_actual -= self.cantidad_ferulas
            self.ferula.save()

        self.stock_descontado = True
        self.save()

    def productos_faltantes(self):
        """
        Devuelve descripciones de lo que falta seleccionar o de lo que no
        tiene stock suficiente.
        """
        faltantes = []

        if not self.manguera:
            faltantes.append("Falta seleccionar la manguera")
        elif self.manguera.stock_actual < self.largo_metros:
            faltantes.append(
                f"{self.manguera} (stock insuficiente: {self.manguera.stock_actual}m disponibles, se necesitan {self.largo_metros}m)"
            )

        if self.cantidad_ferulas == 2 and len(self.terminales_usados()) < 2:
            faltantes.append("Falta seleccionar ambos terminales (entrada y salida)")
        elif self.cantidad_ferulas == 1 and len(self.terminales_usados()) < 1:
            faltantes.append("Falta seleccionar el terminal usado")

        for terminal in self.terminales_usados():
            if terminal.stock_actual < 1:
                faltantes.append(f"{terminal} (sin stock)")

        if not self.ferula:
            faltantes.append("Falta seleccionar la férula")
        elif self.ferula.stock_actual < self.cantidad_ferulas:
            faltantes.append(
                f"{self.ferula} (stock insuficiente: {self.ferula.stock_actual} disponibles, se necesitan {self.cantidad_ferulas})"
            )

        return faltantes

    def calcular_precio_sugerido(self):
        total = Decimal('0')

        if self.manguera:
            total += self.manguera.precio * self.largo_metros

        for terminal in self.terminales_usados():
            total += terminal.precio

        if self.ferula:
            total += self.ferula.precio * self.cantidad_ferulas

        return total

class ProductoGas(models.Model):
    class Tipo(models.TextChoices):
        KG5 = 'KG5', 'Gas licuado 5kg'
        KG11 = 'KG11', 'Gas licuado 11kg'
        KG15 = 'KG15', 'Gas licuado 15kg'
        KG45 = 'KG45', 'Gas licuado 45kg'
        GRUA = 'GRUA', 'Gas grúa'

    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    nombre = models.CharField(max_length=100, blank=True)  # opcional, ej. marca/proveedor
    precio = models.DecimalField(max_digits=10, decimal_places=2)
    stock_actual = models.PositiveIntegerField(default=0)
    stock_minimo = models.PositiveIntegerField(default=5)
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['tipo']

    def __str__(self):
        base = self.get_tipo_display()
        return f"{base} - {self.nombre}" if self.nombre else base

    @property
    def stock_bajo(self):
        return self.stock_actual <= self.stock_minimo


class PedidoGas(models.Model):
    class Estado(models.TextChoices):
        PENDIENTE = 'PENDIENTE', 'Pendiente'
        REVISADO = 'REVISADO', 'Revisado'

    cliente = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='pedidos_gas',
        limit_choices_to={'rol': 'CLIENTE'}
    )
    responsable = models.ForeignKey(
        Responsable, on_delete=models.SET_NULL, null=True, blank=True, related_name='pedidos_gas'
    )
    centro_costo = models.CharField(max_length=100)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PENDIENTE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Pedido de gas - {self.cliente.username}"


class ItemPedidoGas(models.Model):
    pedido = models.ForeignKey(PedidoGas, on_delete=models.CASCADE, related_name='items')
    producto = models.ForeignKey(ProductoGas, on_delete=models.SET_NULL, null=True, blank=True)
    nombre = models.CharField(max_length=200)
    precio = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    cantidad = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f"{self.nombre} x{self.cantidad}"

class TareaAgenda(models.Model):
    """
    Tarea/nota de agenda, con fecha y hora opcional. El admin la crea y
    puede asignarla a un trabajador; si no se asigna a nadie, queda como
    tarea general del admin. Puede vincularse opcionalmente a un trabajo
    de Maestranza existente.
    """
    titulo = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    fecha = models.DateField()
    hora = models.TimeField(null=True, blank=True)

    asignado_a = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='tareas_asignadas', limit_choices_to={'rol': 'TRABAJADOR'}
    )
    creado_por = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='tareas_creadas'
    )
    trabajo = models.ForeignKey(
        TrabajoMaestranza, on_delete=models.SET_NULL, null=True, blank=True, related_name='tareas_agenda'
    )

    completada = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['fecha', 'hora']

    def __str__(self):
        return f"{self.titulo} ({self.fecha})"

class Cotizacion(models.Model):
    trabajo = models.ForeignKey(
        TrabajoMaestranza, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='cotizaciones'
    )
    reserva_maquina = models.ForeignKey(
        ReservaMaquina, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='cotizaciones'
    )
    pedido_ferreteria = models.ForeignKey(
        PedidoFerreteria, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='cotizaciones'
    )
    pedido_gas = models.ForeignKey(
        PedidoGas, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='cotizaciones'
    )
    empresa = models.ForeignKey(
        Empresa, on_delete=models.SET_NULL, null=True, blank=True, related_name='cotizaciones'
    )
    # Solo se usa cuando la cotización es para alguien que NO tiene empresa
    # registrada en el sistema (persona natural, cliente puntual, etc).
    # Si 'empresa' está seteada, el envío usa empresa.email y este campo
    # queda vacío/sin uso.
    cliente_email = models.EmailField(blank=True, null=True)
    # Solo se usa cuando la cotización es una plantilla (sin trabajo
    # asociado) y el admin escribe manualmente a qué corresponde
    # ("Orden de trabajo" en el PDF).
    orden_trabajo_manual = models.CharField(max_length=255, blank=True)
    creado_por = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='cotizaciones_creadas'
    )

    # Antes venía generado en el frontend con localStorage — se cambió a
    # blank=True porque ahora se asigna automáticamente en save() si no
    # viene seteado, evitando folios repetidos entre pestañas/máquinas.
    folio = models.CharField(max_length=20, blank=True)
    obra = models.CharField(max_length=255, blank=True)
    mandante = models.CharField(max_length=255, blank=True)
    lugar_trabajo = models.CharField(max_length=255, blank=True)
    validez_dias = models.PositiveIntegerField(default=10)
    items = models.JSONField(default=list)
    notas = models.TextField(blank=True)

    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    iva = models.DecimalField(max_digits=12, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.folio:
            prefijo = timezone.now().strftime('%Y%m')
            ultimo = Cotizacion.objects.filter(folio__startswith=f'{prefijo}_').order_by('-id').first()
            ultimo_num = 0
            if ultimo:
                try:
                    ultimo_num = int(ultimo.folio.rsplit('_', 1)[1])
                except (IndexError, ValueError):
                    ultimo_num = 0
            self.folio = f'{prefijo}_{ultimo_num + 1}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Cotización {self.folio} — {self.empresa or self.mandante}"

class PushSubscription(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='push_subscriptions')
    endpoint = models.URLField(max_length=500, unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Suscripción Push"