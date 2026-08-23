import { describe, expect, it } from "vitest";
import {
  aNumero,
  aPorcentaje,
  calcularTotales,
  crearFormateador,
  textoArticulos,
} from "../src/scripts/calculo.js";

describe("aNumero", () => {
  it("lee números normales", () => {
    expect(aNumero("12")).toBe(12);
    expect(aNumero("12.5")).toBe(12.5);
    expect(aNumero(7)).toBe(7);
  });

  it("acepta coma como separador decimal", () => {
    expect(aNumero("12,50")).toBe(12.5);
  });

  it("trata lo vacío o inválido como cero", () => {
    for (const entrada of ["", "   ", "abc", null, undefined, NaN, {}]) {
      expect(aNumero(entrada)).toBe(0);
    }
  });

  it("descarta negativos: una cotización no cobra cantidades negativas", () => {
    expect(aNumero("-5")).toBe(0);
    expect(aNumero(-0.01)).toBe(0);
  });

  it("ignora espacios alrededor", () => {
    expect(aNumero("  30  ")).toBe(30);
  });
});

describe("aPorcentaje", () => {
  it("deja pasar valores dentro del rango", () => {
    expect(aPorcentaje("19")).toBe(19);
    expect(aPorcentaje(0)).toBe(0);
    expect(aPorcentaje(100)).toBe(100);
  });

  it("recorta por encima de 100", () => {
    expect(aPorcentaje(150)).toBe(100);
  });

  it("recorta por debajo de 0", () => {
    expect(aPorcentaje(-20)).toBe(0);
  });
});

describe("calcularTotales", () => {
  it("multiplica cantidad por precio en cada fila", () => {
    const { filas } = calcularTotales({
      filas: [
        { cant: "3", precio: "10" },
        { cant: "2", precio: "5.5" },
      ],
    });

    expect(filas[0].total).toBe(30);
    expect(filas[1].total).toBe(11);
  });

  it("suma el subtotal de todas las filas", () => {
    const { subtotal } = calcularTotales({
      filas: [
        { cant: 3, precio: 10 },
        { cant: 2, precio: 5.5 },
        { cant: 1, precio: 100 },
      ],
    });

    expect(subtotal).toBe(141);
  });

  it("cuenta los artículos sumando cantidades, no filas", () => {
    const { articulos } = calcularTotales({
      filas: [
        { cant: 3, precio: 10 },
        { cant: 4, precio: 10 },
      ],
    });

    expect(articulos).toBe(7);
  });

  it("marca como vacía la fila sin cantidad ni precio", () => {
    const { filas } = calcularTotales({
      filas: [{ cant: "", precio: "" }, { cant: 1, precio: 0 }, { cant: 0, precio: 5 }],
    });

    expect(filas[0].vacia).toBe(true);
    expect(filas[1].vacia).toBe(false);
    expect(filas[2].vacia).toBe(false);
  });

  it("aplica el descuento sobre el subtotal", () => {
    const r = calcularTotales({ filas: [{ cant: 1, precio: 200 }], descuento: 10 });

    expect(r.montoDescuento).toBe(20);
    expect(r.total).toBe(180);
  });

  it("aplica el impuesto DESPUÉS del descuento, no sobre el subtotal", () => {
    const r = calcularTotales({
      filas: [{ cant: 1, precio: 1000 }],
      descuento: 50,
      impuesto: 10,
    });

    // 1000 - 500 = 500 de base; 10% de 500 = 50, no 100.
    expect(r.montoDescuento).toBe(500);
    expect(r.montoImpuesto).toBe(50);
    expect(r.total).toBe(550);
  });

  it("sin descuento ni impuesto el total es el subtotal", () => {
    const r = calcularTotales({ filas: [{ cant: 2, precio: 33.33 }] });

    expect(r.total).toBeCloseTo(r.subtotal, 10);
    expect(r.montoDescuento).toBe(0);
    expect(r.montoImpuesto).toBe(0);
  });

  it("recorta porcentajes fuera de rango antes de calcular", () => {
    const r = calcularTotales({ filas: [{ cant: 1, precio: 100 }], descuento: 999 });

    expect(r.pctDescuento).toBe(100);
    expect(r.total).toBe(0);
  });

  it("no revienta sin filas", () => {
    const r = calcularTotales();

    expect(r.subtotal).toBe(0);
    expect(r.total).toBe(0);
    expect(r.articulos).toBe(0);
    expect(r.filas).toEqual([]);
  });

  it("conserva los campos extra de cada fila (como la descripción)", () => {
    const { filas } = calcularTotales({
      filas: [{ desc: "Instalación", cant: 1, precio: 50 }],
    });

    expect(filas[0].desc).toBe("Instalación");
  });

  it("ignora texto basura en cantidad o precio", () => {
    const r = calcularTotales({ filas: [{ cant: "dos", precio: "caro" }] });

    expect(r.subtotal).toBe(0);
    expect(r.filas[0].vacia).toBe(true);
  });

  it("maneja decimales sin acumular error visible", () => {
    const r = calcularTotales({
      filas: [
        { cant: 3, precio: 0.1 },
        { cant: 3, precio: 0.2 },
      ],
    });

    expect(r.subtotal).toBeCloseTo(0.9, 10);
  });
});

describe("crearFormateador", () => {
  // Intl separa el código del monto con espacio duro (U+00A0), no con espacio normal.
  const ESPACIO = "\u00a0";

  it("antepone el código ISO al monto", () => {
    expect(crearFormateador("COP").format(1234.5)).toBe(`COP${ESPACIO}1,234.50`);
    expect(crearFormateador("USD").format(1234.5)).toBe(`USD${ESPACIO}1,234.50`);
  });

  it("usa el código también para la moneda del locale", () => {
    // Sin currencyDisplay: "code", es-MX imprimiría "$1,234.50" solo para MXN.
    expect(crearFormateador("MXN").format(1234.5)).toBe(`MXN${ESPACIO}1,234.50`);
  });

  it("siempre muestra dos decimales", () => {
    expect(crearFormateador("COP").format(5)).toBe(`COP${ESPACIO}5.00`);
  });
});

describe("textoArticulos", () => {
  it("usa singular con exactamente uno", () => {
    expect(textoArticulos(1)).toBe("1 artículo");
  });

  it("usa plural con cero o más de uno", () => {
    expect(textoArticulos(0)).toBe("0 artículos");
    expect(textoArticulos(7)).toBe("7 artículos");
  });

  it("recorta decimales largos", () => {
    expect(textoArticulos(2.5)).toBe("2.5 artículos");
    expect(textoArticulos(0.1 + 0.2)).toBe("0.3 artículos");
  });
});
