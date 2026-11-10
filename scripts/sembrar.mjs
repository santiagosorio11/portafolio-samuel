/*
  Sube las obras de src/data/obras-iniciales.json a Supabase (fotos al bucket y filas a la tabla).
  Los textos e imágenes del sitio no se siembran: salen de src/data/contenido.json
  hasta que Samuel los cambie desde el panel.
  Uso, una sola vez y desde tu computador:  npm run sembrar
  Necesita en .env: PUBLIC_SUPABASE_URL y una llave secreta: SUPABASE_SECRET_KEY (sb_secret_...)
  o, con las llaves antiguas, SUPABASE_SERVICE_ROLE_KEY.
  Si la tabla ya tiene obras, no hace nada.
*/
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const url = process.env.PUBLIC_SUPABASE_URL;
const llave = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !llave) {
  console.error("Faltan PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY) en el archivo .env");
  process.exit(1);
}

const sb = createClient(url, llave, { auth: { persistSession: false } });
const obras = JSON.parse(await readFile(new URL("../src/data/obras-iniciales.json", import.meta.url), "utf8"));

const { count, error: errorConteo } = await sb.from("obras").select("id", { count: "exact", head: true });
if (errorConteo) {
  console.error("No pude leer la tabla obras. ¿Ejecutaste supabase/esquema.sql?", errorConteo.message);
  process.exit(1);
}
if (count > 0) {
  console.log(`La tabla ya tiene ${count} obras. No se sembró nada.`);
  process.exit(0);
}

for (const obra of obras) {
  const archivo = await readFile(new URL(`../public/assets/obras/${obra.imagen_path}`, import.meta.url));
  const { error: errorFoto } = await sb.storage.from("obras").upload(obra.imagen_path, archivo, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: true,
  });
  if (errorFoto) throw new Error(`Foto de ${obra.titulo}: ${errorFoto.message}`);
  const { error } = await sb.from("obras").insert(obra);
  if (error) throw new Error(`Fila de ${obra.titulo}: ${error.message}`);
  console.log("Subida:", obra.titulo);
}
console.log(`Listo, ${obras.length} obras en Supabase.`);
