import functools
import logging
import threading

from django.db import connections, transaction

logger = logging.getLogger(__name__)

# Marca si el hilo actual ya es un hilo de segundo plano, para que una
# función decorada que llama a otra decorada (ej. _notificar_nuevo_trabajo
# -> _notificar_admins_push -> enviar_push) no abra un hilo nuevo por cada
# llamada: dentro del hilo de fondo se ejecutan directo.
_estado = threading.local()


def en_segundo_plano(func):
    """
    Ejecuta la función en un hilo aparte, para que la respuesta HTTP no
    tenga que esperar a que terminen los correos (SMTP) ni los push.

    Se lanza con transaction.on_commit, así el hilo siempre ve en la base
    de datos lo que la petición acaba de guardar.
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        if getattr(_estado, 'en_fondo', False):
            return func(*args, **kwargs)

        def ejecutar():
            _estado.en_fondo = True
            try:
                func(*args, **kwargs)
            except Exception:
                logger.exception('Error en tarea de segundo plano %s', func.__name__)
            finally:
                # Cada hilo abre su propia conexión a la base de datos;
                # hay que cerrarla para no dejar conexiones colgando en MySQL.
                connections.close_all()

        transaction.on_commit(
            lambda: threading.Thread(target=ejecutar, name=func.__name__).start()
        )

    return wrapper
