/**
 * Monta la plantilla real en un DOM de jsdom.
 *
 * jsdom se instancia a mano en vez de usar `environment: "jsdom"` porque en ese
 * entorno Vitest transforma los módulos en modo "web", y los componentes .astro
 * solo compilan en modo SSR. Rindiendo en node y montando el DOM aparte,
 * las pruebas usan el markup de verdad y no una copia escrita a mano que se
 * desactualiza sola.
 */
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { JSDOM } from "jsdom";

import BarraHerramientas from "../src/components/BarraHerramientas.astro";
import DatosCliente from "../src/components/DatosCliente.astro";
import EncabezadoCotizacion from "../src/components/EncabezadoCotizacion.astro";
import PieCotizacion from "../src/components/PieCotizacion.astro";
import ResumenTotales from "../src/components/ResumenTotales.astro";
import TablaProductos from "../src/components/TablaProductos.astro";

const DE_LA_HOJA = [EncabezadoCotizacion, DatosCliente, TablaProductos, ResumenTotales, PieCotizacion];

/** Globales del navegador que necesita `cotizador.js`. */
const GLOBALES = [
  "window",
  "document",
  "localStorage",
  "location",
  "Event",
  "KeyboardEvent",
  "MouseEvent",
  "Node",
  "HTMLElement",
  "HTMLAnchorElement",
  "URL",
  "Blob",
];

export async function montarPlantilla() {
  const container = await AstroContainer.create();
  const partes = await Promise.all(DE_LA_HOJA.map((c) => container.renderToString(c)));
  const barra = await container.renderToString(BarraHerramientas);

  const dom = new JSDOM(
    `<!doctype html><html lang="es"><body>${barra}` +
      `<main class="hoja"><div class="hoja__cuerpo">${partes.join("")}</div></main>` +
      `</body></html>`,
    { url: "http://localhost/" }
  );

  for (const clave of GLOBALES) {
    // Node ya trae URL y Blob: hay que devolverlos como estaban al desmontar,
    // o el siguiente `AstroContainer.create()` se queda sin URL.
    previos.set(clave, Object.getOwnPropertyDescriptor(globalThis, clave));
    globalThis[clave] = dom.window[clave];
  }

  dom.window.localStorage.clear();
  return dom.window;
}

const previos = new Map();

export function desmontarPlantilla() {
  for (const [clave, descriptor] of previos) {
    if (descriptor) {
      Object.defineProperty(globalThis, clave, descriptor);
    } else {
      delete globalThis[clave];
    }
  }
  previos.clear();
}
