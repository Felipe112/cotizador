# Cotizador

Plantilla de cotización en Astro: se llena en pantalla, se calcula sola y se
exporta a PDF A4 en una pestaña nueva.

El proyecto usa **pnpm** (fijado con `packageManager` en `package.json`).

```bash
pnpm install
pnpm dev             # http://localhost:4321
pnpm build
pnpm test
pnpm test:coverage
```

## Estructura

```
src/
├─ components/     # encabezado, datos del cliente, tabla, totales, pie
├─ layouts/Layout.astro
├─ pages/index.astro
├─ scripts/
│  ├─ calculo.js   # aritmética pura, sin DOM
│  ├─ cotizador.js # une el DOM con el cálculo: filas, guardado, PDF
│  └─ pdf.js       # dibuja el PDF con jsPDF (carga diferida)
└─ styles/global.css
tests/             # vitest: calculo, pdf y DOM
```

## Detalles que no se ven en el código

- **La fecha de emisión se fija en el cliente**, no en el HTML: el sitio es
  estático y la fecha del build quedaría congelada.
- **"Válida hasta" propone hoy + 7 días** y se recalcula en cada visita, salvo
  que el usuario la haya cambiado a mano (`data-tocado`).
- **La pestaña del PDF se abre dentro del clic**, antes de generar el archivo.
  Al revés, el bloqueador de ventanas emergentes la cancela.
- **Los montos de la tabla van sin moneda**; el código ISO solo aparece en los
  totales.
- **Las pruebas de DOM montan los componentes .astro reales** en un jsdom hecho
  a mano (`tests/plantilla.js`), porque con `environment: "jsdom"` Vitest
  transforma en modo web y los .astro solo compilan en modo SSR.

## Personalizar

- Colores: variables `--brand-*` y `--accent-*` en `src/styles/global.css`.
- Diseño del PDF: paleta `C`, columnas `COL` y márgenes en `src/scripts/pdf.js`.
- Impuesto por defecto: `<ResumenTotales impuesto={19} />` en `src/pages/index.astro`.
