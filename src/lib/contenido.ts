import { createClient } from "@supabase/supabase-js";
import base from "../data/contenido.json";
import { BUCKET, supabaseConfigurado } from "./obras";

export interface Campo {
  clave: string;
  etiqueta: string;
  tipo: "linea" | "largo" | "imagen";
  valor: string;
  ayuda?: string;
  alt?: string;
  ancho?: number;
  alto?: number;
}
export interface Seccion { seccion: string; titulo: string; campos: Campo[] }
export interface FilaContenido { clave: string; valor: string; alt: string | null; ancho: number | null; alto: number | null }
export interface Imagen { src: string; alt: string; ancho?: number; alto?: number }

export const SECCIONES = base as Seccion[];

const URL_SB = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const LLAVE_SB = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/* Rutas que empiezan con "/" son archivos del proyecto; las demás viven en el bucket. */
export function urlRecurso(valor: string) {
  if (!valor || valor.startsWith("/") || /^https?:/.test(valor) || !URL_SB) return valor;
  return URL_SB.replace(/\/$/, "") + "/storage/v1/object/public/" + BUCKET + "/" + valor.split("/").map(encodeURIComponent).join("/");
}

export class Contenido {
  private mapa = new Map<string, Campo>();
  constructor(filas: FilaContenido[] = []) {
    for (const s of SECCIONES) for (const c of s.campos) this.mapa.set(c.clave, { ...c });
    for (const f of filas) {
      const c = this.mapa.get(f.clave);
      if (!c) continue;
      if (c.tipo === "imagen") {
        if (!f.valor) continue;
        c.valor = f.valor;
        if (f.alt != null) c.alt = f.alt;
        c.ancho = f.ancho ?? undefined;
        c.alto = f.alto ?? undefined;
      } else {
        c.valor = f.valor;
      }
    }
  }
  t(clave: string) { return this.mapa.get(clave)?.valor ?? ""; }
  /* Párrafos separados por una línea en blanco. */
  parrafos(clave: string) { return this.t(clave).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean); }
  lineas(clave: string) { return this.t(clave).split("\n").map((p) => p.trim()).filter(Boolean); }
  img(clave: string): Imagen {
    const c = this.mapa.get(clave);
    return { src: urlRecurso(c?.valor ?? ""), alt: c?.alt ?? "", ancho: c?.ancho, alto: c?.alto };
  }
  wa(mensaje: string) {
    const numero = this.t("contacto.whatsapp").replace(/\D/g, "");
    return "https://wa.me/" + numero + "?text=" + encodeURIComponent(mensaje);
  }
}

export async function cargarContenido(): Promise<Contenido> {
  if (!supabaseConfigurado) return new Contenido();
  const sb = createClient(URL_SB!, LLAVE_SB!, { auth: { persistSession: false } });
  const { data, error } = await sb.from("contenido").select("clave, valor, alt, ancho, alto");
  if (error) {
    console.error("No se pudo cargar el contenido; se usan los textos originales", error);
    return new Contenido();
  }
  return new Contenido(data as FilaContenido[]);
}
