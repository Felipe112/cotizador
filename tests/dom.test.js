import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { desmontarPlantilla, montarPlantilla } from "./plantilla.js";

/**
 * El PDF se genera de verdad en `pdf.test.js`. Aquí se simula para probar el
 * flujo del botón: pestaña, avisos y estado del botón.
 */
const pdfFalso = {
  exportarPDF: vi.fn(async () => ({ output: () => ({ tipo: "pdf-falso" }) })),
  nombreArchivo: vi.fn(() => "COT-001.pdf"),
};

vi.mock("../src/scripts/pdf.js", () => pdfFalso);

let ventana;

/** Carga el script como lo haría el navegador, ya con la plantilla en el DOM. */
async function arrancarScript() {
  vi.resetModules();
  await import("../src/scripts/cotizador.js");
}

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const filas = () => $$(".fila-producto");

function escribir(input, valor) {
  input.value = valor;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function llenarFila(i, { desc = "", cant = "", precio = "" }) {
  const fila = filas()[i];
  if (desc) escribir(fila.querySelector(".campo--desc"), desc);
  if (cant) escribir(fila.querySelector(".js-cantidad"), cant);
  if (precio) escribir(fila.querySelector(".js-precio"), precio);
  return fila;
}

function tabular(input) {
  const evento = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
  input.dispatchEvent(evento);
  return evento;
}

beforeEach(async () => {
  // Se finge solo setTimeout: así el guardado diferido es controlable y no
  // queda ningún temporizador vivo apuntando a un DOM ya desmontado.
  // `vi.waitFor` sigue usando temporizadores reales.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  ventana = await montarPlantilla();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  desmontarPlantilla();
});

describe("arranque", () => {
  it("abre con tres filas numeradas", async () => {
    await arrancarScript();

    expect(filas()).toHaveLength(3);
    expect($$(".contador").map((c) => c.textContent)).toEqual(["1", "2", "3"]);
  });

  it("muestra las filas vacías con guion, no con 0.00", async () => {
    await arrancarScript();

    expect($(".js-total-fila").textContent).toBe("—");
    expect($(".js-total-fila").dataset.vacio).toBe("1");
  });

  it("pone la fecha de hoy, no la del build", async () => {
    await arrancarScript();

    const hoy = new Date();
    const esperado = [
      hoy.getFullYear(),
      String(hoy.getMonth() + 1).padStart(2, "0"),
      String(hoy.getDate()).padStart(2, "0"),
    ].join("-");

    expect($("#fecha-actual").dateTime).toBe(esperado);
  });

  it("propone una vigencia de 7 días", async () => {
    await arrancarScript();

    const hasta = new Date();
    hasta.setDate(hasta.getDate() + 7);
    const esperado = [
      hasta.getFullYear(),
      String(hasta.getMonth() + 1).padStart(2, "0"),
      String(hasta.getDate()).padStart(2, "0"),
    ].join("-");

    expect($('[aria-label="Fecha de vencimiento"]').value).toBe(esperado);
  });

  it("arranca en pesos colombianos", async () => {
    await arrancarScript();

    expect($("#moneda").value).toBe("COP");
  });
});

describe("cálculo en pantalla", () => {
  it("multiplica cantidad por precio al escribir", async () => {
    await arrancarScript();
    llenarFila(0, { desc: "Servicio", cant: "3", precio: "10" });

    expect($(".js-total-fila").textContent).toBe("30.00");
  });

  it("la columna Total va sin código de moneda", async () => {
    await arrancarScript();
    llenarFila(0, { cant: "2", precio: "1500" });

    expect($(".js-total-fila").textContent).toBe("3,000.00");
    expect($(".js-total-fila").textContent).not.toContain("COP");
  });

  it("los totales sí llevan el código de moneda", async () => {
    await arrancarScript();
    llenarFila(0, { cant: "2", precio: "100" });

    expect($("#subtotal").textContent).toContain("COP");
    expect($("#subtotal").textContent).toContain("200.00");
    expect($("#total-general").textContent).toContain("200.00");
  });

  it("suma varias filas en el subtotal", async () => {
    await arrancarScript();
    llenarFila(0, { cant: "2", precio: "100" });
    llenarFila(1, { cant: "1", precio: "50" });

    expect($("#subtotal").textContent).toContain("250.00");
  });

  it("aplica descuento e impuesto sobre la base correcta", async () => {
    await arrancarScript();
    llenarFila(0, { cant: "1", precio: "1000" });
    escribir($("#descuento"), "50");
    escribir($("#impuesto"), "10");

    expect($("#monto-descuento").textContent).toContain("500.00");
    expect($("#monto-impuesto").textContent).toContain("50.00");
    expect($("#total-general").textContent).toContain("550.00");
  });

  it("cuenta los artículos sumando cantidades", async () => {
    await arrancarScript();
    llenarFila(0, { cant: "3", precio: "10" });
    llenarFila(1, { cant: "4", precio: "10" });

    expect($("#conteo-articulos").textContent).toBe("7 artículos");
  });

  it("cambia el formato al cambiar de moneda", async () => {
    await arrancarScript();
    llenarFila(0, { cant: "1", precio: "100" });

    const moneda = $("#moneda");
    moneda.value = "USD";
    moneda.dispatchEvent(new Event("change", { bubbles: true }));

    expect($("#subtotal").textContent).toContain("USD");
    // La tabla no cambia: ahí nunca hubo moneda.
    expect($(".js-total-fila").textContent).toBe("100.00");
  });
});

describe("filas", () => {
  it("el botón agrega una fila y la numera", async () => {
    await arrancarScript();
    $("#btn-agregar").click();

    expect(filas()).toHaveLength(4);
    expect($$(".contador").at(-1).textContent).toBe("4");
  });

  it("quitar una fila renumera las que quedan", async () => {
    await arrancarScript();
    llenarFila(0, { desc: "Primero" });
    llenarFila(1, { desc: "Segundo" });
    llenarFila(2, { desc: "Tercero" });

    filas()[0].querySelector(".js-quitar").click();

    expect(filas()).toHaveLength(2);
    expect(filas()[0].querySelector(".campo--desc").value).toBe("Segundo");
    expect($$(".contador").map((c) => c.textContent)).toEqual(["1", "2"]);
  });

  it("la última fila no se borra: se vacía", async () => {
    await arrancarScript();
    filas()[2].querySelector(".js-quitar").click();
    filas()[1].querySelector(".js-quitar").click();
    llenarFila(0, { desc: "Solo", cant: "2", precio: "5" });

    filas()[0].querySelector(".js-quitar").click();

    expect(filas()).toHaveLength(1);
    expect(filas()[0].querySelector(".campo--desc").value).toBe("");
    expect($("#subtotal").textContent).toContain("0.00");
  });

  it("quitar una fila recalcula el subtotal", async () => {
    await arrancarScript();
    llenarFila(0, { cant: "1", precio: "100" });
    llenarFila(1, { cant: "1", precio: "50" });

    filas()[1].querySelector(".js-quitar").click();

    expect($("#subtotal").textContent).toContain("100.00");
  });
});

describe("tabulador desde el último precio", () => {
  it("crea una fila nueva y salta a su descripción", async () => {
    await arrancarScript();
    const fila = llenarFila(2, { desc: "Último", cant: "1", precio: "9" });

    const evento = tabular(fila.querySelector(".js-precio"));

    expect(evento.defaultPrevented).toBe(true);
    expect(filas()).toHaveLength(4);
    expect(document.activeElement).toBe(filas()[3].querySelector(".campo--desc"));
  });

  it("no crea filas si la última está vacía", async () => {
    await arrancarScript();

    const evento = tabular(filas()[2].querySelector(".js-precio"));

    expect(evento.defaultPrevented).toBe(false);
    expect(filas()).toHaveLength(3);
  });

  it("no hace nada desde una fila que no es la última", async () => {
    await arrancarScript();
    const fila = llenarFila(0, { desc: "Primero", cant: "1", precio: "9" });

    tabular(fila.querySelector(".js-precio"));

    expect(filas()).toHaveLength(3);
  });

  it("no interfiere con Shift+Tab", async () => {
    await arrancarScript();
    const fila = llenarFila(2, { desc: "Último", precio: "9" });

    const evento = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    fila.querySelector(".js-precio").dispatchEvent(evento);

    expect(evento.defaultPrevented).toBe(false);
    expect(filas()).toHaveLength(3);
  });

  it("permite encadenar varios productos seguidos", async () => {
    await arrancarScript();

    for (let i = 2; i < 6; i++) {
      llenarFila(i, { desc: `Producto ${i}`, cant: "1", precio: "10" });
      tabular(filas()[i].querySelector(".js-precio"));
    }

    expect(filas()).toHaveLength(7);
    expect($("#subtotal").textContent).toContain("40.00");
  });
});

describe("guardado local", () => {
  it("guarda lo escrito después de la pausa", async () => {
    await arrancarScript();
    llenarFila(0, { desc: "Servicio", cant: "2", precio: "300" });

    expect(localStorage.getItem("cotizador:v1")).toBeNull();

    vi.advanceTimersByTime(600);

    const guardado = JSON.parse(localStorage.getItem("cotizador:v1"));
    expect(guardado.filas[0]).toEqual({ desc: "Servicio", cant: "2", precio: "300" });
  });

  it("guarda también los campos del encabezado", async () => {
    await arrancarScript();
    escribir($('[aria-label="Nombre del cliente"]'), "Acme");
    vi.advanceTimersByTime(600);

    const guardado = JSON.parse(localStorage.getItem("cotizador:v1"));
    expect(guardado.campos["Nombre del cliente"]).toBe("Acme");
  });

  it("restaura filas y campos al volver a abrir", async () => {
    localStorage.setItem(
      "cotizador:v1",
      JSON.stringify({
        campos: { "Nombre del cliente": "Constructora S.A.", Moneda: "USD" },
        filas: [
          { desc: "Uno", cant: "2", precio: "100" },
          { desc: "Dos", cant: "1", precio: "50" },
        ],
      })
    );

    await arrancarScript();

    expect(filas()).toHaveLength(2);
    expect($('[aria-label="Nombre del cliente"]').value).toBe("Constructora S.A.");
    expect($("#moneda").value).toBe("USD");
    expect($("#subtotal").textContent).toContain("USD");
    expect($("#subtotal").textContent).toContain("250.00");
  });

  it("aguanta un guardado corrupto sin romper la plantilla", async () => {
    localStorage.setItem("cotizador:v1", "{esto no es json");

    await arrancarScript();

    expect(filas()).toHaveLength(3);
  });

  it("no guarda la fecha de emisión: siempre debe ser hoy", async () => {
    await arrancarScript();
    llenarFila(0, { desc: "Algo" });
    vi.advanceTimersByTime(600);

    const guardado = JSON.parse(localStorage.getItem("cotizador:v1"));
    expect(Object.keys(guardado.campos)).not.toContain("Fecha de la cotización");
  });
});

describe("vigencia", () => {
  const vence = () => $('[aria-label="Fecha de vencimiento"]');

  function enISO(dias) {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  }

  it("recalcula la vigencia si el usuario nunca la tocó", async () => {
    // Un guardado viejo, de una visita de hace semanas.
    localStorage.setItem(
      "cotizador:v1",
      JSON.stringify({ campos: { "Fecha de vencimiento": "2020-01-01" }, filas: [] })
    );

    await arrancarScript();

    expect(vence().value).toBe(enISO(7));
  });

  it("respeta la fecha que el usuario eligió", async () => {
    localStorage.setItem(
      "cotizador:v1",
      JSON.stringify({
        campos: { "Fecha de vencimiento": "2030-12-31" },
        filas: [],
        vigenciaTocada: true,
      })
    );

    await arrancarScript();

    expect(vence().value).toBe("2030-12-31");
  });

  it("marca la vigencia como tocada al editarla y lo guarda", async () => {
    await arrancarScript();

    escribir(vence(), "2027-03-15");
    vi.advanceTimersByTime(600);

    const guardado = JSON.parse(localStorage.getItem("cotizador:v1"));
    expect(guardado.vigenciaTocada).toBe(true);
    expect(guardado.campos["Fecha de vencimiento"]).toBe("2027-03-15");
  });

  it("no marca como tocado lo que escribe el propio script", async () => {
    await arrancarScript();

    escribir($('[aria-label="Nombre del cliente"]'), "Acme");
    vi.advanceTimersByTime(600);

    const guardado = JSON.parse(localStorage.getItem("cotizador:v1"));
    expect(guardado.vigenciaTocada).toBe(false);
  });
});

describe("limpiar todo", () => {
  beforeEach(() => {
    globalThis.location = { reload: vi.fn() };
  });

  it("no borra nada si el usuario cancela", async () => {
    await arrancarScript();
    llenarFila(0, { desc: "Algo" });
    vi.advanceTimersByTime(600);
    ventana.confirm = vi.fn(() => false);

    $("#btn-limpiar").click();

    expect(localStorage.getItem("cotizador:v1")).not.toBeNull();
    expect(location.reload).not.toHaveBeenCalled();
  });

  it("borra el guardado y recarga si el usuario confirma", async () => {
    await arrancarScript();
    llenarFila(0, { desc: "Algo" });
    vi.advanceTimersByTime(600);
    ventana.confirm = vi.fn(() => true);

    $("#btn-limpiar").click();

    expect(localStorage.getItem("cotizador:v1")).toBeNull();
    expect(location.reload).toHaveBeenCalled();
  });
});

describe("exportar a PDF", () => {
  beforeEach(() => {
    ventana.URL.createObjectURL = vi.fn(() => "blob:falso");
    ventana.URL.revokeObjectURL = vi.fn();
  });

  it("abre la pestaña DENTRO del clic, antes de generar el PDF", async () => {
    await arrancarScript();
    llenarFila(0, { desc: "Servicio", cant: "1", precio: "100" });

    const pestana = { closed: false, location: { href: "" }, close: vi.fn() };
    const abrir = vi.fn(() => pestana);
    ventana.open = abrir;

    $(".js-exportar-pdf").click();

    // Sin esperar nada: si esto falla, el bloqueador de pop-ups mata la pestaña.
    expect(abrir).toHaveBeenCalledWith("", "_blank");

    await vi.waitFor(() => expect(pestana.location.href).toBe("blob:falso"));
    expect($("#aviso-guardado").textContent).toContain("pestaña nueva");
  });

  it("no exporta si no hay ningún producto", async () => {
    await arrancarScript();

    const abrir = vi.fn();
    ventana.open = abrir;

    $(".js-exportar-pdf").click();

    expect(abrir).not.toHaveBeenCalled();
    expect($("#aviso-guardado").textContent).toContain("al menos un producto");
  });

  it("si el navegador bloquea la pestaña, descarga el archivo", async () => {
    await arrancarScript();
    llenarFila(0, { desc: "Servicio", cant: "1", precio: "100" });

    ventana.open = vi.fn(() => null);
    const clicEnlace = vi
      .spyOn(ventana.HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    $(".js-exportar-pdf").click();

    await vi.waitFor(() => expect(clicEnlace).toHaveBeenCalled());
    expect($("#aviso-guardado").textContent).toContain("descargó");
  });

  it("avisa y cierra la pestaña si el PDF falla", async () => {
    await arrancarScript();
    llenarFila(0, { desc: "Servicio", cant: "1", precio: "100" });

    const pestana = { closed: false, location: { href: "" }, close: vi.fn() };
    ventana.open = vi.fn(() => pestana);
    pdfFalso.exportarPDF.mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const boton = $(".js-exportar-pdf");
    boton.click();

    await vi.waitFor(() => expect(pestana.close).toHaveBeenCalled());
    expect($("#aviso-guardado").textContent).toContain("No se pudo generar");
    expect(boton.disabled).toBe(false);
  });

  it("deja el botón utilizable de nuevo al terminar", async () => {
    await arrancarScript();
    llenarFila(0, { desc: "Servicio", cant: "1", precio: "100" });

    const boton = $(".js-exportar-pdf");
    const contenido = boton.innerHTML;
    ventana.open = vi.fn(() => ({ closed: false, location: { href: "" }, close: vi.fn() }));

    boton.click();

    await vi.waitFor(() => expect(boton.disabled).toBe(false));
    expect(boton.innerHTML).toBe(contenido);
  });
});
