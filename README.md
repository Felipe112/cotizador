# Cotizador

Plantilla de cotización en Astro: una hoja limpia, editable directo en pantalla,
que se calcula sola y se imprime o exporta a PDF en tamaño A4.

## Uso

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # sitio estático en dist/
npm run preview
npm test         # pruebas unitarias (vitest)
npm run test:watch
```

## Qué incluye

- **Encabezado**: nombre de empresa, eslogan y el título *Cotización*.
- **Datos del cliente en dos renglones**: cliente + n.º de cotización; contacto + fecha y vigencia.
  La fecha se llena con el día actual.
- **Tabla de productos**: contador automático, nombre, cantidad, precio unitario y
  total por renglón (`cantidad × precio`). Botón para agregar filas, botón `×` para quitarlas.
  Tabular desde el precio de la última fila crea la siguiente y salta a su descripción,
  para cargar muchos productos sin soltar el teclado. Los montos de la tabla van sin
  código de moneda: solo aparece en los totales.
- **Resumen**: subtotal, descuento %, impuesto % y **total general**. Selector de moneda.
- **Pie**: firma autorizada y datos de contacto.
- **Exportar a PDF**: botón al final de la hoja (y en la barra superior). Abre el PDF
  en una **pestaña nueva**, en A4, con texto vectorial seleccionable y buscable —no es
  una captura de pantalla—. Si el navegador bloquea la pestaña emergente, el archivo se descarga.
- **Guardado local**: lo escrito se conserva en el navegador (localStorage) y vuelve al recargar.
  "Limpiar todo" lo borra.

## Estructura

```
src/
├─ components/
│  ├─ BarraHerramientas.astro   # botones (no se imprimen)
│  ├─ EncabezadoCotizacion.astro
│  ├─ DatosCliente.astro
│  ├─ TablaProductos.astro
│  ├─ ResumenTotales.astro
│  └─ PieCotizacion.astro
├─ layouts/Layout.astro
├─ pages/index.astro
├─ scripts/
│  ├─ calculo.js                # aritmética pura, sin DOM
│  ├─ cotizador.js              # une el DOM con el cálculo: filas, guardado, PDF
│  └─ pdf.js                    # dibuja el PDF A4 con jsPDF (carga diferida)
└─ styles/global.css            # paleta azul/verde + estilos de impresión
```

## Pruebas

`npm test` (vitest). Tres archivos:

- `tests/calculo.test.js` — la aritmética: multiplicación por fila, subtotal,
  orden descuento → impuesto, recorte de porcentajes, campos con basura.
- `tests/pdf.test.js` — generación del PDF: páginas, salto de página, casos sin
  empresa / sin folio / sin notas, nombre de archivo, y que la tabla se dibuje
  sin código de moneda.
- `tests/dom.test.js` — la plantilla viva: agregar y quitar filas, renumerado,
  tabulador que encadena productos, guardado y restauración, y que la pestaña
  del PDF se abra dentro del clic.

Las pruebas de DOM montan los componentes .astro de verdad con la Container API
y los meten en un jsdom creado a mano (`tests/plantilla.js`). Se hace así porque
Vitest, con `environment: "jsdom"`, transforma los módulos en modo web y los
.astro solo compilan en modo SSR. La ventaja: si alguien renombra un id o una
clase de un componente, las pruebas se rompen.

## Personalizar

Los colores viven en las variables CSS de `src/styles/global.css` (`:root`):
`--brand-*` para los azules y `--accent-*` para los verdes. Cambiar ahí se refleja
en toda la plantilla, incluida la impresión.

Para cambiar el número de filas iniciales: `filasIniciales` en `TablaProductos.astro`.
El diseño del PDF vive en `src/scripts/pdf.js`: la paleta está en la constante `C`
y las columnas de la tabla en `COL`.

Para un impuesto por defecto: `<ResumenTotales impuesto={16} />` en `src/pages/index.astro`.
