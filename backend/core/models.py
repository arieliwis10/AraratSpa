from django.contrib.auth.models import AbstractUser
from django.db import models


class Empresa(models.Model):
    nombre = models.CharField(max_length=150)
    rut = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return self.nombre


class Responsable(models.Model):
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='responsables')
    nombre = models.CharField(max_length=150)
    telefono = models.CharField(max_length=20, blank=True)

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
    cantidad = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nombre} ({self.cantidad})"


class SolicitudMaterial(models.Model):
    class Estado(models.TextChoices):
        REVISION = 'REVISION', 'En revisión'
        PENDIENTE = 'PENDIENTE', 'Pendiente de compra'
        RECIBIDO = 'RECIBIDO', 'Recibido'

    trabajo = models.ForeignKey(TrabajoMaestranza, on_delete=models.CASCADE, related_name='solicitudes_material')
    descripcion = models.TextField(blank=True)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.REVISION)
    lugar_compra = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    resuelto_en = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Compra para {self.trabajo} ({self.estado})"


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