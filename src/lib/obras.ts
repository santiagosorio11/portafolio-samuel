import { createClient } from "@supabase/supabase-js";
import iniciales from "../data/obras-iniciales.json";

export type Soporte = "lienzo" | "madera" | "escultura" | "otro";
export type Estado = "disponible" | "reservada" | "vendida" | "no_disponible";

/* Cómo se nombra cada estado en el panel y en la cartela del muro. */
export const ESTADOS: Record<Estado, { panel: string; cartela: string }> = {
  disponible: { panel: "Disponible", cartela: "" },
  reservada: { panel: "Reservada", cartela: "Reservada" },
  vendida: { panel: "Vendida", cartela: "Colección privada" },
  no_disponible: { panel: "No disponible", cartela: "No disponible" },
};

export interface FilaObra {
  id?: string;
  slug: string;
  titulo: string;
  tecnica: string;
  soporte: Soporte;
  ancho_cm: number | null;
  alto_cm: number | null;
  anio: number | null;
  historia: string;
  precio: string | null;
  estado: Estado;
  visible: boolean;
  destacada: boolean;
  orden: number;
  imagen_path: string;
  imagen_ancho: number;
  imagen_alto: number;
  paleta: string[];
}

export interface Obra extends FilaObra {
  imagen_url: string;
  medidas: string;
}

export const BUCKET = "obras";
const URL_SB = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const LLAVE_SB = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const supabaseConfigurado = Boolean(URL_SB && LLAVE_SB);

/* "140 x 110 cm": el lado mayor primero, como en el dossier. Las esculturas muestran su alto. */
export function textoMedidas(o: Pick<FilaObra, "ancho_cm" | "alto_cm" | "soporte">) {
  const a = Number(o.ancho_cm) || 0;
  const h = Number(o.alto_cm) || 0;
  const f = (n: number) => String(n).replace(".", ",");
  if (o.soporte === "escultura" || !a) return h ? f(h) + " cm" : "";
  if (!h) return f(a) + " cm";
  return f(Math.max(a, h)) + " x " + f(Math.min(a, h)) + " cm";
}

export function urlImagen(path: string) {
  if (!supabaseConfigurado) return "/assets/obras/" + path;
  return URL_SB!.replace(/\/$/, "") + "/storage/v1/object/public/" + BUCKET + "/" + path.split("/").map(encodeURIComponent).join("/");
}

function completar(f: FilaObra): Obra {
  return {
    ...f,
    ancho_cm: f.ancho_cm == null ? null : Number(f.ancho_cm),
    alto_cm: f.alto_cm == null ? null : Number(f.alto_cm),
    estado: f.estado ?? "disponible",
    paleta: f.paleta && f.paleta.length ? f.paleta : ["#f4b6c8", "#a9d8ef", "#f6e7a1"],
    imagen_url: urlImagen(f.imagen_path),
    medidas: textoMedidas(f),
  };
}

/* Sin Supabase configurado, la galería usa las obras del dossier guardadas en el proyecto. */
export async function cargarObras(): Promise<{ obras: Obra[]; error: boolean }> {
  if (!supabaseConfigurado) {
    return { obras: (iniciales as FilaObra[]).filter((o) => o.visible).map(completar), error: false };
  }
  const sb = createClient(URL_SB!, LLAVE_SB!, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("obras")
    .select("*")
    .eq("visible", true)
    .order("orden", { ascending: true })
    .order("creado", { ascending: false });
  if (error) {
    console.error("No se pudieron cargar las obras", error);
    return { obras: [], error: true };
  }
  return { obras: (data as FilaObra[]).map(completar), error: false };
}
