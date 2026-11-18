from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0049_prensado_flexibles'),
    ]

    operations = [
        # default=True: las cotizaciones ya generadas también quedan bloqueadas.
        migrations.AddField(
            model_name='cotizacion',
            name='bloqueada',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='cotizacion',
            name='numero_factura',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='cotizacion',
            name='fecha_factura',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
