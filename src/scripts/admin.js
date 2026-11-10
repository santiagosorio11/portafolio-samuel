import { createClient } from "@supabase/supabase-js";
import iconos from "../data/iconos.json";
import secciones from "../data/contenido.json";

var sb = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.PUBLIC_SUPABASE_ANON_KEY);
var BUCKET = "obras";
var $ = function (s, c) { return (c || document).querySelector(s); };
var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
var vistas = ["cargando", "login", "clave", "obras", "contenido"];
var ESTADOS = {
  disponible: { nombre: "Disponible", ayuda: "Se puede comprar. Muestra el precio (o “Precio a consultar”) y el botón “Me interesa esta obra”." },
  reservada: { nombre: "Reservada", ayuda: "Alguien la apartó. En el sitio dice “Reservada” y el botón invita a pedir una similar." },
  vendida: { nombre: "Vendida", ayuda: "En el sitio dice “Colección privada” y el botón invita a pedir una similar." },
  no_disponible: { nombre: "No disponible", ayuda: "Se muestra en el muro pero no está a la venta (por ejemplo, colección personal)." },
};
var obras = [];
var filtro = "todas";
var busqueda = "";
var editando = null;
var fotoNueva = null;
var porBorrar = null;
var enRecuperacion = false;
var pestana = "obras";
var sesionLista = false;

function mostrar(nombre) {
  vistas.forEach(function (v) { $("#vista-" + v).hidden = v !== nombre; });
  var dentro = nombre === "obras" || nombre === "contenido";
  $("#salir").hidden = !dentro;
  $("#pestanas").hidden = !dentro;
  $$("#pestanas [data-pestana]").forEach(function (b) {
    if (b.dataset.pestana === nombre) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
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

/* Rutas con "/" son archivos del proyecto; las demás están en el bucket. */
function urlFoto(path) {
  if (!path || path.charAt(0) === "/") return path;
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

/* "noches_oscuras-del alma (2).jpg" -> "Noches Oscuras Del Alma" */
function tituloDeArchivo(nombre) {
  var t = nombre.replace(/\.[a-z0-9]+$/i, "").replace(/\(\d+\)/g, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return "Obra sin título";
  return t.split(" ").map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join(" ").slice(0, 120);
}

/* ---------- Sesión ---------- */
async function verificarSesion(sesion) {
  if (enRecuperacion) { mostrar("clave"); return; }
  if (!sesion) { sesionLista = false; mostrar("login"); return; }
  var r = await sb.from("admins").select("user_id").eq("user_id", sesion.user.id).maybeSingle();
  if (r.error || !r.data) {
    await sb.auth.signOut();
    mostrar("login");
    error($("#form-login"), "Esta cuenta no tiene permiso para administrar la galería.");
    return;
  }
  if (sesionLista) return;
  sesionLista = true;
  irA(location.hash === "#contenido" ? "contenido" : "obras");
  cargar();
  cargarContenido();
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

$("#salir").addEventListener("click", function () {
  if (hayPendientes() && !confirm("Tienes cambios de textos sin guardar. ¿Salir de todas formas?")) return;
  sb.auth.signOut();
});

/* ---------- Pestañas ---------- */
function irA(nombre) {
  pestana = nombre;
  mostrar(nombre);
  history.replaceState(null, "", nombre === "contenido" ? "#contenido" : location.pathname);
}
$$("#pestanas [data-pestana]").forEach(function (b) {
  b.addEventListener("click", function () { irA(b.dataset.pestana); });
});

/* ---------- Lista de obras ---------- */
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

function pasaFiltro(o) {
  if (busqueda && slugDe(o.titulo).indexOf(slugDe(busqueda)) === -1) return false;
  if (filtro === "todas") return true;
  if (filtro === "oculta") return !o.visible;
  return o.estado === filtro;
}

function selectorEstado(o) {
  var s = el("select", "adm-estado-rapido adm-estado-rapido--" + o.estado);
  s.setAttribute("aria-label", "Estado de venta de " + o.titulo);
  Object.keys(ESTADOS).forEach(function (k) {
    var op = el("option", null, ESTADOS[k].nombre);
    op.value = k;
    op.selected = o.estado === k;
    s.appendChild(op);
  });
  s.addEventListener("change", async function () {
    var antes = o.estado;
    var nuevo = s.value;
    s.disabled = true;
    var r = await sb.from("obras").update({ estado: nuevo }).eq("id", o.id);
    s.disabled = false;
    if (r.error) { s.value = antes; avisar("No se pudo cambiar el estado."); return; }
    o.estado = nuevo;
    s.className = "adm-estado-rapido adm-estado-rapido--" + nuevo;
    avisar("“" + o.titulo + "” ahora está " + ESTADOS[nuevo].nombre.toLowerCase() + ".");
    contarFiltros();
    if (filtro !== "todas") pintarLista();
  });
  return s;
}

function contarFiltros() {
  $$("#filtros [data-filtro]").forEach(function (b) {
    var k = b.dataset.filtro;
    var n = k === "todas" ? obras.length : obras.filter(function (o) { return k === "oculta" ? !o.visible : o.estado === k; }).length;
    var base = b.dataset.nombre || (b.dataset.nombre = b.textContent);
    b.textContent = base + (n ? " · " + n : "");
    b.hidden = k !== "todas" && n === 0 && filtro !== k;
  });
}

function pintarLista() {
  var ul = $("#lista");
  ul.textContent = "";
  $("#conteo").textContent = obras.length ? "(" + obras.length + ")" : "";
  $("#lista-vacia").hidden = obras.length > 0;
  contarFiltros();
  var puedeOrdenar = filtro === "todas" && !busqueda;
  $("#nota-orden").hidden = puedeOrdenar || obras.length < 2;
  var vistas = obras.filter(pasaFiltro);
  $("#sin-resultados").hidden = !(obras.length && !vistas.length);
  vistas.forEach(function (o) {
    var i = obras.indexOf(o);
    var li = el("li", "adm-obra" + (o.visible ? "" : " adm-obra--oculta"));
    var img = el("img");
    img.src = urlFoto(o.imagen_path);
    img.alt = "";
    img.loading = "lazy";
    li.appendChild(img);

    var info = el("div", "adm-obra__info");
    info.appendChild(el("h3", null, o.titulo));
    var faltan = [];
    if (!o.ancho_cm && !o.alto_cm) faltan.push("medidas");
    if (!o.historia) faltan.push("historia");
    info.appendChild(el("p", null, [medidas(o), o.anio].filter(Boolean).join(", ") || "Sin medidas"));
    var marcas = el("div", "adm-marcas");
    if (!o.visible) marcas.appendChild(el("span", "adm-marca adm-marca--oculta", "Oculta"));
    if (o.destacada) marcas.appendChild(el("span", "adm-marca adm-marca--portada", "Portada"));
    if (o.precio && o.estado === "disponible") marcas.appendChild(el("span", "adm-marca", o.precio));
    if (faltan.length) marcas.appendChild(el("span", "adm-marca adm-marca--falta", "Falta: " + faltan.join(" y ")));
    info.appendChild(marcas);
    li.appendChild(info);

    var acciones = el("div", "adm-obra__acciones");
    acciones.appendChild(selectorEstado(o));
    if (puedeOrdenar) {
      var subir = boton("subir", "Subir en el muro", function () { mover(i, -1); });
      var bajar = boton("bajar", "Bajar en el muro", function () { mover(i, 1); });
      subir.disabled = i === 0;
      bajar.disabled = i === obras.length - 1;
      acciones.appendChild(subir);
      acciones.appendChild(bajar);
    }
    acciones.appendChild(boton(o.visible ? "ver" : "ocultar", o.visible ? "Ocultar del sitio" : "Mostrar en el sitio", function () { alternarVisible(o); }));
    acciones.appendChild(boton("editar", "Editar", function () { abrirEditor(o); }));
    acciones.appendChild(boton("borrar", "Eliminar", function () { pedirBorrar(o); }, "adm-icono--peligro"));
    li.appendChild(acciones);
    ul.appendChild(li);
  });
}

$$("#filtros [data-filtro]").forEach(function (b) {
  b.addEventListener("click", function () {
    filtro = b.dataset.filtro;
    $$("#filtros [data-filtro]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    pintarLista();
  });
});
$("#buscar").addEventListener("input", function (e) { busqueda = e.target.value.trim(); pintarLista(); });

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

async function procesarFoto(archivo, lado) {
  var fuente = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  var escala = Math.min(1, (lado || 1800) / Math.max(fuente.width, fuente.height));
  var w = Math.round(fuente.width * escala), h = Math.round(fuente.height * escala);
  var c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").drawImage(fuente, 0, 0, w, h);
  var blob = await new Promise(function (ok) { c.toBlob(ok, "image/webp", 0.86); });
  if (!blob || blob.type !== "image/webp") blob = await new Promise(function (ok) { c.toBlob(ok, "image/jpeg", 0.88); });
  return { blob: blob, ancho: w, alto: h, paleta: paletaDe(c), ext: blob.type === "image/webp" ? "webp" : "jpg" };
}

function esImagen(f) { return /^image\/(jpeg|png|webp)$/.test(f.type); }

/* ---------- Subir varias fotos a la vez ---------- */
/* Cada foto se convierte en una obra oculta con el nombre del archivo como título,
   para completar sus datos después con calma. */
async function subirVarias(archivos) {
  archivos = Array.prototype.filter.call(archivos, esImagen);
  if (!archivos.length) { avisar("Usa fotos JPG, PNG o WEBP."); return; }
  var prog = $("#progreso"), texto = $("#progreso-texto"), barra = $("#progreso-barra");
  prog.hidden = false;
  var ok = 0, fallas = [];
  var minimo = obras.length ? Math.min.apply(null, obras.map(function (o) { return o.orden; })) : 0;
  for (var n = 0; n < archivos.length; n++) {
    var a = archivos[n];
    texto.textContent = "Subiendo " + (n + 1) + " de " + archivos.length + ": " + a.name;
    barra.style.width = (n / archivos.length) * 100 + "%";
    var subida = null;
    try {
      var foto = await procesarFoto(a);
      var titulo = tituloDeArchivo(a.name);
      var slug = slugDe(titulo) + "-" + Date.now().toString(36).slice(-5);
      subida = slug + "." + foto.ext;
      var up = await sb.storage.from(BUCKET).upload(subida, foto.blob, { contentType: foto.blob.type, cacheControl: "31536000" });
      if (up.error) throw up.error;
      var r = await sb.from("obras").insert({
        slug: slug, titulo: titulo, visible: false, estado: "disponible",
        orden: minimo - (archivos.length - n) * 10,
        imagen_path: subida, imagen_ancho: foto.ancho, imagen_alto: foto.alto, paleta: foto.paleta,
      });
      if (r.error) throw r.error;
      ok++;
    } catch (e) {
      if (subida) await sb.storage.from(BUCKET).remove([subida]);
      fallas.push(a.name);
    }
  }
  barra.style.width = "100%";
  prog.hidden = true;
  await cargar();
  if (ok) {
    filtro = "oculta";
    $$("#filtros [data-filtro]").forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.filtro === "oculta")); });
    pintarLista();
  }
  avisar(
    (ok ? ok + (ok === 1 ? " obra creada" : " obras creadas") + " como ocultas. Completa sus datos y muéstralas." : "") +
    (fallas.length ? " No se pudieron subir: " + fallas.join(", ") + "." : "")
  );
}

$("#varias").addEventListener("change", function (e) {
  var fs = e.target.files;
  if (fs && fs.length) subirVarias(fs);
  e.target.value = "";
});

/* Arrastrar fotos sobre la pestaña de obras. */
var capa = $("#capa-soltar");
var profundidad = 0;
function arrastraArchivos(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, "Files") !== -1; }
document.addEventListener("dragenter", function (e) {
  if (pestana !== "obras" || $("#vista-obras").hidden || editor.open || !arrastraArchivos(e)) return;
  profundidad++;
  capa.classList.add("visible");
});
document.addEventListener("dragleave", function () {
  if (profundidad && --profundidad === 0) capa.classList.remove("visible");
});
document.addEventListener("dragover", function (e) { if (arrastraArchivos(e)) e.preventDefault(); });
document.addEventListener("drop", function (e) {
  if (!arrastraArchivos(e)) return;
  e.preventDefault();
  profundidad = 0;
  capa.classList.remove("visible");
  if (editor.open || pestana !== "obras" || $("#vista-obras").hidden) return;
  subirVarias(e.dataTransfer.files);
});

/* ---------- Editor de obra ---------- */
var editor = $("#editor");
var formObra = $("#form-obra");

function estadoElegido() { return (formObra.querySelector("input[name=estado]:checked") || {}).value || "disponible"; }
function reflejarEstado() {
  var e = estadoElegido();
  $("#ayuda-estado").textContent = ESTADOS[e].ayuda;
  $("#campo-precio").hidden = e !== "disponible";
}
$$("input[name=estado]", formObra).forEach(function (r) { r.addEventListener("change", reflejarEstado); });

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
    formObra.destacada.checked = o.destacada;
    formObra.querySelector("input[name=estado][value=" + (o.estado || "disponible") + "]").checked = true;
    vista.src = urlFoto(o.imagen_path);
    vista.hidden = false;
    $("#texto-foto").lastChild.textContent = "Cambiar foto";
  } else {
    formObra.visible.checked = true;
    vista.hidden = true;
    vista.removeAttribute("src");
    $("#texto-foto").lastChild.textContent = "Elegir o arrastrar la foto";
  }
  reflejarEstado();
  editor.showModal();
  formObra.titulo.focus();
}

$("#nueva").addEventListener("click", function () { abrirEditor(null); });
document.querySelectorAll("[data-cerrar]").forEach(function (b) {
  b.addEventListener("click", function () { b.closest("dialog").close(); });
});

async function usarFoto(archivo) {
  if (!archivo) return;
  error(formObra, "");
  if (!esImagen(archivo)) { error(formObra, "Usa una foto JPG, PNG o WEBP."); return; }
  try {
    fotoNueva = await procesarFoto(archivo);
    var vista = $("#vista-foto");
    if (vista.src.indexOf("blob:") === 0) URL.revokeObjectURL(vista.src);
    vista.src = URL.createObjectURL(fotoNueva.blob);
    vista.hidden = false;
    $("#texto-foto").lastChild.textContent = "Cambiar foto";
    if (!editando && !formObra.titulo.value.trim()) formObra.titulo.value = tituloDeArchivo(archivo.name);
  } catch (e) {
    fotoNueva = null;
    formObra.foto.value = "";
    error(formObra, "No se pudo leer esa imagen. Usa una foto JPG, PNG o WEBP.");
  }
}
formObra.foto.addEventListener("change", function () { usarFoto(formObra.foto.files[0]); });
var zona = $("#zona-foto");
zona.addEventListener("dragover", function (e) { e.preventDefault(); zona.classList.add("encima"); });
zona.addEventListener("dragleave", function () { zona.classList.remove("encima"); });
zona.addEventListener("drop", function (e) {
  e.preventDefault();
  e.stopPropagation();
  zona.classList.remove("encima");
  usarFoto(e.dataTransfer.files[0]);
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
    estado: estadoElegido(),
    visible: formObra.visible.checked,
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
  $("#confirmar-texto").textContent = "“" + o.titulo + "” y su foto se borrarán para siempre. Si solo quieres quitarla del sitio por un tiempo, usa el botón del ojo para ocultarla, o márcala como “No disponible”.";
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

/* ---------- Textos e imágenes del sitio ---------- */
/* Base: lo que trae el proyecto. Guardado: lo que está en la tabla contenido.
   Borrador: lo que Samuel está editando y aún no guarda. */
var base = {};
var guardado = {};
var borrador = {};
var fotosNuevas = {};
secciones.forEach(function (s) { s.campos.forEach(function (c) { base[c.clave] = c; }); });

function actual(clave) {
  if (borrador[clave]) return borrador[clave];
  if (guardado[clave]) return guardado[clave];
  var c = base[clave];
  return { valor: c.valor, alt: c.alt == null ? null : c.alt, ancho: c.ancho || null, alto: c.alto || null };
}
function esOriginal(clave, v) {
  var c = base[clave];
  if (c.tipo !== "imagen") return v.valor === c.valor;
  return v.valor === c.valor && (v.alt || "") === (c.alt || "");
}
function hayPendientes() { return Object.keys(borrador).length > 0; }

async function cargarContenido() {
  var r = await sb.from("contenido").select("clave, valor, alt, ancho, alto");
  var p = $("#error-contenido");
  if (r.error) {
    p.textContent = "No se pudo cargar el contenido guardado. Recarga la página.";
    p.hidden = false;
    return;
  }
  p.hidden = true;
  guardado = {};
  r.data.forEach(function (f) { if (base[f.clave]) guardado[f.clave] = { valor: f.valor, alt: f.alt, ancho: f.ancho, alto: f.alto }; });
  pintarSecciones();
}

/* Un campo queda pendiente solo si difiere de lo que ya está guardado (o del original). */
function marcar(clave, v) {
  var g = guardado[clave];
  var mismo = g ? v.valor === g.valor && (v.alt || "") === (g.alt || "") : esOriginal(clave, v);
  if (mismo) delete borrador[clave];
  else borrador[clave] = v;
  actualizarBarra();
}

function actualizarBarra() {
  var n = Object.keys(borrador).length;
  $("#barra-guardar").hidden = n === 0;
  $("#pendientes").textContent = n === 1 ? "1 cambio sin guardar" : n + " cambios sin guardar";
  $$(".adm-campo[data-clave]").forEach(function (c) {
    c.classList.toggle("adm-campo--cambiado", Boolean(borrador[c.dataset.clave]));
  });
  $$(".adm-seccion").forEach(function (d) {
    var cambios = $$(".adm-campo--cambiado", d).length;
    $(".adm-seccion__cambios", d).textContent = cambios ? cambios + " sin guardar" : "";
  });
}

function campoTexto(c) {
  var v = actual(c.clave);
  var caja = el("div", "adm-campo");
  caja.dataset.clave = c.clave;
  var id = "c-" + c.clave.replace(/\./g, "-");
  var lab = el("label", null, c.etiqueta);
  lab.htmlFor = id;
  caja.appendChild(lab);
  var input = c.tipo === "largo" ? el("textarea") : el("input");
  input.id = id;
  if (c.tipo === "largo") input.rows = Math.min(8, Math.max(2, Math.ceil(v.valor.length / 70) + (v.valor.match(/\n/g) || []).length));
  input.value = v.valor;
  input.maxLength = 4000;
  input.addEventListener("input", function () {
    marcar(c.clave, { valor: input.value, alt: null, ancho: null, alto: null });
    restaurar.hidden = input.value === c.valor;
  });
  caja.appendChild(input);
  var pie = el("div", "adm-campo__pie");
  if (c.ayuda) pie.appendChild(el("span", "adm-ayuda", c.ayuda));
  var restaurar = el("button", "adm-texto adm-restaurar", "Restaurar original");
  restaurar.type = "button";
  restaurar.hidden = v.valor === c.valor;
  restaurar.addEventListener("click", function () {
    input.value = c.valor;
    input.dispatchEvent(new Event("input"));
  });
  pie.appendChild(restaurar);
  caja.appendChild(pie);
  return caja;
}

function campoImagen(c) {
  var v = actual(c.clave);
  var caja = el("div", "adm-campo adm-campo--imagen");
  caja.dataset.clave = c.clave;
  caja.appendChild(el("span", "adm-campo__titulo", c.etiqueta));
  var fila = el("div", "adm-campo__img");
  var marco = el("label", "adm-mini");
  var img = el("img");
  img.alt = "";
  img.loading = "lazy";
  img.src = fotosNuevas[c.clave] ? fotosNuevas[c.clave].url : urlFoto(v.valor);
  marco.appendChild(img);
  var cambiar = el("span", "adm-mini__accion");
  cambiar.innerHTML = iconos.foto;
  cambiar.appendChild(document.createTextNode("Cambiar"));
  marco.appendChild(cambiar);
  var file = el("input");
  file.type = "file";
  file.accept = "image/jpeg,image/png,image/webp";
  file.setAttribute("aria-label", "Cambiar " + c.etiqueta);
  marco.appendChild(file);
  fila.appendChild(marco);

  var lado = el("div", "adm-campo__alt");
  var idAlt = "a-" + c.clave.replace(/\./g, "-");
  var labAlt = el("label", null, "Descripción de la imagen");
  labAlt.htmlFor = idAlt;
  var alt = el("input");
  alt.id = idAlt;
  alt.maxLength = 300;
  alt.value = v.alt || "";
  alt.placeholder = "Qué se ve en la foto (para lectores de pantalla y Google)";
  lado.appendChild(labAlt);
  lado.appendChild(alt);
  var restaurar = el("button", "adm-texto adm-restaurar", "Restaurar original");
  restaurar.type = "button";
  lado.appendChild(restaurar);
  fila.appendChild(lado);
  caja.appendChild(fila);

  function estadoActual() { return borrador[c.clave] || guardado[c.clave] || { valor: c.valor, alt: c.alt || null, ancho: c.ancho, alto: c.alto }; }
  function refrescarRestaurar() { restaurar.hidden = esOriginal(c.clave, estadoActual()); }
  refrescarRestaurar();

  alt.addEventListener("input", function () {
    var e = estadoActual();
    marcar(c.clave, { valor: e.valor, alt: alt.value.trim(), ancho: e.ancho, alto: e.alto });
    refrescarRestaurar();
  });
  file.addEventListener("change", async function () {
    var a = file.files[0];
    file.value = "";
    if (!a) return;
    if (!esImagen(a)) { avisar("Usa una foto JPG, PNG o WEBP."); return; }
    try {
      var foto = await procesarFoto(a, 2000);
      if (fotosNuevas[c.clave]) URL.revokeObjectURL(fotosNuevas[c.clave].url);
      var url = URL.createObjectURL(foto.blob);
      fotosNuevas[c.clave] = { foto: foto, url: url };
      img.src = url;
      marcar(c.clave, { valor: "__nueva__", alt: alt.value.trim(), ancho: foto.ancho, alto: foto.alto });
      restaurar.hidden = false;
    } catch (e) {
      avisar("No se pudo leer esa imagen.");
    }
  });
  restaurar.addEventListener("click", function () {
    if (fotosNuevas[c.clave]) { URL.revokeObjectURL(fotosNuevas[c.clave].url); delete fotosNuevas[c.clave]; }
    img.src = urlFoto(c.valor);
    alt.value = c.alt || "";
    marcar(c.clave, { valor: c.valor, alt: c.alt || null, ancho: c.ancho, alto: c.alto });
    refrescarRestaurar();
  });
  return caja;
}

function pintarSecciones() {
  var cont = $("#secciones");
  var abiertas = $$(".adm-seccion[open]", cont).map(function (d) { return d.dataset.seccion; });
  cont.textContent = "";
  secciones.forEach(function (s, i) {
    var d = el("details", "adm-seccion");
    d.dataset.seccion = s.seccion;
    d.open = abiertas.length ? abiertas.indexOf(s.seccion) !== -1 : i === 0;
    var sum = el("summary");
    sum.appendChild(el("span", "adm-seccion__titulo", s.titulo));
    sum.appendChild(el("span", "adm-seccion__cambios"));
    var cambiados = s.campos.filter(function (c) { return guardado[c.clave]; }).length;
    if (cambiados) sum.appendChild(el("span", "adm-marca", cambiados === 1 ? "1 personalizado" : cambiados + " personalizados"));
    d.appendChild(sum);
    var cuerpo = el("div", "adm-seccion__cuerpo");
    s.campos.forEach(function (c) { cuerpo.appendChild(c.tipo === "imagen" ? campoImagen(c) : campoTexto(c)); });
    d.appendChild(cuerpo);
    cont.appendChild(d);
  });
  actualizarBarra();
}

$("#descartar").addEventListener("click", function () {
  borrador = {};
  Object.keys(fotosNuevas).forEach(function (k) { URL.revokeObjectURL(fotosNuevas[k].url); });
  fotosNuevas = {};
  pintarSecciones();
});

$("#guardar-contenido").addEventListener("click", async function () {
  var b = this;
  var claves = Object.keys(borrador);
  if (!claves.length) return;
  b.disabled = true;
  b.textContent = "Guardando…";
  var subidas = [];
  var viejas = [];
  try {
    var upserts = [];
    var borrar = [];
    for (var i = 0; i < claves.length; i++) {
      var k = claves[i];
      var v = Object.assign({}, borrador[k]);
      var c = base[k];
      if (c.tipo === "imagen" && v.valor === "__nueva__") {
        var f = fotosNuevas[k].foto;
        var path = "sitio/" + k.replace(/\./g, "-") + "-" + Date.now().toString(36) + "." + f.ext;
        var up = await sb.storage.from(BUCKET).upload(path, f.blob, { contentType: f.blob.type, cacheControl: "31536000" });
        if (up.error) throw new Error("foto");
        subidas.push(path);
        v.valor = path;
      }
      var previo = guardado[k];
      if (previo && c.tipo === "imagen" && previo.valor && previo.valor.charAt(0) !== "/" && previo.valor !== v.valor) viejas.push(previo.valor);
      if (esOriginal(k, v)) borrar.push(k);
      else upserts.push({ clave: k, valor: v.valor, alt: c.tipo === "imagen" ? (v.alt || "") : null, ancho: c.tipo === "imagen" ? v.ancho : null, alto: c.tipo === "imagen" ? v.alto : null });
    }
    if (upserts.length) {
      var r = await sb.from("contenido").upsert(upserts, { onConflict: "clave" });
      if (r.error) throw new Error("fila");
    }
    if (borrar.length) {
      var d = await sb.from("contenido").delete().in("clave", borrar);
      if (d.error) throw new Error("fila");
    }
    if (viejas.length) await sb.storage.from(BUCKET).remove(viejas);
    Object.keys(fotosNuevas).forEach(function (k2) { URL.revokeObjectURL(fotosNuevas[k2].url); });
    fotosNuevas = {};
    borrador = {};
    avisar("Cambios guardados. Se verán en el sitio en más o menos un minuto.");
    await cargarContenido();
  } catch (e) {
    if (subidas.length) await sb.storage.from(BUCKET).remove(subidas);
    avisar(e.message === "foto" ? "No se pudo subir una de las imágenes. Intenta de nuevo." : "No se pudieron guardar los cambios. Intenta de nuevo.");
  } finally {
    b.disabled = false;
    b.textContent = "Guardar cambios";
  }
});

window.addEventListener("beforeunload", function (e) {
  if (hayPendientes()) { e.preventDefault(); e.returnValue = ""; }
});
