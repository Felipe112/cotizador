/**
 * Cálculo de la cotización, sin DOM.
 *
 * Vive aparte de `cotizador.js` a propósito: aquí solo entran números y
 * salen números, así se puede probar la aritmética sin montar una página.
 */

/**
 * Convierte lo escrito en un campo a un número usable.
 * Acepta coma decimal. Cualquier cosa inválida o negativa cuenta como 0.
 */
export function aNumero(valor) {
  const n = parseFloat(String(valor ?? "").trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Encierra un porcentaje entre 0 y 100. */
export function aPorcentaje(valor) {
  return Math.min(aNumero(valor), 100);
}

/**
 * Formateador de moneda: código ISO delante del monto ("COP 1,234.50").
 * El `currencyDisplay` va explícito porque, por defecto, la moneda del propio
 * locale saldría como "$" y el resto como código.
 */
export function crearFormateador(moneda) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: moneda,
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formateador sin moneda, para las columnas de la tabla: "1,234.50".
 * El código de moneda solo se repite en el bloque de totales.
 */
export function crearFormateadorCifra() {
  return new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Suma la cotización completa.
 *
 * @param {{ filas: Array<{cant: any, precio: any}>, descuento?: any, impuesto?: any }} entrada
 * @returns totales y las filas ya resueltas (cantidad × precio).
 */
export function calcularTotales({ filas = [], descuento = 0, impuesto = 0 } = {}) {
  const resueltas = filas.map((fila) => {
    const cant = aNumero(fila.cant);
    const precio = aNumero(fila.precio);
    return {
      ...fila,
      cant,
      precio,
      total: cant * precio,
      // Una fila sin cantidad ni precio se muestra vacía en vez de "0.00".
      vacia: cant === 0 && precio === 0,
    };
  });

  const subtotal = resueltas.reduce((suma, f) => suma + f.total, 0);
  const articulos = resueltas.reduce((suma, f) => suma + f.cant, 0);

  const pctDescuento = aPorcentaje(descuento);
  const montoDescuento = subtotal * (pctDescuento / 100);

  const base = subtotal - montoDescuento;

  const pctImpuesto = aPorcentaje(impuesto);
  const montoImpuesto = base * (pctImpuesto / 100);

  return {
    filas: resueltas,
    subtotal,
    articulos,
    pctDescuento,
    montoDescuento,
    pctImpuesto,
    montoImpuesto,
    total: base + montoImpuesto,
  };
}

/** "3 artículos" / "1 artículo", con decimales solo si los hay. */
export function textoArticulos(articulos) {
  const n = Number.isInteger(articulos) ? articulos : Number(articulos.toFixed(2));
  return `${n} ${articulos === 1 ? "artículo" : "artículos"}`;
}
