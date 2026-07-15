from rest_framework import serializers
from .models import Usuario, TrabajoMaestranza, MaterialUsado, Maquina, ReservaMaquina


class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'rol', 'telefono']


class UsuarioCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Usuario
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'rol', 'telefono', 'password']

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


class TrabajoMaestranzaSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.CharField(source='cliente.username', read_only=True)
    asignado_a_nombre = serializers.CharField(source='asignado_a.username', read_only=True, default=None)
    categoria_display = serializers.CharField(source='get_categoria_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    materiales = MaterialUsadoSerializer(many=True, read_only=True)

    class Meta:
        model = TrabajoMaestranza
        fields = [
            'id', 'cliente', 'cliente_nombre', 'asignado_a', 'asignado_a_nombre',
            'categoria', 'categoria_display', 'descripcion', 'centro_costo', 'foto',
            'aprobado', 'estado', 'estado_display', 'avance', 'tiempo_entrega',
            'modalidad_entrega', 'direccion_entrega', 'materiales', 'created_at', 'updated_at'
        ]
        read_only_fields = ['cliente']


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