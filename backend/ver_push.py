from django.core.management.base import BaseCommand
from core.models import PushSubscription

class Command(BaseCommand):
    def handle(self, *args, **options):
        for p in PushSubscription.objects.all():
            self.stdout.write(f"{p.usuario} - {p.endpoint[:50]}... - {p.creado}")