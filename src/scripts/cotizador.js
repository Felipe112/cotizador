/**
 * Lógica de la plantilla de cotización:
 *  - numera las filas,
 *  - multiplica cantidad × precio por renglón,
 *  - suma subtotal, descuento, impuesto y total general,
 *  - agrega / quita filas,
 *  - guarda lo escrito en el navegador y lo restaura al volver.
 */

import {
  calcularTotales,
  crearFormateador,
  crearFormateadorCifra,
  textoArticulos,
} from "./calculo.js";

const ALMACEN = "cotizador:v1";

const cuerpo = document.getElementById("cuerpo-productos");
const molde = document.getElementById("molde-fila");
const btnAgregar = document.getElementById("btn-agregar");
const btnImprimir = document.getElementById("btn-imprimir");
const btnLimpiar = document.getElementById("btn-limpiar");
const selMoneda = document.getElementById("moneda");
const inpDescuento = document.getElementById("descuento");
const inpImpuesto = document.getElementById("impuesto");
const aviso = document.getElementById("aviso-guardado");

const salidas = {
  subtotal: document.getElementById("subtotal"),
  descuento: document.getElementById("monto-descuento"),
  impuesto: document.getElementById("monto-impuesto"),
  total: document.getElementById("total-general"),
  conteo: document.getElementById("conteo-articulos"),
};

/* ---------- Formato de dinero ---------- */

let formateador = crearFormateador(selMoneda?.value ?? "COP");

const formateadorCifra = crearFormateadorCifra();

function dinero(valor) {
  return formateador.format(Number.isFinite(valor) ? valor : 0);
}

/** Monto sin código de moneda, para las columnas de la tabla. */
function cifra(valor) {
  return formateadorCifra.format(Number.isFinite(valor) ? valor : 0);
}

/* ---------- Cálculo ---------- */

/** Último resultado calculado; lo reusa la exportación a PDF. */
let ultimoCalculo = { filas: [] };

function filas() {
  return Array.from(cuerpo.querySelectorAll(".fila-producto"));
}

/** Lee las filas del DOM tal como están escritas. */
function leerFilas() {
  return filas().map((fila) => ({
    elemento: fila,
    desc: fila.querySelector(".campo--desc").value,
    cant: fila.querySelector(".js-cantidad").value,
    precio: fila.querySelector(".js-precio").value,
  }));
}

function recalcular() {
  const resultado = calcularTotales({
    filas: leerFilas(),
    descuento: inpDescuento?.value,
    impuesto: inpImpuesto?.value,
  });

  resultado.filas.forEach((fila, i) => {
    const contador = fila.elemento.querySelector(".contador");
    if (contador) contador.textContent = String(i + 1);

    const celda = fila.elemento.querySelector(".js-total-fila");
    if (celda) {
      celda.textContent = fila.vacia ? "—" : cifra(fila.total);
      celda.dataset.vacio = fila.vacia ? "1" : "0";
    }
  });

  salidas.subtotal.textContent = dinero(resultado.subtotal);
  salidas.descuento.textContent =
    resultado.montoDescuento > 0 ? `− ${dinero(resultado.montoDescuento)}` : dinero(0);
  salidas.impuesto.textContent = dinero(resultado.montoImpuesto);
  salidas.total.textContent = dinero(resultado.total);
  salidas.conteo.textContent = textoArticulos(resultado.articulos);

  ultimoCalculo = resultado;
}

/* ---------- Filas ---------- */

function agregarFila(datos) {
  const nueva = molde.content.firstElementChild.cloneNode(true);
  if (datos) {
    nueva.querySelector(".campo--desc").value = datos.desc ?? "";
    nueva.querySelector(".js-cantidad").value = datos.cant ?? "";
    nueva.querySelector(".js-precio").value = datos.precio ?? "";
  }
  cuerpo.appendChild(nueva);
  recalcular();
  return nueva;
}

cuerpo.addEventListener("input", () => {
  recalcular();
  guardarDiferido();
});

cuerpo.addEventListener("click", (evento) => {
  const boton = evento.target.closest(".js-quitar");
  if (!boton) return;

  // Siempre queda al menos una fila: si es la última, se vacía en vez de borrarse.
  if (filas().length === 1) {
    boton.closest(".fila-producto").querySelectorAll("input").forEach((i) => (i.value = ""));
  } else {
    boton.closest(".fila-producto").remove();
  }
  recalcular();
  guardarDiferido();
});

/**
 * Tabular desde el precio de la última fila crea la siguiente y salta a su
 * descripción. Permite cargar muchos productos seguidos sin tocar el ratón.
 * Solo actúa si la fila tiene algo escrito, para no generar filas en balde.
 */
cuerpo.addEventListener("keydown", (evento) => {
  if (evento.key !== "Tab" || evento.shiftKey || evento.altKey || evento.metaKey) return;

  const precio = evento.target.closest(".js-precio");
  if (!precio) return;

  const fila = precio.closest(".fila-producto");
  const todas = filas();
  if (fila !== todas[todas.length - 1]) return;

  const conContenido =
    fila.querySelector(".campo--desc").value.trim() ||
    fila.querySelector(".js-cantidad").value.trim() ||
    precio.value.trim();
  if (!conContenido) return;

  evento.preventDefault();
  agregarFila().querySelector(".campo--desc").focus();
  guardarDiferido();
});

btnAgregar?.addEventListener("click", () => {
  const fila = agregarFila();
  fila.querySelector(".campo--desc")?.focus();
  guardarDiferido();
});

/* ---------- Controles del resumen ---------- */

[inpDescuento, inpImpuesto].forEach((campo) =>
  campo?.addEventListener("input", () => {
    recalcular();
    guardarDiferido();
  })
);

selMoneda?.addEventListener("change", () => {
  formateador = crearFormateador(selMoneda.value);
  recalcular();
  guardarDiferido();
});

btnImprimir?.addEventListener("click", () => window.print());

/* ---------- Exportar a PDF en una pestaña nueva ---------- */

function valorPorEtiqueta(etiqueta) {
  const el = document.querySelector(`.hoja [aria-label="${etiqueta}"]`);
  return el ? el.value.trim() : "";
}

/**
 * La fecha de emisión no se edita: siempre es hoy.
 * Se fija aquí, no en el HTML, porque el sitio es estático y la fecha del
 * build quedaría congelada para todos los que abran la página después.
 */
const elFecha = document.getElementById("fecha-actual");

function fijarFechaDeHoy() {
  if (!elFecha) return;
  const hoy = new Date();
  const iso = [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, "0"),
    String(hoy.getDate()).padStart(2, "0"),
  ].join("-");

  elFecha.dateTime = iso;
  elFecha.textContent = iso.split("-").reverse().join("/");
}

function recolectar() {
  return {
    empresa: valorPorEtiqueta("Nombre de la empresa"),
    cliente: valorPorEtiqueta("Nombre del cliente"),
    detalleCliente: valorPorEtiqueta("Datos de contacto del cliente"),
    folio: valorPorEtiqueta("Número de cotización"),
    fecha: elFecha?.dateTime ?? "",
    vence: valorPorEtiqueta("Fecha de vencimiento"),
    notas: valorPorEtiqueta("Notas y condiciones"),
    contacto: valorPorEtiqueta("Datos de contacto de tu empresa"),
    moneda: selMoneda?.value ?? "COP",
    dinero,
    cifra,
    ...ultimoCalculo,
    filas: ultimoCalculo.filas
      // Un renglón del todo vacío no aporta nada al PDF impreso.
      .filter((f) => f.desc.trim() || !f.vacia)
      .map(({ desc, cant, precio, total }) => ({ desc: desc.trim(), cant, precio, total })),
  };
}

async function exportarAPdf(boton) {
  const datos = recolectar();

  if (!datos.filas.length) {
    anunciar("Agrega al menos un producto antes de exportar", true);
    return;
  }

  // La pestaña se abre AQUÍ, dentro del clic: si se abriera después de
  // generar el PDF, el bloqueador de ventanas emergentes la cancelaría.
  const pestana = window.open("", "_blank");

  // Se guarda el innerHTML para no perder el ícono del botón al restaurarlo.
  const contenidoOriginal = boton?.innerHTML;
  if (boton) {
    boton.disabled = true;
    boton.textContent = "Generando…";
  }

  try {
    const { exportarPDF, nombreArchivo } = await import("./pdf.js");
    const doc = await exportarPDF(datos);
    const nombre = nombreArchivo(datos);
    const url = URL.createObjectURL(doc.output("blob"));

    if (pestana && !pestana.closed) {
      pestana.location.href = url;
      anunciar("PDF abierto en una pestaña nueva");
    } else {
      // Sin permiso para abrir pestañas: se descarga el archivo.
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = nombre;
      enlace.click();
      anunciar("El navegador bloqueó la pestaña: el PDF se descargó");
    }

    // El visor ya tiene el archivo cargado; liberar la memoria más tarde.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    pestana?.close();
    console.error(error);
    anunciar("No se pudo generar el PDF", true);
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.innerHTML = contenidoOriginal;
    }
  }
}

document.querySelectorAll(".js-exportar-pdf").forEach((boton) =>
  boton.addEventListener("click", () => exportarAPdf(boton))
);


btnLimpiar?.addEventListener("click", () => {
  const ok = window.confirm("¿Borrar todo lo escrito en esta cotización?");
  if (!ok) return;
  localStorage.removeItem(ALMACEN);
  location.reload();
});

/* ---------- Guardado local ---------- */

// Los campos fijos se identifican por su aria-label, que es único en la página.
function camposFijos() {
  return Array.from(
    document.querySelectorAll(".hoja input[aria-label], .hoja textarea[aria-label], .hoja select[aria-label]")
  ).filter((el) => !cuerpo.contains(el));
}

function guardar() {
  const estado = {
    campos: {},
    filas: filas().map((fila) => ({
      desc: fila.querySelector(".campo--desc").value,
      cant: fila.querySelector(".js-cantidad").value,
      precio: fila.querySelector(".js-precio").value,
    })),
  };

  camposFijos().forEach((el) => {
    estado.campos[el.getAttribute("aria-label")] = el.value;
  });

  try {
    localStorage.setItem(ALMACEN, JSON.stringify(estado));
    anunciar("Guardado en este navegador");
  } catch {
    /* Modo privado o almacenamiento lleno: la plantilla sigue funcionando. */
  }
}

let temporizador;
function guardarDiferido() {
  clearTimeout(temporizador);
  temporizador = setTimeout(guardar, 500);
}

function restaurar() {
  let estado;
  try {
    estado = JSON.parse(localStorage.getItem(ALMACEN) ?? "null");
  } catch {
    estado = null;
  }
  if (!estado) return;

  camposFijos().forEach((el) => {
    const valor = estado.campos?.[el.getAttribute("aria-label")];
    if (typeof valor === "string") el.value = valor;
  });

  if (Array.isArray(estado.filas) && estado.filas.length) {
    cuerpo.innerHTML = "";
    estado.filas.forEach((datos) => agregarFila(datos));
  }

  formateador = crearFormateador(selMoneda?.value ?? "COP");
}

let avisoTimer;
function anunciar(texto, esError = false) {
  if (!aviso) return;
  aviso.textContent = texto;
  aviso.dataset.error = esError ? "1" : "0";
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => (aviso.textContent = ""), esError ? 4000 : 2500);
}

document.addEventListener("input", (evento) => {
  if (evento.target.closest(".hoja") && !cuerpo.contains(evento.target)) guardarDiferido();
});

fijarFechaDeHoy();
restaurar();
recalcular();
