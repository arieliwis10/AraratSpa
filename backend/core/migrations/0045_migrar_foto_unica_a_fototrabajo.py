from django.db import migrations


def copiar_fotos(apps, schema_editor):
    TrabajoMaestranza = apps.get_model('core', 'TrabajoMaestranza')
    FotoTrabajo = apps.get_model('core', 'FotoTrabajo')
    for trabajo in TrabajoMaestranza.objects.exclude(foto='').exclude(foto__isnull=True):
        FotoTrabajo.objects.create(trabajo=trabajo, imagen=trabajo.foto)


def revertir(apps, schema_editor):
    # No borramos nada al revertir: el campo 'foto' original queda intacto.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0044_fototrabajo'),
    ]

    operations = [
        migrations.RunPython(copiar_fotos, revertir),
    ]