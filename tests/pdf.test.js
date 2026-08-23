import { describe, expect, it, vi } from "vitest";
import { exportarPDF, fecha, nombreArchivo, numeroCorto } from "../src/scripts/pdf.js";

const fmtMoneda = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "COP",
  currencyDisplay: "code",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const fmtCifra = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function datosDe(extra = {}) {
  const filas = extra.filas ?? [{ desc: "Servicio", cant: 2, precio: 100, total: 200 }];
  const subtotal = filas.reduce((a, f) => a + f.total, 0);

  return {
    empresa: "Soluciones Andinas S.A.",
    cliente: "Constructora del Pacífico",
    detalleCliente: "Av. Balboa 123 · compras@pacifico.com",
    folio: "COT-202608-001",
    fecha: "2026-08-23",
    vence: "2026-09-07",
    notas: "",
    contacto: "+507 300-1234",
    moneda: "COP",
    dinero: (v) => fmtMoneda.format(v || 0),
    cifra: (v) => fmtCifra.format(v || 0),
    subtotal,
    pctDescuento: 0,
    montoDescuento: 0,
    pctImpuesto: 0,
    montoImpuesto: 0,
    total: subtotal,
    articulos: filas.reduce((a, f) => a + f.cant, 0),
    ...extra,
    filas,
  };
}

function muchasFilas(n) {
  return Array.from({ length: n }, (_, i) => ({
    desc: `Producto ${i + 1}`,
    cant: 1,
    precio: 10,
    total: 10,
  }));
}

describe("fecha", () => {
  it("pasa de ISO a día/mes/año", () => {
    expect(fecha("2026-08-23")).toBe("23/08/2026");
  });

  it("devuelve vacío si no hay fecha", () => {
    expect(fecha("")).toBe("");
    expect(fecha(undefined)).toBe("");
  });

  it("deja pasar tal cual lo que no sea ISO", () => {
    expect(fecha("mañana")).toBe("mañana");
  });
});

describe("numeroCorto", () => {
  it("no le pone decimales a los enteros", () => {
    expect(numeroCorto(7)).toBe("7");
  });

  it("recorta a dos decimales y quita ceros de relleno", () => {
    expect(numeroCorto(7.5)).toBe("7.5");
    expect(numeroCorto(7.123456)).toBe("7.12");
  });
});

describe("nombreArchivo", () => {
  it("junta folio y cliente", () => {
    expect(nombreArchivo({ folio: "COT-001", cliente: "Acme" })).toBe("COT-001_Acme.pdf");
  });

  it("quita acentos y caracteres raros", () => {
    expect(nombreArchivo({ folio: "COT-001", cliente: "Constructora del Pacífico S.A." })).toBe(
      "COT-001_Constructora-del-Pacifico-S-A.pdf"
    );
  });

  it("usa un nombre por defecto si no hay folio", () => {
    expect(nombreArchivo({ folio: "", cliente: "" })).toBe("Cotizacion.pdf");
  });

  it("no deja guiones sueltos al inicio ni al final", () => {
    const nombre = nombreArchivo({ folio: "  ***  ", cliente: "!!!" });
    expect(nombre).toBe("Cotizacion.pdf");
  });
});

describe("exportarPDF", () => {
  it("genera un PDF de una página con pocos productos", async () => {
    const doc = await exportarPDF(datosDe());

    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(1000);
  });

  it("guarda el folio y el cliente en las propiedades del documento", async () => {
    // El visor del navegador muestra /Title como nombre de la pestaña.
    const crudo = (await exportarPDF(datosDe())).output();

    expect(crudo).toMatch(/\/Title \([^)]*COT-202608-001/);
    expect(crudo).toMatch(/\/Subject \([^)]*Constructora del Pac/);
  });

  it("parte en varias páginas cuando hay muchos productos", async () => {
    const filas = muchasFilas(60);
    const doc = await exportarPDF(datosDe({ filas }));

    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });

  it("no falla sin nombre de empresa", async () => {
    const doc = await exportarPDF(datosDe({ empresa: "   " }));

    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("no falla sin folio, sin notas y sin contacto", async () => {
    const doc = await exportarPDF(datosDe({ folio: "", notas: "", contacto: "" }));

    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("no falla con una descripción larguísima", async () => {
    const doc = await exportarPDF(
      datosDe({ filas: [{ desc: "palabra ".repeat(200), cant: 1, precio: 1, total: 1 }] })
    );

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("recorta las notas que no caben en vez de romper el pie", async () => {
    const doc = await exportarPDF(datosDe({ notas: "Condición larga. ".repeat(400) }));

    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("escribe la tabla sin código de moneda y los totales con él", async () => {
    const datos = datosDe();
    const cifra = vi.fn(datos.cifra);
    const dinero = vi.fn(datos.dinero);

    await exportarPDF({ ...datos, cifra, dinero });

    // Precio unitario y total de la fila pasan por el formato sin moneda.
    expect(cifra).toHaveBeenCalledWith(100);
    expect(cifra).toHaveBeenCalledWith(200);

    // Y ninguno de esos montos se formateó con moneda para la tabla.
    const conMoneda = dinero.mock.calls.map(([v]) => v);
    expect(conMoneda).not.toContain(100);

    // El bloque de totales sí lleva moneda.
    expect(dinero).toHaveBeenCalledWith(datos.subtotal);
  });

  it("cae al formato con moneda si no le pasan `cifra`", async () => {
    const datos = datosDe();
    const dinero = vi.fn(datos.dinero);
    const { cifra, ...sinCifra } = datos;

    await exportarPDF({ ...sinCifra, dinero });

    expect(dinero).toHaveBeenCalledWith(100);
  });
});
