from rest_framework import serializers
from .models import (
    Usuario, Empresa, Responsable, TrabajoMaestranza, MaterialUsado,
    ComentarioTrabajo, SolicitudMaterial, Maquina, ReservaMaquina
)


class ResponsableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Responsable
        fields = ['id', 'empresa', 'nombre', 'telefono', 'email']


class EmpresaSerializer(serializers.ModelSerializer):
    responsables = ResponsableSerializer(many=True, read_only=True)

    class Meta:
        model = Empresa
        fields = ['id', 'nombre', 'rut', 'responsables']


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
    trabajo_descripcion = serializers.CharField(source='trabajo.descripcion', read_only=True)
    trabajo_categoria = serializers.CharField(source='trabajo.get_categoria_display', read_only=True)
    trabajo_correlativo = serializers.IntegerField(source='trabajo.correlativo', read_only=True)
    cliente_nombre = serializers.CharField(source='trabajo.cliente.username', read_only=True)
    empresa_nombre = serializers.CharField(source='trabajo.cliente.empresa.nombre', read_only=True, default=None)

    class Meta:
        model = SolicitudMaterial
        fields = [
            'id', 'trabajo', 'trabajo_descripcion', 'trabajo_categoria', 'trabajo_correlativo',
            'cliente_nombre', 'empresa_nombre', 'descripcion', 'estado', 'lugar_compra',
            'created_at', 'resuelto_en'
        ]


class TrabajoMaestranzaSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.CharField(source='cliente.username', read_only=True)
    empresa_nombre = serializers.CharField(source='cliente.empresa.nombre', read_only=True, default=None)
    responsable_nombre = serializers.CharField(source='responsable.nombre', read_only=True, default=None)
    asignado_a_nombre = serializers.CharField(source='asignado_a.username', read_only=True, default=None)
    categoria_display = serializers.CharField(source='get_categoria_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    materiales = MaterialUsadoSerializer(many=True, read_only=True)
    comentarios = ComentarioTrabajoSerializer(many=True, read_only=True)

    class Meta:
        model = TrabajoMaestranza
        fields = [
            'id', 'correlativo', 'cliente', 'cliente_nombre', 'empresa_nombre',
            'responsable', 'responsable_nombre', 'asignado_a', 'asignado_a_nombre',
            'categoria', 'categoria_display', 'descripcion', 'centro_costo', 'foto',
            'aprobado', 'estado', 'estado_display', 'avance', 'tiempo_entrega',
            'modalidad_entrega', 'direccion_entrega', 'retrasado', 'motivo_retraso',
            'fecha_retraso', 'materiales', 'comentarios', 'created_at', 'updated_at'
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