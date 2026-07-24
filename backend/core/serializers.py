from rest_framework import serializers
from .models import (
    Usuario, Empresa, Responsable, TrabajoMaestranza, MaterialUsado,
    ComentarioTrabajo, SolicitudMaterial, Maquina, ReservaMaquina, ProductoFerreteria, PedidoFerreteria, ItemPedidoFerreteria,
    ProductoFlexible, FlexibleDetalle
)


class ResponsableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Responsable
        fields = ['id', 'empresa', 'nombre', 'telefono', 'email']


class EmpresaSerializer(serializers.ModelSerializer):
    responsables = ResponsableSerializer(many=True, read_only=True)

    class Meta:
        model = Empresa
        fields = ['id', 'nombre', 'rut', 'responsables', 'email']


class UsuarioSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source='empresa.nombre', read_only=True, default=None)

    class Meta:
        model = Usuario
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'rol', 'telefono', 'empresa', 'empresa_nombre']


class UsuarioCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Usuario
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'rol', 'telefono', 'empresa', 'password']

    def create(self, validated_data):
        password = validated_data.pop('password')
        usuario = Usuario(**validated_data)
        usuario.set_password(password)
        usuario.save()
        return usuario

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class MaterialUsadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaterialUsado
        fields = ['id', 'trabajo', 'nombre', 'cantidad', 'created_at']
        read_only_fields = ['trabajo']


class ComentarioTrabajoSerializer(serializers.ModelSerializer):
    autor_nombre = serializers.SerializerMethodField()
    autor_rol = serializers.CharField(source='autor.rol', read_only=True)
    responsable_nombre = serializers.CharField(source='responsable.nombre', read_only=True, default=None)

    class Meta:
        model = ComentarioTrabajo
        fields = [
            'id', 'trabajo', 'autor', 'autor_nombre', 'autor_rol',
            'responsable', 'responsable_nombre', 'mensaje', 'created_at'
        ]
        read_only_fields = ['trabajo', 'autor']

    def get_autor_nombre(self, obj):
        nombre_completo = f"{obj.autor.first_name} {obj.autor.last_name}".strip()
        return nombre_completo or obj.autor.username


class SolicitudMaterialSerializer(serializers.ModelSerializer):
    trabajo_descripcion = serializers.CharField(source='trabajo.descripcion', read_only=True, default=None)
    trabajo_categoria = serializers.CharField(source='trabajo.get_categoria_display', read_only=True, default=None)
    trabajo_correlativo = serializers.IntegerField(source='trabajo.correlativo', read_only=True, default=None)
    cliente_nombre = serializers.CharField(source='trabajo.cliente.username', read_only=True, default=None)
    empresa_nombre = serializers.CharField(source='trabajo.cliente.empresa.nombre', read_only=True, default=None)
    solicitante_nombre = serializers.CharField(source='solicitante.username', read_only=True, default=None)

    class Meta:
        model = SolicitudMaterial
        fields = [
            'id', 'trabajo', 'trabajo_descripcion', 'trabajo_categoria', 'trabajo_correlativo',
            'cliente_nombre', 'empresa_nombre', 'solicitante', 'solicitante_nombre',
            'descripcion', 'estado', 'lugar_compra', 'created_at', 'resuelto_en'
        ]
        read_only_fields = ['solicitante']

class ProductoFlexibleSerializer(serializers.ModelSerializer):
    stock_bajo = serializers.ReadOnlyField()
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = ProductoFlexible
        fields = [
            'id', 'tipo', 'tipo_display', 'diametro', 'unidad_medida',
            'precio', 'stock_actual', 'stock_minimo', 'stock_bajo', 'activo', 'created_at',
        ]


class FlexibleDetalleSerializer(serializers.ModelSerializer):
    precio_sugerido = serializers.SerializerMethodField()

    class Meta:
        model = FlexibleDetalle
        fields = [
            'id', 'trabajo', 'tipo_manguera', 'diametro', 'largo_metros',
            'terminal_entrada', 'terminal_salida', 'cantidad_ferulas',
            'precio_total', 'precio_sugerido',
        ]
        read_only_fields = ['trabajo']

    def get_precio_sugerido(self, obj):
        return obj.calcular_precio_sugerido()

    def validate(self, data):
        cantidad = data.get('cantidad_ferulas', getattr(self.instance, 'cantidad_ferulas', None))
        entrada = data.get('terminal_entrada', getattr(self.instance, 'terminal_entrada', None))
        salida = data.get('terminal_salida', getattr(self.instance, 'terminal_salida', None))

        # Solo validamos si viene alguno de estos campos en el request (para no romper el guardado de solo precio_total)
        if cantidad is not None and ('terminal_entrada' in data or 'terminal_salida' in data or 'cantidad_ferulas' in data):
            if cantidad == 2 and not (entrada and salida):
                raise serializers.ValidationError('Con manguera completa (2 férulas) debes indicar el terminal de entrada y de salida.')
            if cantidad == 1 and not (entrada or salida):
                raise serializers.ValidationError('Con arreglo de un lado (1 férula) debes indicar el terminal usado.')

        return data


class TrabajoMaestranzaSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.CharField(source='cliente.username', read_only=True)
    empresa_nombre = serializers.CharField(source='cliente.empresa.nombre', read_only=True, default=None)
    responsable_nombre = serializers.CharField(source='responsable.nombre', read_only=True, default=None)
    asignado_a_nombre = serializers.CharField(source='asignado_a.username', read_only=True, default=None)
    categoria_display = serializers.CharField(source='get_categoria_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    materiales = MaterialUsadoSerializer(many=True, read_only=True)
    comentarios = ComentarioTrabajoSerializer(many=True, read_only=True)
    detalle_flexible = FlexibleDetalleSerializer(read_only=True)

    class Meta:
        model = TrabajoMaestranza
        fields = [
            'id', 'correlativo', 'cliente', 'cliente_nombre', 'empresa_nombre',
            'responsable', 'responsable_nombre', 'asignado_a', 'asignado_a_nombre',
            'categoria', 'categoria_display', 'descripcion', 'centro_costo', 'foto',
            'aprobado', 'estado', 'estado_display', 'avance', 'tiempo_entrega',
            'modalidad_entrega', 'direccion_entrega', 'retrasado', 'motivo_retraso',
            'fecha_retraso', 'materiales', 'comentarios', 'created_at', 'updated_at', 'detalle_flexible'
        ]
        read_only_fields = ['cliente', 'correlativo']

    def validate(self, data):
        # Solo exige responsable al crear un trabajo nuevo (no al editar/actualizar uno existente)
        if self.instance is None and not data.get('responsable'):
            raise serializers.ValidationError({
                'responsable': 'Debes indicar quién de tu empresa encarga este trabajo.'
            })
        return data


class MaquinaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Maquina
        fields = ['id', 'nombre', 'descripcion', 'imagen', 'precio_hora', 'precio_dia', 'precio_semana', 'activo']


class ReservaMaquinaSerializer(serializers.ModelSerializer):
    maquina_nombre = serializers.CharField(source='maquina.nombre', read_only=True)
    cliente_nombre = serializers.CharField(source='cliente.username', read_only=True)

    class Meta:
        model = ReservaMaquina
        fields = [
            'id', 'maquina', 'maquina_nombre', 'cliente', 'cliente_nombre',
            'fecha_inicio', 'fecha_fin', 'modalidad_entrega', 'direccion_entrega',
            'estado', 'created_at'
        ]
        read_only_fields = ['cliente', 'estado']

class ProductoFerreteriaSerializer(serializers.ModelSerializer):
    categoria_display = serializers.CharField(source='get_categoria_display', read_only=True)

    class Meta:
        model = ProductoFerreteria
        fields = ['id', 'nombre', 'sku', 'descripcion', 'categoria', 'categoria_display', 'precio', 'imagen', 'activo']

class ItemPedidoFerreteriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemPedidoFerreteria
        fields = ['id', 'producto', 'nombre', 'sku', 'precio', 'cantidad']


class PedidoFerreteriaSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.CharField(source='cliente.username', read_only=True)
    empresa_nombre = serializers.CharField(source='cliente.empresa.nombre', read_only=True, default=None)
    responsable_nombre = serializers.CharField(source='responsable.nombre', read_only=True, default=None)
    categoria_display = serializers.CharField(source='get_categoria_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    items = ItemPedidoFerreteriaSerializer(many=True, read_only=True)

    class Meta:
        model = PedidoFerreteria
        fields = [
            'id', 'cliente', 'cliente_nombre', 'empresa_nombre',
            'responsable', 'responsable_nombre', 'categoria', 'categoria_display',
            'centro_costo', 'estado', 'estado_display', 'items', 'created_at'
        ]
        read_only_fields = ['cliente', 'estado']
