/**
 * Genera el PDF de la cotización con jsPDF.
 *
 * No es una captura de pantalla: se dibuja el documento en A4 con texto
 * vectorial, así que el PDF pesa poco, se puede seleccionar y buscar,
 * y se ve nítido a cualquier zoom o al imprimirlo.
 */

/* Paleta, en RGB, espejo de las variables CSS. */
const C = {
  brand900: [11, 61, 77],
  brand800: [15, 80, 104],
  brand700: [20, 104, 128],
  brand500: [42, 140, 166],
  brand100: [223, 240, 244],
  brand050: [240, 248, 250],
  accent600: [16, 145, 114],
  accent700: [11, 122, 95],
  accent500: [23, 166, 127],
  ink: [22, 48, 58],
  inkSoft: [74, 104, 116],
  muted: [125, 151, 161],
  line: [221, 232, 236],
  lineStrong: [195, 214, 221],
  blanco: [255, 255, 255],
};

/* Geometría de la hoja A4, en milímetros. */
const HOJA = { ancho: 210, alto: 297 };
const M = { izq: 16, der: 16, arriba: 18, abajo: 16 };
const X_FIN = HOJA.ancho - M.der;

/* Columnas de la tabla: x inicial y ancho. */
const COL = {
  num: { x: M.izq, w: 10 },
  desc: { x: M.izq + 10, w: 88 },
  cant: { x: M.izq + 98, w: 20 },
  precio: { x: M.izq + 118, w: 28 },
  total: { x: M.izq + 146, w: 32 },
};

/* Línea horizontal del pie. La firma y el contacto se dibujan DEBAJO de ella,
   así que el contenido puede bajar hasta casi tocarla sin pisar nada. */
const Y_LINEA_PIE = HOJA.alto - M.abajo - 14;

/* Hasta dónde pueden llegar las filas y los totales en cualquier página. */
const LIMITE_CONTENIDO = Y_LINEA_PIE - 5;

/* Dónde empieza la columna de totales. Las notas ocupan lo que queda a la
   izquierda, así que moviendo esta línea se reparte el ancho entre ambos. */
const X_TOTALES = HOJA.ancho / 2 - 2;

export async function exportarPDF(datos) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

  doc.setProperties({
    title: `Cotización ${datos.folio || ""}`.trim(),
    subject: datos.cliente ? `Cotización para ${datos.cliente}` : "Cotización",
    author: datos.empresa || "Cotizador",
    creator: "Cotizador",
  });

  let y = dibujarEncabezado(doc, datos);
  y = dibujarDatosCliente(doc, datos, y + 9);
  y = dibujarTabla(doc, datos, y + 10);

  /* Notas y totales arrancan a la misma altura, separados de la tabla. */
  const { yInicio } = dibujarTotales(doc, datos, y + 16);
  dibujarNotas(doc, datos, yInicio);
  dibujarPies(doc, datos);

  return doc;
}

/* ---------- Encabezado ---------- */

function dibujarEncabezado(doc, datos) {
  const y = M.arriba;
  const empresa = (datos.empresa || "").trim();

  /* Sin nombre de empresa no se dibuja la marca: el título sube y ocupa su lugar. */
  if (empresa) {
    dibujarLogo(doc, M.izq, y - 4, 6.5);
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...C.brand900);
    doc.text(empresa, M.izq + 17, y + 4.3);
  }

  /* Línea del título: franja azul · COTIZACIÓN · N.º de cotización · franja verde. */
  const yTitulo = empresa ? y + 22 : y + 8;
  const titulo = "COTIZACIÓN";
  const folio = (datos.folio || "").trim();
  const anchoVerde = 12;
  const xVerde = X_FIN - anchoVerde;

  doc.setFont("helvetica", "bold").setFontSize(26);
  const anchoTitulo = doc.getTextWidth(titulo);

  /* El folio se coloca desde la derecha; el título se acomoda a lo que quede. */
  doc.setFont("helvetica", "normal").setFontSize(9.5);
  const anchoEtiqueta = folio ? doc.getTextWidth("N.º ") : 0;
  doc.setFont("helvetica", "bold").setFontSize(10);
  const anchoFolio = folio ? anchoEtiqueta + doc.getTextWidth(folio) : 0;

  const xFolio = folio ? xVerde - 9 - anchoFolio : xVerde;
  const xTitulo = (folio ? xFolio - 10 : xVerde - 8) - anchoTitulo;

  doc.setFillColor(...C.brand700);
  doc.roundedRect(M.izq, yTitulo - 5.5, Math.max(0, xTitulo - M.izq - 10), 5, 1, 1, "F");

  doc.setFont("helvetica", "bold").setFontSize(26).setTextColor(...C.brand900);
  doc.text(titulo, xTitulo, yTitulo);

  if (folio) {
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...C.muted);
    doc.text("N.º ", xFolio, yTitulo);
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...C.brand700);
    doc.text(folio, xFolio + anchoEtiqueta, yTitulo);
  }

  doc.setFillColor(...C.accent500);
  doc.roundedRect(xVerde, yTitulo - 5.5, anchoVerde, 5, 1, 1, "F");

  return yTitulo + 3;
}

function dibujarLogo(doc, x, y, r) {
  /* Hexágono de la marca. */
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    pts.push([x + r + r * Math.cos(a), y + r + r * Math.sin(a)]);
  }
  doc.setDrawColor(...C.brand700).setLineWidth(0.7);
  for (let i = 0; i < 6; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % 6];
    doc.line(x1, y1, x2, y2);
  }
  /* Palomita verde. */
  doc.setDrawColor(...C.accent500).setLineWidth(1.1);
  doc.line(x + r * 0.55, y + r * 1.02, x + r * 0.9, y + r * 1.38);
  doc.line(x + r * 0.9, y + r * 1.38, x + r * 1.48, y + r * 0.62);
  doc.setLineWidth(0.2);
}

/* ---------- Datos del cliente ---------- */

function dibujarDatosCliente(doc, datos, y) {
  const alto = 24;

  doc.setFillColor(...C.brand050);
  doc.setDrawColor(...C.line).setLineWidth(0.2);
  doc.roundedRect(M.izq, y, X_FIN - M.izq, alto, 1.5, 1.5, "FD");
  doc.setFillColor(...C.brand700);
  doc.rect(M.izq, y, 1.4, alto, "F");

  const xIzq = M.izq + 6;

  doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(...C.brand700);
  doc.text("PARA", xIzq, y + 6, { charSpace: 0.25 });

  doc.setFont("helvetica", "bold").setFontSize(11.5).setTextColor(...C.brand900);
  doc.text(recortar(doc, datos.cliente || "—", 90), xIzq, y + 12.5);

  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...C.inkSoft);
  doc.text(recortar(doc, datos.detalleCliente || "", 95), xIzq, y + 18);

  /* Columna derecha: folio, fecha y vigencia. */
  const meta = [
    ["Fecha", fecha(datos.fecha)],
    ["Válida hasta", fecha(datos.vence)],
  ].filter(([, v]) => v);

  /* Se centran verticalmente en la caja, sean una o dos líneas. */
  let yMeta = y + alto / 2 - (meta.length - 1) * 3 + 1;
  meta.forEach(([clave, valor]) => {
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...C.inkSoft);
    doc.text(clave, X_FIN - 6 - 52, yMeta);
    doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...C.brand900);
    doc.text(String(valor), X_FIN - 6, yMeta, { align: "right" });
    yMeta += 6;
  });

  return y + alto;
}

/* ---------- Tabla ---------- */

function encabezadoTabla(doc, y) {
  const alto = 8;
  doc.setFillColor(...C.brand800);
  doc.roundedRect(M.izq, y, X_FIN - M.izq, alto, 1.5, 1.5, "F");

  doc.setFont("helvetica", "bold").setFontSize(6.8).setTextColor(...C.blanco);
  const base = y + alto / 2 + 1.2;
  doc.text("N.º", COL.num.x + COL.num.w / 2, base, { align: "center", charSpace: 0.2 });
  doc.text("PRODUCTO O SERVICIO", COL.desc.x + 2, base, { charSpace: 0.2 });
  doc.text("CANT.", COL.cant.x + COL.cant.w - 2, base, { align: "right", charSpace: 0.2 });
  doc.text("PRECIO UNIT.", COL.precio.x + COL.precio.w - 2, base, { align: "right", charSpace: 0.2 });
  doc.text("TOTAL", COL.total.x + COL.total.w - 2, base, { align: "right", charSpace: 0.2 });

  return y + alto + 1;
}

function dibujarTabla(doc, datos, y) {
  // En la tabla los montos van sin moneda: el código se muestra en los totales.
  const cifra = datos.cifra ?? datos.dinero;
  y = encabezadoTabla(doc, y);


  datos.filas.forEach((fila, i) => {
    doc.setFont("helvetica", "normal").setFontSize(9);
    const lineas = doc.splitTextToSize(fila.desc || "—", COL.desc.w - 4);
    const alto = Math.max(8, lineas.length * 4 + 4.2);

    if (y + alto > LIMITE_CONTENIDO) {
      doc.addPage();
      y = encabezadoTabla(doc, M.arriba);
    }

    if (i % 2 === 1) {
      doc.setFillColor(...C.brand050);
      doc.rect(M.izq, y, X_FIN - M.izq, alto, "F");
    }

    const centro = y + alto / 2;

    /* Contador en círculo. */
    doc.setFillColor(...C.brand100);
    doc.circle(COL.num.x + COL.num.w / 2, centro, 3, "F");
    doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...C.brand800);
    doc.text(String(i + 1), COL.num.x + COL.num.w / 2, centro + 1.1, { align: "center" });

    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...C.ink);
    doc.text(lineas, COL.desc.x + 2, y + 5.4);

    doc.setTextColor(...C.inkSoft);
    doc.text(numeroCorto(fila.cant), COL.cant.x + COL.cant.w - 2, centro + 1.2, { align: "right" });
    doc.text(cifra(fila.precio), COL.precio.x + COL.precio.w - 2, centro + 1.2, { align: "right" });

    doc.setFont("helvetica", "bold").setTextColor(...C.brand900);
    doc.text(cifra(fila.total), COL.total.x + COL.total.w - 2, centro + 1.2, { align: "right" });

    doc.setDrawColor(...C.line).setLineWidth(0.2);
    doc.line(M.izq, y + alto, X_FIN, y + alto);

    y += alto;
  });

  return y;
}

/* ---------- Totales ---------- */

function dibujarTotales(doc, datos, y) {
  const xIzq = X_TOTALES;
  const lineas = [["Subtotal", datos.dinero(datos.subtotal)]];

  if (datos.montoDescuento > 0) {
    lineas.push([`Descuento (${numeroCorto(datos.pctDescuento)}%)`, `- ${datos.dinero(datos.montoDescuento)}`]);
  }
  if (datos.montoImpuesto > 0) {
    lineas.push([`Impuesto (${numeroCorto(datos.pctImpuesto)}%)`, datos.dinero(datos.montoImpuesto)]);
  }

  const altoBloque = lineas.length * 6 + 15;
  if (y + altoBloque > LIMITE_CONTENIDO) {
    doc.addPage();
    y = M.arriba;
  }

  const yInicio = y;

  lineas.forEach(([clave, valor], i) => {
    const yl = y + i * 6;
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...C.inkSoft);
    doc.text(clave, xIzq, yl);
    doc.setFont("helvetica", "bold").setTextColor(...C.brand900);
    doc.text(valor, X_FIN - 4, yl, { align: "right" });

    if (i < lineas.length - 1) {
      doc.setDrawColor(...C.line).setLineWidth(0.2);
      doc.line(xIzq, yl + 2, X_FIN - 4, yl + 2);
    }
  });

  /* Barra verde del total general. */
  const yBarra = y + lineas.length * 6 - 1;
  doc.setFillColor(...C.accent600);
  doc.roundedRect(xIzq - 4, yBarra, X_FIN - xIzq + 4, 12, 1.5, 1.5, "F");

  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...C.blanco);
  doc.text("TOTAL", xIzq, yBarra + 7.6, { charSpace: 0.3 });
  doc.setFontSize(14);
  doc.text(datos.dinero(datos.total), X_FIN - 4, yBarra + 8, { align: "right" });

  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...C.muted);
  doc.text(
    `${numeroCorto(datos.articulos)} ${datos.articulos === 1 ? "artículo" : "artículos"} · ${datos.moneda}`,
    X_FIN - 4,
    yBarra + 16.5,
    { align: "right" }
  );

  return { yInicio, yFin: yBarra + 12 };
}

/* ---------- Notas ---------- */

/**
 * Notas al pie izquierdo, arrancando a la misma altura que el "Subtotal"
 * de la columna derecha.
 */
function dibujarNotas(doc, datos, y) {
  if (!datos.notas) return;

  const ancho = X_TOTALES - 8 - M.izq;
  doc.setFont("helvetica", "normal").setFontSize(8);
  let lineas = doc.splitTextToSize(datos.notas, ancho);

  /* Lo que no quepa antes del pie se recorta: el bloque no se parte de página. */
  const disponible = LIMITE_CONTENIDO - (y + 5);
  const maxLineas = Math.max(1, Math.floor(disponible / 3.8));
  if (lineas.length > maxLineas) {
    lineas = lineas.slice(0, maxLineas);
    lineas[lineas.length - 1] += "…";
  }

  doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(...C.brand700);
  doc.text("NOTAS Y CONDICIONES", M.izq, y, { charSpace: 0.25 });

  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...C.inkSoft);
  doc.text(lineas, M.izq, y + 5);
}

/* ---------- Pie en todas las páginas ---------- */

function dibujarPies(doc, datos) {
  const total = doc.getNumberOfPages();

  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    const y = Y_LINEA_PIE;

    doc.setDrawColor(...C.brand100).setLineWidth(0.6);
    doc.line(M.izq, y, X_FIN, y);

    /* La firma solo tiene sentido en la última página. */
    if (p === total) {
      doc.setDrawColor(...C.lineStrong).setLineWidth(0.2);
      doc.line(M.izq, y + 9, M.izq + 52, y + 9);
      doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(...C.muted);
      doc.text("FIRMA AUTORIZADA", M.izq + 26, y + 12.5, { align: "center", charSpace: 0.25 });

      if (datos.contacto) {
        doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...C.inkSoft);
        doc.text(recortar(doc, datos.contacto, 90), X_FIN, y + 6, { align: "right" });
      }
      doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...C.muted);
      doc.text("Gracias por su preferencia.", X_FIN, y + 10.5, { align: "right" });

      dibujarCredito(doc, HOJA.alto - M.abajo + 4);
    }

    if (total > 1) {
      doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...C.muted);
      doc.text(`Página ${p} de ${total}`, X_FIN, HOJA.alto - M.abajo + 4, { align: "right" });
    }
  }
}


/** Firma del autor, centrada al pie de la última página y enlazada al sitio. */
function dibujarCredito(doc, y) {
  const prefijo = "Hecho por ";
  const dominio = "www.cacharreo.dev";

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  const anchoPrefijo = doc.getTextWidth(prefijo);
  doc.setFont("helvetica", "bold");
  const anchoDominio = doc.getTextWidth(dominio);

  const x = (HOJA.ancho - (anchoPrefijo + anchoDominio)) / 2;

  doc.setFont("helvetica", "normal").setTextColor(...C.muted);
  doc.text(prefijo, x, y);

  doc.setFont("helvetica", "bold").setTextColor(...C.accent700);
  doc.textWithLink(dominio, x + anchoPrefijo, y, { url: "https://www.cacharreo.dev" });
}

/* ---------- Utilidades ---------- */

export function fecha(iso) {
  if (!iso) return "";
  const [a, m, d] = String(iso).split("-");
  return a && m && d ? `${d}/${m}/${a}` : String(iso);
}

export function numeroCorto(n) {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

function recortar(doc, texto, anchoMax) {
  if (doc.getTextWidth(texto) <= anchoMax) return texto;
  let corte = texto;
  while (corte.length > 1 && doc.getTextWidth(corte + "…") > anchoMax) {
    corte = corte.slice(0, -1);
  }
  return corte + "…";
}

/** Nombre de archivo sin acentos ni caracteres raros. */
export function nombreArchivo(datos) {
  const limpio = (t) =>
    String(t || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);

  return [limpio(datos.folio) || "Cotizacion", limpio(datos.cliente)].filter(Boolean).join("_") + ".pdf";
}
