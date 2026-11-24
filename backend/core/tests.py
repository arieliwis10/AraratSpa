from django.test import TestCase
from rest_framework.test import APIClient

from .models import Usuario, Cotizacion, Empresa, Responsable, TrabajoMaestranza


class BloqueoYFacturaCotizacionTests(TestCase):
    """Generar la cotización la bloquea (desbloqueo con clave); la factura la cierra para siempre."""

    def setUp(self):
        self.admin = Usuario.objects.create_user('admin', password='clave-admin', rol='ADMIN')
        self.api = APIClient()
        self.api.force_authenticate(self.admin)
        res = self.api.post('/api/cotizaciones/', {
            'mandante': 'Cliente', 'items': [], 'subtotal': '0', 'iva': '0', 'total': '0',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.cotizacion_id = res.data['id']
        self.url = f'/api/cotizaciones/{self.cotizacion_id}/'

    def _editar(self):
        return self.api.patch(self.url, {'obra': 'Obra nueva'}, format='json')

    def test_flujo_completo(self):
        # Recién generada: bloqueada, no se edita ni se elimina.
        self.assertTrue(Cotizacion.objects.get(pk=self.cotizacion_id).bloqueada)
        self.assertEqual(self._editar().status_code, 403)
        self.assertEqual(self.api.delete(self.url).status_code, 403)
        # Un PATCH normal no puede saltarse la clave.
        self.api.patch(self.url, {'bloqueada': False}, format='json')
        self.assertTrue(Cotizacion.objects.get(pk=self.cotizacion_id).bloqueada)

        # Desbloqueo: clave incorrecta falla, la correcta funciona.
        self.assertEqual(self.api.patch(self.url + 'desbloquear/', {'clave': 'mala'}).status_code, 400)
        self.assertEqual(self.api.patch(self.url + 'desbloquear/', {'clave': 'clave-admin'}).status_code, 200)

        # Editar (= volver a generar el PDF) la deja bloqueada otra vez.
        res = self._editar()
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['bloqueada'])
        self.assertEqual(self._editar().status_code, 403)

        # Factura: la cierra y ya no se puede desbloquear ni eliminar.
        res = self.api.patch(self.url + 'registrar_factura/', {'numero_factura': ' 12345 '})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['numero_factura'], '12345')
        self.assertEqual(self.api.patch(self.url + 'desbloquear/', {'clave': 'clave-admin'}).status_code, 400)
        self.assertEqual(self._editar().status_code, 403)
        self.assertEqual(self.api.delete(self.url).status_code, 403)
        self.assertEqual(self.api.patch(self.url + 'registrar_factura/', {'numero_factura': '999'}).status_code, 400)

    def test_trabajo_replica_estado_de_su_cotizacion(self):
        empresa = Empresa.objects.create(nombre='Empresa Test')
        responsable = Responsable.objects.create(empresa=empresa, nombre='Encargado')
        cliente = Usuario.objects.create_user('cliente', password='x', rol='CLIENTE', empresa=empresa)
        trabajo = TrabajoMaestranza.objects.create(
            cliente=cliente, responsable=responsable, categoria='SOLDADURA',
            descripcion='Soldar', centro_costo='CC1', estado='TERMINADO', avance=100,
        )
        url_trabajos = '/api/trabajos-maestranza/'

        def fila():
            return next(t for t in self.api.get(url_trabajos).data if t['id'] == trabajo.id)

        def estado():
            f = fila()
            return f['estado_cotizacion'], f['numero_factura']

        self.assertEqual(estado(), (None, None))
        res = self.api.post('/api/cotizaciones/', {
            'trabajo': trabajo.id, 'items': [], 'subtotal': '0', 'iva': '0', 'total': '0',
        }, format='json')
        url = f"/api/cotizaciones/{res.data['id']}/"
        self.assertEqual(estado(), ('BLOQUEADA', None))
        self.api.patch(url + 'desbloquear/', {'clave': 'clave-admin'})
        self.assertEqual(estado(), ('DESBLOQUEADA', None))
        self.api.patch(url + 'registrar_factura/', {'numero_factura': '777'})
        self.assertEqual(estado(), ('FACTURADA', '777'))
        self.assertIsNotNone(fila()['fecha_factura'])

        # El cliente ve lo mismo en su panel.
        self.api.force_authenticate(cliente)
        self.assertEqual(estado(), ('FACTURADA', '777'))

    def test_eliminar_tras_desbloquear(self):
        self.api.patch(self.url + 'desbloquear/', {'clave': 'clave-admin'})
        self.assertEqual(self.api.delete(self.url).status_code, 204)


class FichaFlexibleTests(TestCase):
    """El admin puede corregir la ficha del flexible; si ya se descontó stock, se reajusta."""

    def setUp(self):
        from .models import ProductoFlexible, FlexibleDetalle
        empresa = Empresa.objects.create(nombre='Empresa Test')
        responsable = Responsable.objects.create(empresa=empresa, nombre='Encargado')
        self.cliente = Usuario.objects.create_user('cliente', password='x', rol='CLIENTE', empresa=empresa)
        self.admin = Usuario.objects.create_user('admin', password='x', rol='ADMIN')
        self.trabajo = TrabajoMaestranza.objects.create(
            cliente=self.cliente, responsable=responsable, categoria='FLEXIBLES',
            descripcion='Flexible', centro_costo='CC1',
        )
        nuevo = lambda **kw: ProductoFlexible.objects.create(diametro='1/2"', **kw)
        self.manguera = nuevo(categoria='MANGUERA', nombre='R2', unidad_medida='METRO', precio=1000, stock_actual=10)
        self.terminal = nuevo(categoria='TERMINAL', nombre='JIC', unidad_medida='UNIDAD', precio=500, stock_actual=10)
        self.ferula = nuevo(categoria='FERULA', nombre='F', unidad_medida='UNIDAD', precio=200, stock_actual=10)
        FlexibleDetalle.objects.create(
            trabajo=self.trabajo, manguera=self.manguera, largo_metros=2,
            terminal_entrada=self.terminal, terminal_salida=self.terminal,
            ferula=self.ferula, cantidad_ferulas=2,
        )
        self.api = APIClient()
        self.api.force_authenticate(self.admin)
        self.url = f'/api/trabajos-maestranza/{self.trabajo.id}/'
        self.assertEqual(self.api.patch(self.url + 'marcar_completado/').status_code, 200)
        self.manguera.refresh_from_db()
        self.assertEqual(self.manguera.stock_actual, 8)

    def test_corregir_ficha_reajusta_stock(self):
        res = self.api.post(self.url + 'guardar_detalle_flexible/', {'largo_metros': '3'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.manguera.refresh_from_db()
        self.terminal.refresh_from_db()
        self.assertEqual(self.manguera.stock_actual, 7)
        self.assertEqual(self.terminal.stock_actual, 8)
        self.assertEqual(float(res.data['precio_sugerido']), 3 * 1000 + 2 * 500 + 2 * 200)

    def test_corregir_sin_stock_no_cambia_nada(self):
        res = self.api.post(self.url + 'guardar_detalle_flexible/', {'largo_metros': '50'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('productos_faltantes', res.data)
        self.manguera.refresh_from_db()
        self.assertEqual(self.manguera.stock_actual, 8)
        self.assertEqual(float(self.trabajo.detalle_flexible.largo_metros), 2)

    def test_cambiar_solo_precio_no_mueve_stock(self):
        res = self.api.post(self.url + 'guardar_detalle_flexible/', {'precio_total': '9999'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.manguera.refresh_from_db()
        self.assertEqual(self.manguera.stock_actual, 8)

    def test_cliente_no_puede_editar_ficha(self):
        self.api.force_authenticate(self.cliente)
        res = self.api.post(self.url + 'guardar_detalle_flexible/', {'largo_metros': '1'}, format='json')
        self.assertEqual(res.status_code, 403)


class PapeleraTrabajosTests(TestCase):
    """Eliminar un trabajo lo manda a la papelera; desde ahí se restaura o se borra para siempre."""

    def setUp(self):
        self.admin = Usuario.objects.create_user('admin', password='x', rol='ADMIN', first_name='Ana')
        self.empresa = Empresa.objects.create(nombre='Minera Sur')
        self.cliente = Usuario.objects.create_user('cli', password='x', rol='CLIENTE', empresa=self.empresa)
        self.trabajo = TrabajoMaestranza.objects.create(
            cliente=self.cliente, categoria='SOLDADURA', descripcion='Soldar estanque', centro_costo='CC1',
        )
        self.api = APIClient()
        self.api.force_authenticate(self.admin)
        self.url = f'/api/trabajos-maestranza/{self.trabajo.id}/'

    def _ids(self, user):
        api = APIClient()
        api.force_authenticate(user)
        return [t['id'] for t in api.get('/api/trabajos-maestranza/').data]

    def test_eliminar_restaurar_y_definitivo(self):
        from .models import HistorialEliminacion, MaterialUsado
        MaterialUsado.objects.create(trabajo=self.trabajo, nombre='Electrodo', cantidad='2 kg')

        self.assertEqual(self.api.delete(self.url).status_code, 204)
        # Oculto para admin y cliente, pero sigue existiendo con sus materiales.
        self.assertNotIn(self.trabajo.id, self._ids(self.admin))
        self.assertNotIn(self.trabajo.id, self._ids(self.cliente))
        self.assertEqual(self.api.get(self.url).status_code, 404)
        self.assertEqual(MaterialUsado.objects.filter(trabajo_id=self.trabajo.id).count(), 1)
        self.assertFalse(HistorialEliminacion.objects.exists())

        papelera = self.api.get('/api/trabajos-maestranza/papelera/').data
        self.assertEqual([t['id'] for t in papelera], [self.trabajo.id])
        self.assertEqual(papelera[0]['eliminado_por_nombre'], 'Ana')

        # El cliente no puede ver ni tocar la papelera.
        api_cli = APIClient()
        api_cli.force_authenticate(self.cliente)
        self.assertEqual(api_cli.get('/api/trabajos-maestranza/papelera/').status_code, 403)

        # Un trabajo nuevo no reutiliza el número del que está en la papelera.
        nuevo = TrabajoMaestranza.objects.create(
            cliente=self.cliente, categoria='TORNO', descripcion='x', centro_costo='y',
        )
        self.assertEqual(nuevo.correlativo, self.trabajo.correlativo + 1)

        # Restaurar lo devuelve tal cual.
        self.assertEqual(self.api.post(self.url + 'restaurar/').status_code, 200)
        self.assertIn(self.trabajo.id, self._ids(self.admin))
        self.assertEqual(self.api.get('/api/trabajos-maestranza/papelera/').data, [])

        # Eliminar definitivo solo funciona desde la papelera, y deja historial.
        self.assertEqual(self.api.delete(self.url + 'eliminar_definitivo/').status_code, 404)
        self.api.delete(self.url)
        self.assertEqual(self.api.delete(self.url + 'eliminar_definitivo/').status_code, 204)
        self.assertFalse(TrabajoMaestranza.todos.filter(pk=self.trabajo.id).exists())
        registro = HistorialEliminacion.objects.get()
        self.assertEqual(registro.detalle['datos']['materiales'], [{'nombre': 'Electrodo', 'cantidad': '2 kg'}])
        self.assertEqual(registro.detalle['orden_trabajo'], f'#{self.trabajo.correlativo} Soldadura')

        # ...y desde el historial se puede recuperar con sus materiales.
        res = self.api.post(f'/api/historial-eliminaciones/{registro.id}/recuperar_trabajo/', {}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        recuperado = TrabajoMaestranza.objects.get(pk=res.data['trabajo_id'])
        self.assertEqual(recuperado.correlativo, self.trabajo.correlativo)
        self.assertEqual(recuperado.estado, 'PENDIENTE')
        self.assertEqual(recuperado.materiales.count(), 1)

    def test_recuperar_registro_antiguo_del_historial(self):
        """Registros de antes de la papelera: solo texto + fotos por URL."""
        import shutil
        import tempfile
        from django.test import override_settings
        from .models import HistorialEliminacion

        media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media, ignore_errors=True)
        with override_settings(MEDIA_ROOT=media):
            import os
            os.makedirs(os.path.join(media, 'maestranza'))
            open(os.path.join(media, 'maestranza', 'foto 1.jpg'), 'wb').close()

            Responsable.objects.create(empresa=self.empresa, nombre='Pedro')
            registro = HistorialEliminacion.objects.create(
                tipo='Trabajo de Maestranza',
                descripcion='#7 Fabricación de equipos especiales y proyecto - Minera Sur',
                detalle={
                    'descripcion_trabajo': 'Rampa', 'centro_costo': 'CC9', 'responsable': 'Pedro',
                    'fotos': [
                        'https://api.example.com/media/maestranza/foto%201.jpg',
                        'https://api.example.com/media/maestranza/no-existe.jpg',
                    ],
                },
            )
            lista = self.api.get('/api/historial-eliminaciones/').data
            self.assertEqual(lista[0]['detalle']['orden_trabajo'], '#7 Fabricación de equipos especiales y proyecto')
            info = lista[0]['recuperacion']
            self.assertEqual(info['categoria'], 'FABRICACION')
            self.assertEqual(info['correlativo'], 7)
            self.assertEqual(info['cliente_id'], self.cliente.id)  # único cliente de la empresa

            url = f'/api/historial-eliminaciones/{registro.id}/recuperar_trabajo/'
            res = self.api.post(url, {'estado': 'TERMINADO'}, format='json')
            self.assertEqual(res.status_code, 201, res.data)
            self.assertEqual(len(res.data['avisos']), 1)  # 1 de 2 fotos

            t = TrabajoMaestranza.objects.get(pk=res.data['trabajo_id'])
            self.assertEqual((t.correlativo, t.categoria, t.descripcion), (7, 'FABRICACION', 'Rampa'))
            self.assertEqual(t.responsable.nombre, 'Pedro')
            self.assertEqual(t.avance, 100)
            self.assertEqual(t.fecha_termino, registro.fecha)
            self.assertEqual([f.imagen.name for f in t.fotos.all()], ['maestranza/foto 1.jpg'])

            # No se puede recuperar dos veces.
            self.assertEqual(self.api.post(url, {}, format='json').status_code, 400)
            self.assertIsNone(self.api.get('/api/historial-eliminaciones/').data[0]['recuperacion'])


class PapeleraYVinculoCotizacionesTests(TestCase):
    """Eliminar una cotización la manda a la papelera; vincular_trabajo cambia solo su trabajo."""

    def setUp(self):
        self.admin = Usuario.objects.create_user('admin', password='x', rol='ADMIN')
        self.empresa = Empresa.objects.create(nombre='Minera Sur')
        self.cliente = Usuario.objects.create_user('cli', password='x', rol='CLIENTE', empresa=self.empresa)
        self.trabajo = TrabajoMaestranza.objects.create(
            cliente=self.cliente, categoria='SOLDADURA', descripcion='Soldar', centro_costo='CC',
        )
        self.api = APIClient()
        self.api.force_authenticate(self.admin)

    def _crear(self, **extra):
        datos = {'mandante': 'X', 'items': [], 'subtotal': '100', 'iva': '19', 'total': '119', **extra}
        res = self.api.post('/api/cotizaciones/', datos, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        return res.data['id']

    def _desbloquear(self, cid):
        self.api.patch(f'/api/cotizaciones/{cid}/desbloquear/', {'clave': 'x'})

    def test_papelera(self):
        from .models import HistorialEliminacion
        cid = self._crear()
        url = f'/api/cotizaciones/{cid}/'
        # Bloqueada: no se puede mandar a la papelera.
        self.assertEqual(self.api.delete(url).status_code, 403)
        self._desbloquear(cid)
        self.assertEqual(self.api.delete(url).status_code, 204)

        self.assertEqual(self.api.get('/api/cotizaciones/').data, [])
        papelera = self.api.get('/api/cotizaciones/papelera/').data
        self.assertEqual([c['id'] for c in papelera], [cid])
        self.assertFalse(HistorialEliminacion.objects.exists())

        # Una cotización nueva no repite el folio de la que está en la papelera.
        folio_papelera = papelera[0]['folio']
        otra = self._crear()
        self.assertNotEqual(Cotizacion.objects.get(pk=otra).folio, folio_papelera)

        self.assertEqual(self.api.post(url + 'restaurar/').status_code, 200)
        self.assertEqual(len(self.api.get('/api/cotizaciones/').data), 2)

        self.api.delete(url)
        self.assertEqual(self.api.delete(url + 'eliminar_definitivo/').status_code, 204)
        self.assertFalse(Cotizacion.todos.filter(pk=cid).exists())
        registro = HistorialEliminacion.objects.get(tipo='Cotización')
        self.assertEqual(registro.detalle['datos']['total'], '119.00')

    def test_recuperar_cotizacion_desde_historial(self):
        from .models import HistorialEliminacion
        cid = self._crear(trabajo=self.trabajo.id, obra='Galpón', items=[{'detalle': 'Soldadura', 'total': 100}])
        original = Cotizacion.objects.get(pk=cid)
        self._desbloquear(cid)
        url = f'/api/cotizaciones/{cid}/'
        self.api.delete(url)
        self.api.delete(url + 'eliminar_definitivo/')

        lista = self.api.get('/api/historial-eliminaciones/').data
        self.assertEqual(lista[0]['recuperacion']['tipo'], 'cotizacion')
        detalle = lista[0]['detalle']
        self.assertEqual(detalle['orden_trabajo'], f'#{self.trabajo.correlativo} Soldadura')
        self.assertEqual(detalle['descripcion_trabajo'], 'Soldar')
        self.assertEqual(detalle['obra'], 'Galpón')
        self.assertEqual(detalle['items_resumen'], 'Soldadura (x1)')
        self.assertEqual(detalle['total'], '$119')
        rid = lista[0]['id']

        res = self.api.post(f'/api/historial-eliminaciones/{rid}/recuperar_cotizacion/')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['avisos'], [])
        c = Cotizacion.objects.get(pk=res.data['cotizacion_id'])
        self.assertEqual((c.folio, c.obra, c.trabajo_id, c.total), (original.folio, 'Galpón', self.trabajo.id, original.total))
        self.assertEqual(c.items, [{'detalle': 'Soldadura', 'total': 100}])
        self.assertEqual(c.created_at, original.created_at)
        self.assertFalse(c.bloqueada)

        # No se recupera dos veces.
        self.assertEqual(self.api.post(f'/api/historial-eliminaciones/{rid}/recuperar_cotizacion/').status_code, 400)
        self.assertIsNone(self.api.get('/api/historial-eliminaciones/').data[0]['recuperacion'])

    def test_vincular_trabajo_aunque_este_facturada(self):
        cid = self._crear()  # sin trabajo ni empresa
        self.api.patch(f'/api/cotizaciones/{cid}/registrar_factura/', {'numero_factura': '55'})
        url = f'/api/cotizaciones/{cid}/vincular_trabajo/'

        res = self.api.patch(url, {'trabajo': self.trabajo.id}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['trabajo_correlativo'], self.trabajo.correlativo)
        self.assertEqual(res.data['empresa'], self.empresa.id)  # toma la empresa del trabajo
        self.assertEqual(res.data['numero_factura'], '55')

        # Otra empresa: se rechaza.
        otra = Empresa.objects.create(nombre='Otra')
        cli2 = Usuario.objects.create_user('cli2', password='x', rol='CLIENTE', empresa=otra)
        ajeno = TrabajoMaestranza.objects.create(cliente=cli2, categoria='TORNO', descripcion='t', centro_costo='c')
        self.assertEqual(self.api.patch(url, {'trabajo': ajeno.id}, format='json').status_code, 400)

        # Desvincular.
        res = self.api.patch(url, {'trabajo': None}, format='json')
        self.assertIsNone(res.data['trabajo'])

    def test_editar_cotizacion_de_trabajo_en_papelera(self):
        cid = self._crear(trabajo=self.trabajo.id)
        self._desbloquear(cid)
        self.api.delete(f'/api/trabajos-maestranza/{self.trabajo.id}/')
        res = self.api.patch(f'/api/cotizaciones/{cid}/', {'trabajo': self.trabajo.id, 'obra': 'Nueva'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)

    def test_recuperar_trabajo_revincula_cotizaciones(self):
        from .models import HistorialEliminacion
        cid = self._crear(trabajo=self.trabajo.id)
        url = f'/api/trabajos-maestranza/{self.trabajo.id}/'
        self.api.delete(url)
        self.api.delete(url + 'eliminar_definitivo/')
        self.assertIsNone(Cotizacion.objects.get(pk=cid).trabajo)

        registro = HistorialEliminacion.objects.get(tipo='Trabajo de Maestranza')
        res = self.api.post(f'/api/historial-eliminaciones/{registro.id}/recuperar_trabajo/', {}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(Cotizacion.objects.get(pk=cid).trabajo_id, res.data['trabajo_id'])


class FormatosDescripcionHistorialTests(TestCase):
    """El historial guardó los trabajos borrados con dos formatos de texto distintos."""

    def test_ambos_formatos(self):
        from .views import parsear_descripcion_trabajo
        self.assertEqual(parsear_descripcion_trabajo('#12 Soldadura - Minera Sur'), (12, 'Soldadura', 'Minera Sur'))
        self.assertEqual(parsear_descripcion_trabajo('Soldadura #27 — Minera Sur'), (27, 'Soldadura', 'Minera Sur'))
        self.assertEqual(
            parsear_descripcion_trabajo('Fabricación de equipos especiales y proyecto #21 — A - B'),
            (21, 'Fabricación de equipos especiales y proyecto', 'A - B'),
        )
        self.assertIsNone(parsear_descripcion_trabajo('texto cualquiera'))

    def test_orden_trabajo_antigua_de_cotizacion_se_muestra_con_numero_primero(self):
        from .models import HistorialEliminacion
        from .serializers import HistorialEliminacionSerializer
        viejo = HistorialEliminacion.objects.create(tipo='Cotización', descripcion='Folio 1', detalle={'orden_trabajo': 'Soldadura #9'})
        manual = HistorialEliminacion.objects.create(tipo='Cotización', descripcion='Folio 2', detalle={'orden_trabajo': 'OT #55'})
        self.assertEqual(HistorialEliminacionSerializer(viejo).data['detalle']['orden_trabajo'], '#9 Soldadura')
        self.assertEqual(HistorialEliminacionSerializer(manual).data['detalle']['orden_trabajo'], 'OT #55')
