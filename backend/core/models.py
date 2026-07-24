from django.contrib.auth.models import AbstractUser
from django.db import models
from decimal import Decimal


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

    class Estado(models.TextChoices):
        PENDIENTE = 'PENDIENTE', 'Pendiente'
        EN_PROGRESO = 'EN_PROGRESO', 'En progreso'
        TERMINADO = 'TERMINADO', 'Terminado'

    class Entrega(models.TextChoices):
        RETIRO = 'RETIRO', 'Retiro en local'
        DELIVERY = 'DELIVERY', 'Delivery'

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


class Maquina(models.Model):
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True)
    imagen = models.ImageField(upload_to='maquinas/', blank=True, null=True)

    precio_hora = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    precio_dia = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    precio_semana = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    activo = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre


class ReservaMaquina(models.Model):
    class Estado(models.TextChoices):
        PENDIENTE = 'PENDIENTE', 'Pendiente'
        APROBADA = 'APROBADA', 'Aprobada'
        RECHAZADA = 'RECHAZADA', 'Rechazada'

    class Entrega(models.TextChoices):
        RETIRO = 'RETIRO', 'Retira en local'
        DELIVERY = 'DELIVERY', 'Entrega en obra'

    maquina = models.ForeignKey(Maquina, on_delete=models.CASCADE, related_name='reservas')
    cliente = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='reservas',
        limit_choices_to={'rol': 'CLIENTE'}
    )
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField()
    modalidad_entrega = models.CharField(max_length=20, choices=Entrega.choices, default=Entrega.RETIRO)
    direccion_entrega = models.CharField(max_length=255, blank=True)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PENDIENTE)
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
    class Tipo(models.TextChoices):
        MANGUERA_R1 = 'MANGUERA_R1', 'Manguera R1'
        MANGUERA_R2 = 'MANGUERA_R2', 'Manguera R2'
        TERMINAL_JIC = 'TERMINAL_JIC', 'Terminal JIC'
        TERMINAL_HEMBRA_RECTO = 'TERMINAL_HEMBRA_RECTO', 'Terminal Hembra Recto'
        TERMINAL_MACHO_RECTO = 'TERMINAL_MACHO_RECTO', 'Terminal Macho Recto'
        TERMINAL_H45 = 'TERMINAL_H45', 'Terminal H45'
        TERMINAL_H90 = 'TERMINAL_H90', 'Terminal H90'
        FERULA = 'FERULA', 'Férula'

    class Unidad(models.TextChoices):
        METRO = 'METRO', 'Metro'
        UNIDAD = 'UNIDAD', 'Unidad'

    tipo = models.CharField(max_length=30, choices=Tipo.choices)
    # Diámetro de la manguera/terminal/férula, ej: 1/2", 3/4", 1"
    diametro = models.CharField(max_length=20, blank=True)
    unidad_medida = models.CharField(max_length=10, choices=Unidad.choices)
    precio = models.DecimalField(max_digits=10, decimal_places=2)
    stock_actual = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    stock_minimo = models.DecimalField(max_digits=10, decimal_places=2, default=5)
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['tipo', 'diametro']

    def __str__(self):
        base = self.get_tipo_display()
        if self.diametro:
            base += f" {self.diametro}"
        return base

    @property
    def stock_bajo(self):
        return self.stock_actual <= self.stock_minimo


class FlexibleDetalle(models.Model):
    class TipoManguera(models.TextChoices):
        R1 = 'R1', 'R1'
        R2 = 'R2', 'R2'

    class TerminalTipo(models.TextChoices):
        JIC = 'TERMINAL_JIC', 'JIC'
        HEMBRA_RECTO = 'TERMINAL_HEMBRA_RECTO', 'Hembra Recto'
        MACHO_RECTO = 'TERMINAL_MACHO_RECTO', 'Macho Recto'
        H45 = 'TERMINAL_H45', 'H45'
        H90 = 'TERMINAL_H90', 'H90'

    trabajo = models.OneToOneField(
        TrabajoMaestranza, on_delete=models.CASCADE, related_name='detalle_flexible'
    )
    tipo_manguera = models.CharField(max_length=5, choices=TipoManguera.choices)
    diametro = models.CharField(max_length=20)
    largo_metros = models.DecimalField(max_digits=6, decimal_places=2)
    terminal_entrada = models.CharField(max_length=30, choices=TerminalTipo.choices, null=True, blank=True)
    terminal_salida = models.CharField(max_length=30, choices=TerminalTipo.choices, null=True, blank=True)
    cantidad_ferulas = models.PositiveSmallIntegerField(choices=[(1, '1'), (2, '2')], default=2)
    cantidad_ferulas = models.PositiveSmallIntegerField(choices=[(1, '1'), (2, '2')], default=2)
    precio_total = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    # Evita descontar el stock dos veces si el trabajo se re-guarda
    stock_descontado = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Flexible {self.tipo_manguera} {self.diametro} - {self.trabajo}"

    def terminales_usados(self):
        return [t for t in [self.terminal_entrada, self.terminal_salida] if t]

    def descontar_stock(self):
        if self.stock_descontado:
            return

        tipo_manguera_map = {'R1': 'MANGUERA_R1', 'R2': 'MANGUERA_R2'}

        manguera = ProductoFlexible.objects.filter(
            tipo=tipo_manguera_map[self.tipo_manguera], diametro=self.diametro
        ).first()
        if manguera:
            manguera.stock_actual -= self.largo_metros
            manguera.save()

        for terminal_tipo in self.terminales_usados():
            terminal = ProductoFlexible.objects.filter(
                tipo=terminal_tipo, diametro=self.diametro
            ).first()
            if terminal:
                terminal.stock_actual -= 1
                terminal.save()

        ferula = ProductoFlexible.objects.filter(tipo='FERULA', diametro=self.diametro).first()
        if ferula:
            ferula.stock_actual -= self.cantidad_ferulas
            ferula.save()

        self.stock_descontado = True
        self.save()

    def productos_faltantes(self):
        """
        Devuelve una lista de descripciones de los productos que el trabajo
        necesita pero que no existen (o no tienen suficiente stock) en el catálogo.
        """
        faltantes = []
        tipo_manguera_map = {'R1': 'MANGUERA_R1', 'R2': 'MANGUERA_R2'}

        manguera = ProductoFlexible.objects.filter(
            tipo=tipo_manguera_map[self.tipo_manguera], diametro=self.diametro
        ).first()
        if not manguera:
            faltantes.append(f"Manguera {self.tipo_manguera} {self.diametro}")
        elif manguera.stock_actual < self.largo_metros:
            faltantes.append(f"Manguera {self.tipo_manguera} {self.diametro} (stock insuficiente: {manguera.stock_actual}m disponibles, se necesitan {self.largo_metros}m)")

        for terminal_tipo in self.terminales_usados():
            terminal = ProductoFlexible.objects.filter(
                tipo=terminal_tipo, diametro=self.diametro
            ).first()
            if not terminal:
                faltantes.append(f"Terminal ({terminal_tipo}) {self.diametro}")
            elif terminal.stock_actual < 1:
                faltantes.append(f"Terminal ({terminal_tipo}) {self.diametro} (sin stock)")

        ferula = ProductoFlexible.objects.filter(tipo='FERULA', diametro=self.diametro).first()
        if not ferula:
            faltantes.append(f"Férula {self.diametro}")
        elif ferula.stock_actual < self.cantidad_ferulas:
            faltantes.append(f"Férula {self.diametro} (stock insuficiente: {ferula.stock_actual} disponibles, se necesitan {self.cantidad_ferulas})")

        return faltantes

    def calcular_precio_sugerido(self):
        total = Decimal('0')
        tipo_manguera_map = {'R1': 'MANGUERA_R1', 'R2': 'MANGUERA_R2'}

        manguera = ProductoFlexible.objects.filter(
            tipo=tipo_manguera_map[self.tipo_manguera], diametro=self.diametro
        ).first()
        if manguera:
            total += manguera.precio * self.largo_metros

        for terminal_tipo in self.terminales_usados():
            terminal = ProductoFlexible.objects.filter(
                tipo=terminal_tipo, diametro=self.diametro
            ).first()
            if terminal:
                total += terminal.precio

        ferula = ProductoFlexible.objects.filter(tipo='FERULA', diametro=self.diametro).first()
        if ferula:
            total += ferula.precio * self.cantidad_ferulas

        return total