/*
  Muro en mosaico automático.
  Cada obra recibe un ancho según su tamaño real (con un mínimo para que las
  pequeñas se aprecien) y se cuelga en el hueco más alto disponible del muro,
  como un acomodo "skyline". Las unidades son porcentaje del ancho del muro.
*/
import type { Obra } from "./obras";

export interface Posicion { x: number; y: number; w: number }
interface Config {
  margen: number;
  gapX: number;
  ancho: (o: Obra, ar: number, eq: number) => number;
  cartela: (o: Obra, w: number) => number;
}

const ANCHO_MURO = 100;

function equivalente(o: Obra, ar: number) {
  const a = Number(o.ancho_cm) || 40;
  const h = Number(o.alto_cm) || a;
  const area = o.soporte === "escultura" ? h * h * 0.7 : a * h;
  return Math.sqrt(area * ar);
}

function lineas(texto: string, pxPorCaracter: number, anchoPx: number) {
  return Math.max(1, Math.ceil((texto.length * pxPorCaracter) / Math.max(anchoPx, 1)));
}

function cartelaEnUnidades(o: Obra, w: number, pxUnidad: number, tituloPx: number, metaPx: number, gap: number) {
  const anchoPx = w * pxUnidad;
  const meta = o.medidas + ", " + (o.anio ?? "");
  let px = 14 + lineas(o.titulo, tituloPx, anchoPx) * tituloPx * 2.15 + lineas(meta, metaPx, anchoPx) * metaPx * 2.7;
  if (o.vendida) px += metaPx * 2.7;
  if (o.soporte === "escultura") px += 8;
  return px / pxUnidad + gap;
}

function acomodar(obras: Obra[], c: Config) {
  const paso = 0.5;
  const columnas = Math.round(ANCHO_MURO / paso);
  const alturas = new Array(columnas).fill(1.5);
  const posiciones: Posicion[] = [];
  for (const o of obras) {
    const ar = o.imagen_ancho / o.imagen_alto;
    const w = Math.min(ANCHO_MURO - 2 * c.margen, c.ancho(o, ar, equivalente(o, ar)));
    const alto = w / ar + c.cartela(o, w);
    const cw = Math.ceil(w / paso);
    const desde = Math.round(c.margen / paso);
    const hasta = Math.round((ANCHO_MURO - c.margen) / paso) - cw;
    let mejorX = desde, mejorY = Infinity;
    for (let x = desde; x <= hasta; x++) {
      let y = 0;
      for (let k = x; k < x + cw; k++) if (alturas[k] > y) y = alturas[k];
      if (y < mejorY - 0.01) { mejorY = y; mejorX = x; }
    }
    for (let k = mejorX; k < mejorX + cw; k++) alturas[k] = mejorY + alto;
    /* El hueco a cada lado se reserva para que dos obras no queden pegadas. */
    const g = Math.round(c.gapX / paso);
    for (let k = Math.max(0, mejorX - g); k < mejorX; k++) alturas[k] = Math.max(alturas[k], mejorY + alto * 0.35);
    for (let k = mejorX + cw; k < Math.min(columnas, mejorX + cw + g); k++) alturas[k] = Math.max(alturas[k], mejorY + alto * 0.35);
    posiciones.push({ x: +(mejorX * paso).toFixed(2), y: +mejorY.toFixed(2), w: +w.toFixed(2) });
  }
  const total = Math.max(...posiciones.map((p, i) => p.y + p.w / (obras[i].imagen_ancho / obras[i].imagen_alto) + c.cartela(obras[i], p.w)), 10);
  return { posiciones, alto: +total.toFixed(1) };
}

const limitar = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function mosaico(obras: Obra[]) {
  const escritorio = acomodar(obras, {
    margen: 3,
    gapX: 4,
    ancho: (o, _ar, eq) => (o.soporte === "escultura" ? limitar(eq * 0.6, 9, 14) : limitar(eq * 0.25, 13, 42)),
    cartela: (o, w) => cartelaEnUnidades(o, w, 10, 8.6, 6.8, 4),
  });
  const movil = acomodar(obras, {
    margen: 4,
    gapX: 3,
    ancho: (o, _ar, eq) => {
      if (o.soporte === "escultura") return 27;
      const w = eq * 0.62;
      if (w > 66) return 92;
      return limitar(w, 29, 60);
    },
    cartela: (o, w) => cartelaEnUnidades(o, w, 3.47, 8.4, 6.6, 5),
  });
  return { escritorio, movil };
}
