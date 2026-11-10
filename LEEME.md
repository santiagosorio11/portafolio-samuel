# Galería Sam Velásquez

Sitio en Astro con panel de administración en `/admin`. Las obras, sus fotos y el login viven en Supabase.

Sin Supabase configurado, el sitio funciona con las 10 obras del dossier que vienen en el proyecto (útil para desarrollo).

## Puesta en marcha (una sola vez)

1. **Crear el proyecto** en la cuenta de Supabase que vas a usar.
2. **Base de datos y bucket:** en *SQL Editor*, pega y ejecuta todo [supabase/esquema.sql](supabase/esquema.sql).
3. **Usuario de Samuel:** en *Authentication > Users > Add user* crea su correo y contraseña, con "Auto Confirm User" marcado. Luego, en *SQL Editor*:
   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'CORREO-DE-SAMUEL';
   ```
4. **Cerrar registros:** en *Authentication > Sign In / Providers > Email*, desactiva "Allow new users to sign up". Aunque alguien se registre, no podría editar nada, pero así queda más limpio.
5. **Correos de recuperación:** en *Authentication > URL Configuration* pon como *Site URL* el dominio del sitio y agrega `https://TU-DOMINIO/admin` en *Redirect URLs*.
6. **Variables:** copia `.env.example` como `.env` y llena `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` y, solo para el paso siguiente, `SUPABASE_SERVICE_ROLE_KEY` (*Project Settings > API*).
7. **Subir las obras del dossier:** `npm run sembrar`. Después puedes borrar la service role key del `.env`.

## Publicar en Vercel

Importa el repositorio en Vercel (detecta Astro solo) y agrega solo estas dos variables de entorno:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`

La `SUPABASE_SERVICE_ROLE_KEY` nunca va en Vercel.

## Día a día

- Samuel entra a `https://TU-DOMINIO/admin` con su correo y contraseña.
- Puede subir obras (la foto se reduce sola antes de subirse), editarlas, ocultarlas, marcarlas como vendidas, elegir las de la portada, cambiar el orden del muro y eliminarlas.
- El muro en mosaico se acomoda solo según el tamaño real y la proporción de cada obra.
- La página pública se actualiza en más o menos un minuto (caché de la CDN).

## Comandos

```bash
npm install
npm run dev       # http://localhost:4321
npm run build
npm run sembrar   # una sola vez, ver arriba
```

## Dónde está cada cosa

- `src/pages/index.astro`: la página pública. `src/components/`: cada sección.
- `src/lib/mosaico.ts`: el acomodo automático del muro.
- `src/scripts/sitio.js` y `src/scripts/pincel.js`: animaciones, pinceladas y ficha de cada obra.
- `src/pages/admin/index.astro` y `src/scripts/admin.js`: el panel.
- `src/lib/contacto.ts`: número de WhatsApp y mensajes.
- Fuente de títulos: para usar Bropella (licencia comercial), copia el archivo en `public/assets/fuentes/` y cambia el `@font-face` al inicio de `src/styles/estilos.css`.
