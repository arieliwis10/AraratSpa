import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection
try:
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
        print("Conexión OK:", cursor.fetchone())
except Exception as e:
    print("ERROR DE CONEXIÓN:", e)