import { createClient } from "@supabase/supabase-js";
import iconos from "../data/iconos.json";

var sb = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.PUBLIC_SUPABASE_ANON_KEY);
var BUCKET = "obras";
var $ = function (s, c) { return (c || document).querySelector(s); };
var vistas = ["cargando", "login", "clave", "lista"];
var obras = [];
var editando = null;
var fotoNueva = null;
var porBorrar = null;
var enRecuperacion = false;

function mostrar(nombre) {
  vistas.forEach(function (v) { $("#vista-" + v).hidden = v !== nombre; });
  $("#salir").hidden = nombre !== "lista";
}

function error(form, texto) {
  var p = $(".adm-error", form);
  p.textContent = texto || "";
  p.hidden = !texto;
}

var reloj = 0;
function avisar(texto) {
  var a = $("#aviso");
  a.textContent = texto;
  a.classList.add("visible");
  clearTimeout(reloj);
  reloj = setTimeout(function () { a.classList.remove("visible"); }, 3200);
}

function el(etiqueta, clase, texto) {
  var e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto != null) e.textContent = texto;
  return e;
}

function boton(icono, etiqueta, accion, clase) {
  var b = el("button", "adm-icono" + (clase ? " " + clase : ""));
  b.type = "button";
  b.innerHTML = iconos[icono];
  b.setAttribute("aria-label", etiqueta);
  b.title = etiqueta;
  b.addEventListener("click", accion);
  return b;
}

function urlFoto(path) {
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function medidas(o) {
  var a = Number(o.ancho_cm) || 0, h = Number(o.alto_cm) || 0;
  var f = function (n) { return String(n).replace(".", ","); };
  if (o.soporte === "escultura" || !a) return h ? f(h) + " cm" : "";
  if (!h) return f(a) + " cm";
  return f(Math.max(a, h)) + " x " + f(Math.min(a, h)) + " cm";
}

function slugDe(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "obra";
}

/* ---------- Sesión ---------- */
async function verificarSesion(sesion) {
  if (enRecuperacion) { mostrar("clave"); return; }
  if (!sesion) { mostrar("login"); return; }
  var r = await sb.from("admins").select("user_id").eq("user_id", sesion.user.id).maybeSingle();
  if (r.error || !r.data) {
    await sb.auth.signOut();
    mostrar("login");
    error($("#form-login"), "Esta cuenta no tiene permiso para administrar la galería.");
    return;
  }
  mostrar("lista");
  cargar();
}

sb.auth.onAuthStateChange(function (evento, sesion) {
  if (evento === "PASSWORD_RECOVERY") { enRecuperacion = true; mostrar("clave"); return; }
  if (evento === "INITIAL_SESSION" || evento === "SIGNED_IN" || evento === "SIGNED_OUT") {
    setTimeout(function () { verificarSesion(sesion); }, 0);
  }
});

$("#form-login").addEventListener("submit", async function (e) {
  e.preventDefault();
  var f = e.currentTarget;
  error(f, "");
  var correo = f.correo.value.trim(), clave = f.clave.value;
  if (!correo || !clave) { error(f, "Escribe tu correo y tu contraseña."); return; }
  var b = $("button[type=submit]", f);
  b.disabled = true; b.textContent = "Entrando…";
  var r = await sb.auth.signInWithPassword({ email: correo, password: clave });
  b.disabled = false; b.textContent = "Entrar";
  if (r.error) error(f, "Correo o contraseña incorrectos.");
});

$("#olvide").addEventListener("click", async function () {
  var f = $("#form-login");
  var correo = f.correo.value.trim();
  if (!correo) { error(f, "Escribe tu correo arriba y vuelve a tocar “Olvidé mi contraseña”."); f.correo.focus(); return; }
  var r = await sb.auth.resetPasswordForEmail(correo, { redirectTo: location.origin + "/admin" });
  if (r.error) error(f, "No se pudo enviar el correo. Intenta de nuevo en unos minutos.");
  else { error(f, ""); avisar("Te enviamos un correo para crear una nueva contraseña."); }
});

$("#form-clave").addEventListener("submit", async function (e) {
  e.preventDefault();
  var f = e.currentTarget;
  if (f.clave.value.length < 8) { error(f, "La contraseña debe tener al menos 8 caracteres."); return; }
  var r = await sb.auth.updateUser({ password: f.clave.value });
  if (r.error) { error(f, "No se pudo guardar. Pide un correo nuevo de recuperación."); return; }
  enRecuperacion = false;
  history.replaceState(null, "", "/admin");
  avisar("Contraseña actualizada.");
  var s = await sb.auth.getSession();
  verificarSesion(s.data.session);
});

$("#salir").addEventListener("click", function () { sb.auth.signOut(); });

/* ---------- Lista ---------- */
async function cargar() {
  var r = await sb.from("obras").select("*").order("orden", { ascending: true }).order("creado", { ascending: false });
  var p = $("#error-lista");
  if (r.error) {
    p.textContent = "No se pudieron cargar las obras. Revisa tu conexión y recarga la página.";
    p.hidden = false;
    return;
  }
  p.hidden = true;
  obras = r.data;
  pintarLista();
}

function pintarLista() {
  var ul = $("#lista");
  ul.textContent = "";
  $("#conteo").textContent = obras.length ? "(" + obras.length + ")" : "";
  $("#lista-vacia").hidden = obras.length > 0;
  obras.forEach(function (o, i) {
    var li = el("li", "adm-obra" + (o.visible ? "" : " adm-obra--oculta"));
    var img = el("img");
    img.src = urlFoto(o.imagen_path);
    img.alt = "";
    img.loading = "lazy";
    li.appendChild(img);

    var info = el("div", "adm-obra__info");
    info.appendChild(el("h3", null, o.titulo));
    info.appendChild(el("p", null, [medidas(o), o.anio].filter(Boolean).join(", ") || "Sin medidas"));
    var marcas = el("div", "adm-marcas");
    if (!o.visible) marcas.appendChild(el("span", "adm-marca adm-marca--oculta", "Oculta"));
    if (o.vendida) marcas.appendChild(el("span", "adm-marca adm-marca--vendida", "Vendida"));
    if (o.destacada) marcas.appendChild(el("span", "adm-marca adm-marca--portada", "Portada"));
    if (o.precio && !o.vendida) marcas.appendChild(el("span", "adm-marca", o.precio));
    info.appendChild(marcas);
    li.appendChild(info);

    var acciones = el("div", "adm-obra__acciones");
    var subir = boton("subir", "Subir en el muro", function () { mover(i, -1); });
    var bajar = boton("bajar", "Bajar en el muro", function () { mover(i, 1); });
    subir.disabled = i === 0;
    bajar.disabled = i === obras.length - 1;
    acciones.appendChild(subir);
    acciones.appendChild(bajar);
    acciones.appendChild(boton(o.visible ? "ver" : "ocultar", o.visible ? "Ocultar del sitio" : "Mostrar en el sitio", function () { alternarVisible(o); }));
    acciones.appendChild(boton("editar", "Editar", function () { abrirEditor(o); }));
    acciones.appendChild(boton("borrar", "Eliminar", function () { pedirBorrar(o); }, "adm-icono--peligro"));
    li.appendChild(acciones);
    ul.appendChild(li);
  });
}

async function mover(i, paso) {
  var j = i + paso;
  if (j < 0 || j >= obras.length) return;
  var copia = obras.slice();
  var t = copia[i]; copia[i] = copia[j]; copia[j] = t;
  var cambios = [];
  copia.forEach(function (o, n) {
    if (o.orden !== n * 10) { o.orden = n * 10; cambios.push(o); }
  });
  obras = copia;
  pintarLista();
  var rs = await Promise.all(cambios.map(function (o) { return sb.from("obras").update({ orden: o.orden }).eq("id", o.id); }));
  if (rs.some(function (r) { return r.error; })) { avisar("No se pudo guardar el nuevo orden."); cargar(); }
}

async function alternarVisible(o) {
  var r = await sb.from("obras").update({ visible: !o.visible }).eq("id", o.id);
  if (r.error) { avisar("No se pudo cambiar la visibilidad."); return; }
  o.visible = !o.visible;
  pintarLista();
  avisar(o.visible ? "La obra ya se muestra en el sitio." : "La obra quedó oculta.");
}

/* ---------- Foto: reducir, convertir y sacar la paleta ---------- */
function hslAHex(h, s, l) {
  var a = s * Math.min(l, 1 - l);
  var f = function (n) {
    var k = (n + h / 30) % 12;
    var c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return "#" + f(0) + f(8) + f(4);
}

function paletaDe(canvas) {
  var c = document.createElement("canvas");
  c.width = c.height = 48;
  var ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, 48, 48);
  var px = ctx.getImageData(0, 0, 48, 48).data;
  var cubetas = new Array(12).fill(0).map(function () { return { peso: 0, x: 0, y: 0 }; });
  for (var i = 0; i < px.length; i += 4) {
    var r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    if (d < 0.08 || l < 0.12 || l > 0.94) continue;
    var s = d / (1 - Math.abs(2 * l - 1));
    var h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    var k = Math.floor(h / 30) % 12, ang = (h * Math.PI) / 180;
    cubetas[k].peso += s;
    cubetas[k].x += Math.cos(ang) * s;
    cubetas[k].y += Math.sin(ang) * s;
  }
  var colores = cubetas
    .filter(function (c) { return c.peso > 4; })
    .sort(function (a, b) { return b.peso - a.peso; })
    .slice(0, 5)
    .map(function (c) { return hslAHex((Math.atan2(c.y, c.x) * 180 / Math.PI + 360) % 360, 0.72, 0.76); });
  return colores.length ? colores : ["#f4b6c8", "#a9d8ef", "#f6e7a1"];
}

async function procesarFoto(archivo) {
  var fuente = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  var escala = Math.min(1, 1800 / Math.max(fuente.width, fuente.height));
  var w = Math.round(fuente.width * escala), h = Math.round(fuente.height * escala);
  var c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").drawImage(fuente, 0, 0, w, h);
  var blob = await new Promise(function (ok) { c.toBlob(ok, "image/webp", 0.86); });
  if (!blob || blob.type !== "image/webp") blob = await new Promise(function (ok) { c.toBlob(ok, "image/jpeg", 0.88); });
  return { blob: blob, ancho: w, alto: h, paleta: paletaDe(c), ext: blob.type === "image/webp" ? "webp" : "jpg" };
}

/* ---------- Editor ---------- */
var editor = $("#editor");
var formObra = $("#form-obra");

function abrirEditor(o) {
  editando = o || null;
  fotoNueva = null;
  formObra.reset();
  error(formObra, "");
  $("#editor-titulo").textContent = o ? "Editar obra" : "Nueva obra";
  var vista = $("#vista-foto");
  if (o) {
    ["titulo", "tecnica", "soporte", "anio", "historia", "precio"].forEach(function (k) { formObra[k].value = o[k] == null ? "" : o[k]; });
    formObra.ancho_cm.value = o.ancho_cm == null ? "" : String(o.ancho_cm).replace(".", ",");
    formObra.alto_cm.value = o.alto_cm == null ? "" : String(o.alto_cm).replace(".", ",");
    formObra.visible.checked = o.visible;
    formObra.vendida.checked = o.vendida;
    formObra.destacada.checked = o.destacada;
    vista.src = urlFoto(o.imagen_path);
    vista.hidden = false;
    $("#texto-foto").lastChild.textContent = "Cambiar foto";
  } else {
    formObra.visible.checked = true;
    vista.hidden = true;
    vista.removeAttribute("src");
    $("#texto-foto").lastChild.textContent = "Elegir foto de la obra";
  }
  editor.showModal();
  formObra.titulo.focus();
}

$("#nueva").addEventListener("click", function () { abrirEditor(null); });
document.querySelectorAll("[data-cerrar]").forEach(function (b) {
  b.addEventListener("click", function () { b.closest("dialog").close(); });
});

formObra.foto.addEventListener("change", async function () {
  var archivo = formObra.foto.files[0];
  if (!archivo) return;
  error(formObra, "");
  try {
    fotoNueva = await procesarFoto(archivo);
    var vista = $("#vista-foto");
    if (vista.src.indexOf("blob:") === 0) URL.revokeObjectURL(vista.src);
    vista.src = URL.createObjectURL(fotoNueva.blob);
    vista.hidden = false;
    $("#texto-foto").lastChild.textContent = "Cambiar foto";
  } catch (e) {
    fotoNueva = null;
    formObra.foto.value = "";
    error(formObra, "No se pudo leer esa imagen. Usa una foto JPG, PNG o WEBP.");
  }
});

function numero(v) {
  v = String(v || "").trim().replace(",", ".");
  if (!v) return null;
  var n = Number(v);
  return isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : NaN;
}

formObra.addEventListener("submit", async function (e) {
  e.preventDefault();
  error(formObra, "");
  var titulo = formObra.titulo.value.trim();
  if (!titulo) { error(formObra, "La obra necesita un título."); formObra.titulo.focus(); return; }
  if (!editando && !fotoNueva) { error(formObra, "Elige la foto de la obra."); return; }
  var ancho = numero(formObra.ancho_cm.value), alto = numero(formObra.alto_cm.value);
  if (Number.isNaN(ancho) || Number.isNaN(alto)) { error(formObra, "Las medidas deben ser números, por ejemplo 110 o 50,5."); return; }
  var anio = formObra.anio.value ? parseInt(formObra.anio.value, 10) : null;
  if (anio != null && (anio < 1990 || anio > 2100)) { error(formObra, "Revisa el año."); return; }

  var datos = {
    titulo: titulo,
    tecnica: formObra.tecnica.value.trim(),
    soporte: formObra.soporte.value,
    ancho_cm: ancho,
    alto_cm: alto,
    anio: anio,
    historia: formObra.historia.value.trim(),
    precio: formObra.precio.value.trim() || null,
    visible: formObra.visible.checked,
    vendida: formObra.vendida.checked,
    destacada: formObra.destacada.checked,
  };

  var guardar = $("#guardar");
  guardar.disabled = true;
  guardar.textContent = "Guardando…";
  var subida = null;
  try {
    var slug = editando ? editando.slug : slugDe(titulo);
    if (fotoNueva) {
      subida = slug + "-" + Date.now().toString(36) + "." + fotoNueva.ext;
      var up = await sb.storage.from(BUCKET).upload(subida, fotoNueva.blob, { contentType: fotoNueva.blob.type, cacheControl: "31536000" });
      if (up.error) throw new Error("foto");
      datos.imagen_path = subida;
      datos.imagen_ancho = fotoNueva.ancho;
      datos.imagen_alto = fotoNueva.alto;
      datos.paleta = fotoNueva.paleta;
    }
    var r;
    if (editando) {
      r = await sb.from("obras").update(datos).eq("id", editando.id);
    } else {
      datos.orden = obras.length ? Math.min.apply(null, obras.map(function (o) { return o.orden; })) - 10 : 0;
      datos.slug = slug;
      r = await sb.from("obras").insert(datos);
      if (r.error && r.error.code === "23505") {
        datos.slug = slug + "-" + Date.now().toString(36).slice(-4);
        r = await sb.from("obras").insert(datos);
      }
    }
    if (r.error) throw new Error("fila");
    if (editando && subida && editando.imagen_path !== subida) {
      await sb.storage.from(BUCKET).remove([editando.imagen_path]);
    }
    editor.close();
    avisar(editando ? "Cambios guardados." : "Obra agregada al muro.");
    cargar();
  } catch (err) {
    if (subida) await sb.storage.from(BUCKET).remove([subida]);
    error(formObra, err.message === "foto" ? "No se pudo subir la foto. Revisa tu conexión e intenta de nuevo." : "No se pudo guardar la obra. Intenta de nuevo.");
  } finally {
    guardar.disabled = false;
    guardar.textContent = "Guardar obra";
  }
});

/* ---------- Eliminar ---------- */
var confirmar = $("#confirmar");
function pedirBorrar(o) {
  porBorrar = o;
  $("#confirmar-texto").textContent = "“" + o.titulo + "” y su foto se borrarán para siempre. Si solo quieres quitarla del sitio por un tiempo, usa el botón del ojo para ocultarla.";
  confirmar.showModal();
}
$("#confirmar-si").addEventListener("click", async function () {
  var o = porBorrar;
  if (!o) return;
  var b = this;
  b.disabled = true;
  var r = await sb.from("obras").delete().eq("id", o.id);
  b.disabled = false;
  confirmar.close();
  if (r.error) { avisar("No se pudo eliminar la obra."); return; }
  await sb.storage.from(BUCKET).remove([o.imagen_path]);
  avisar("Obra eliminada.");
  cargar();
});
