import { Pincel as P } from "./pincel.js";
import iconos from "../data/iconos.json";

var raiz = document.documentElement;
var reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var conPuntero = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
var ORO = "#d9a441";
var $ = function (s, c) { return (c || document).querySelector(s); };
var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

var OBRAS = JSON.parse($("#datos-obras").textContent || "[]");
var SITIO = JSON.parse(($("#datos-sitio") || {}).textContent || "{}");
function enlaceWa(mensaje) { return "https://wa.me/" + (SITIO.wa || "") + "?text=" + encodeURIComponent(mensaje); }
var porSlug = {};
OBRAS.forEach(function (o) { porSlug[o.slug] = o; });

/* ---------- Lienzos ---------- */
function inclinable(el) {
  var cuerpo = $(".lienzo__cuerpo", el);
  el.addEventListener("pointermove", function (e) {
    var r = el.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width - 0.5;
    var y = (e.clientY - r.top) / r.height - 0.5;
    cuerpo.style.setProperty("--ry", (x * 16).toFixed(2) + "deg");
    cuerpo.style.setProperty("--rx", (-y * 12).toFixed(2) + "deg");
  });
  el.addEventListener("pointerleave", function () {
    cuerpo.style.setProperty("--ry", "0deg");
    cuerpo.style.setProperty("--rx", "0deg");
  });
}

var lienzosPared = {};
$$(".lienzo[data-slug]").forEach(function (b) {
  var obra = porSlug[b.dataset.slug];
  if (!obra) return;
  if (b.closest("#pared")) lienzosPared[obra.slug] = b;
  b.addEventListener("click", function () { abrir(obra, b); });
  if (conPuntero && !reducir) inclinable(b);
});

/* ---------- Apariciones al hacer scroll ---------- */
var vigia = "IntersectionObserver" in window ? new IntersectionObserver(function (entradas) {
  entradas.forEach(function (e) {
    if (e.isIntersecting) { e.target.classList.add("visto"); vigia.unobserve(e.target); }
  });
}, { threshold: 0.14, rootMargin: "0px 0px -6% 0px" }) : null;

$$("[data-rev], .obra, .polaroids, .tecnicas .tiras, .ritual__fotos").forEach(function (el) {
  if (vigia) vigia.observe(el); else el.classList.add("visto");
});

/* ---------- Técnicas ---------- */
var tiras = $$(".tira");
function activarTira(t) { tiras.forEach(function (o) { o.classList.toggle("activa", o === t); }); }
tiras.forEach(function (t) {
  t.addEventListener("pointerenter", function () { activarTira(t); });
  t.addEventListener("focus", function () { activarTira(t); });
  t.addEventListener("click", function () { activarTira(t); });
});

/* ---------- Navegación ---------- */
var nav = $("#nav");
if (vigia) {
  new IntersectionObserver(function (e) { nav.classList.toggle("nav--sobre", !e[0].isIntersecting); }, { rootMargin: "-90px 0px 0px 0px" }).observe($("#hero-trazos"));
}
var menuBtn = $("#nav-menu");
function menu(abierto) {
  nav.classList.toggle("nav--abierto", abierto);
  menuBtn.setAttribute("aria-expanded", abierto ? "true" : "false");
}
menuBtn.addEventListener("click", function () { menu(!nav.classList.contains("nav--abierto")); });
$$("#nav-enlaces a").forEach(function (a) { a.addEventListener("click", function () { menu(false); }); });

/* ---------- Soles del hero ---------- */
var SOLARES = ["#ffb238", "#ff8a1f", "#f26b1d", "#ffcf5c", "#e8541c", "#ffa94d"];

/* Un sol pintado: disco de pinceladas circulares y rayos ondulados alrededor. */
function trazosSol(cx, cy, radio, r, semilla, conDisco, retraso) {
  var lista = [];
  if (conDisco) {
    var anillos = 4;
    for (var k = 0; k < anillos; k++) {
      var rr = radio * (0.82 - k * 0.2);
      var a0 = r() * 6.28, pts = [];
      for (var j = 0; j <= 12; j++) {
        var ang = a0 + (j / 12) * 6.28 * 1.06;
        var rj = rr * (1 + (r() - 0.5) * 0.06);
        pts.push([cx + Math.cos(ang) * rj, cy + Math.sin(ang) * rj]);
      }
      lista.push({
        trazo: P.crearTrazo({ puntos: pts, ancho: radio * (0.42 - k * 0.04), color: ["#ff9a2e", "#ffb238", "#ffc84a", "#ffe08a"][k], vetas: ["#f26b1d", "#fff1c4"], semilla: semilla + k * 7, seco: 0.35, paso: 6 }),
        inicio: retraso + k * 140,
        duracion: 1100,
      });
    }
  }
  var rayos = conDisco ? 18 : 12;
  for (var i = 0; i < rayos; i++) {
    var ang = (i / rayos) * 6.28 + (r() - 0.5) * 0.12;
    var largo = (i % 2 ? 0.3 : 0.55) * (conDisco ? 1 : 1.6);
    var r0 = radio * (conDisco ? 1.1 : 1.05), r1 = radio * (1.12 + largo + r() * 0.15);
    var x0 = cx + Math.cos(ang) * r0, y0 = cy + Math.sin(ang) * r0;
    var x1 = cx + Math.cos(ang) * r1, y1 = cy + Math.sin(ang) * r1;
    lista.push({
      trazo: P.crearTrazo({
        puntos: P.ondulada(x0, y0, x1, y1, radio * 0.22, 3, r),
        ancho: radio * (i % 2 ? 0.13 : 0.19),
        color: SOLARES[i % SOLARES.length],
        vetas: ["#ffe08a", "#e8541c"],
        semilla: semilla + 50 + i * 5,
        seco: 0.6,
        paso: 6,
      }),
      inicio: retraso + (conDisco ? 520 : 0) + i * 45,
      duracion: 700,
    });
  }
  return lista;
}

function pintarHero(instantaneo) {
  var c = $("#hero-trazos");
  var s = P.preparar(c, 1.5);
  var r = P.azar(23);
  var movil = s.w < 860;
  var caja = c.getBoundingClientRect();
  var arte = $(".hero__arte").getBoundingClientRect();
  var cx = arte.left - caja.left + arte.width / 2;
  var cy = arte.top - caja.top + arte.height / 2;
  var radio = Math.min(arte.width, arte.height) * (movil ? 0.56 : 0.64);
  var hero = $(".hero");
  hero.style.setProperty("--sol-x", ((cx / s.w) * 100).toFixed(1) + "%");
  hero.style.setProperty("--sol-y", ((cy / s.h) * 100).toFixed(1) + "%");

  /* Barridos cálidos de fondo, por debajo de los soles. */
  var barridos = ["#ffd27a", "#ffb04f", "#ff9440"].map(function (color, i) {
    var x0 = movil ? -40 : s.w * (0.36 + r() * 0.08), x1 = s.w + 60;
    var y0 = s.h * (1.04 - i * 0.07), y1 = s.h * (0.8 - i * 0.07) + r() * 30;
    return {
      trazo: P.crearTrazo({ puntos: P.ondulada(x0, y0, x1, y1, s.w * 0.05, 5, r), ancho: (movil ? s.w * 0.3 : s.w * 0.09) * (0.8 + r() * 0.4), color: color, vetas: ["#fff1c4", "#f26b1d"], semilla: 90 + i * 13, seco: 0.75 }),
      inicio: i * 110,
      duracion: 1000,
    };
  });

  var lista = barridos
    .concat(trazosSol(cx, cy, radio, r, 300, true, 250))
    .concat(movil
      ? trazosSol(s.w * 0.88, s.h * 0.16, s.w * 0.06, r, 600, true, 900)
      : trazosSol(s.w * 0.47, s.h * 0.17, s.w * 0.028, r, 600, true, 1100)
        .concat(trazosSol(s.w * 0.04, s.h * 0.95, s.w * 0.05, r, 700, true, 1300)));
  var a = P.animar(s.ctx, lista);
  if (instantaneo) a.completar();
}

var dedo = null;
function dedoHero() {
  if (!conPuntero || reducir) return null;
  var c = $("#hero-dedo");
  var hero = $(".hero");
  var estado = { s: P.preparar(c, 1.5) };
  var r = P.azar(5);
  var cerdas = [];
  for (var i = 0; i < 22; i++) {
    cerdas.push({ o: (i / 21 - 0.5) * 34 + r() * 3, g: 1 + r() * 2.2, a: 0.28 + r() * 0.4, salto: r() < 0.3 });
  }
  var previo = null, color = 0, recorrido = 0;
  hero.addEventListener("pointermove", function (e) {
    if (e.target.closest("a, button")) { previo = null; return; }
    var b = c.getBoundingClientRect();
    var x = e.clientX - b.left, y = e.clientY - b.top;
    var ctx = estado.s.ctx;
    if (previo) {
      var dx = x - previo[0], dy = y - previo[1], d = Math.hypot(dx, dy);
      if (d < 3) return;
      recorrido += d;
      if (recorrido > 340) { recorrido = 0; color = (color + 1) % SOLARES.length; }
      var nx = -dy / d, ny = dx / d;
      ctx.lineCap = "round";
      ctx.strokeStyle = SOLARES[color];
      cerdas.forEach(function (ce) {
        if (ce.salto && r() < 0.25) return;
        ctx.globalAlpha = ce.a;
        ctx.lineWidth = ce.g;
        ctx.beginPath();
        ctx.moveTo(previo[0] + nx * ce.o, previo[1] + ny * ce.o);
        ctx.lineTo(x + nx * ce.o, y + ny * ce.o);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }
    previo = [x, y];
  });
  hero.addEventListener("pointerleave", function () { previo = null; });
  return { reiniciar: function () { estado.s = P.preparar(c, 1.5); } };
}

/* ---------- Bandas de color en secciones ---------- */
var BANDAS = {
  artista: { colores: ["#ffc46b", "#ff9f5a", "#ffd98a"], lado: "izq" },
  comienzo: { colores: ["#ffcf6b", "#ffa552", "#ffe2a0", "#ff8f4a"], lado: "centro" },
};

function trazosBanda(canvas) {
  var b = BANDAS[canvas.dataset.trazos];
  var s = P.preparar(canvas, 1.25);
  var r = P.azar(canvas.dataset.trazos.length * 31);
  var ancho = Math.max(120, s.w * 0.15);
  return {
    s: s,
    lista: b.colores.map(function (color, i) {
      var x0, x1, y0, y1;
      if (b.lado === "izq") {
        x0 = -60; x1 = s.w * (0.56 + r() * 0.18);
        y0 = s.h * (0.2 + i * 0.26); y1 = y0 + (r() - 0.5) * s.h * 0.2;
      } else {
        var alterna = i % 2 === 0;
        x0 = alterna ? -60 : s.w + 60; x1 = alterna ? s.w + 60 : -60;
        y0 = s.h * (0.56 + i * 0.13); y1 = y0 + (r() - 0.5) * s.h * 0.12;
      }
      return {
        trazo: P.crearTrazo({ puntos: P.ondulada(x0, y0, x1, y1, ancho * 0.7, 5, r), ancho: ancho * (0.85 + r() * 0.4), color: color, vetas: [SOLARES[i % SOLARES.length], "#fff4dc"], semilla: 400 + i * 17, seco: 0.8 }),
        inicio: i * 160,
        duracion: 1200,
      };
    }),
  };
}

var bandas = $$("canvas[data-trazos]");
var observadorBanda = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
  es.forEach(function (e) {
    if (!e.isIntersecting) return;
    observadorBanda.unobserve(e.target);
    e.target.dataset.pintada = "1";
    var t = trazosBanda(e.target);
    var a = P.animar(t.s.ctx, t.lista);
    if (reducir) a.completar();
  });
}, { threshold: 0.2 }) : null;
bandas.forEach(function (c) { if (observadorBanda) observadorBanda.observe(c); });

var anchoVentana = window.innerWidth;
var esperaResize = 0;
window.addEventListener("resize", function () {
  if (window.innerWidth === anchoVentana) return;
  anchoVentana = window.innerWidth;
  clearTimeout(esperaResize);
  esperaResize = setTimeout(function () {
    pintarHero(true);
    if (dedo) dedo.reiniciar();
    bandas.forEach(function (c) {
      if (!c.dataset.pintada) return;
      var t = trazosBanda(c);
      P.animar(t.s.ctx, t.lista).completar();
    });
  }, 180);
});

/* ---------- Intro ---------- */
function arrancarPagina(instantaneo) {
  raiz.classList.remove("con-intro");
  raiz.classList.add("listo");
  pintarHero(instantaneo || reducir);
  dedo = dedoHero();
}

function intro() {
  if (!raiz.classList.contains("con-intro")) {
    var i = $("#intro");
    if (i) i.remove();
    arrancarPagina(true);
    return;
  }
  var cont = $("#intro");
  var canvas = $("#intro-lienzo");
  var logo = $("#intro-logo");
  var saltar = $("#intro-saltar");
  var s = P.preparar(canvas, 1.25);
  var relojes = [], anim = null, terminado = false;
  s.ctx.fillStyle = "#120d0a";
  s.ctx.fillRect(0, 0, s.w, s.h);

  function terminar() {
    if (terminado) return;
    terminado = true;
    relojes.forEach(clearTimeout);
    if (anim) anim.cancelar();
    try { sessionStorage.setItem("intro-vista", "1"); } catch (e) {}
    arrancarPagina(false);
    cont.classList.add("intro--fuera");
    setTimeout(function () { cont.remove(); }, 620);
  }

  function barrer() {
    var caja = logo.getBoundingClientRect();
    s.ctx.drawImage(logo, caja.left, caja.top, caja.width, caja.height);
    logo.style.visibility = "hidden";
    var r = P.azar(11);
    var ancho = Math.max(s.h / 3.4, 170);
    var filas = Math.ceil(s.h / (ancho * 0.56)) + 1;
    var lista = [];
    var colores = ["#f4b6c8", "#e6b45a", "#a9d8ef", "#f7c9a9", "#cdb9ea", "#b4e4cc", "#f6e7a1"];
    for (var i = 0; i < filas; i++) {
      var y = (i + 0.2) * (s.h / (filas - 0.6));
      var ida = i % 2 === 0;
      var x0 = ida ? -80 : s.w + 80, x1 = ida ? s.w + 80 : -80;
      var pts = P.ondulada(x0, y + (r() - 0.5) * 30, x1, y + (r() - 0.5) * 50, ancho * 0.3, 4, r);
      var inicio = i * 135;
      lista.push({
        trazo: P.crearTrazo({ puntos: pts, ancho: ancho, color: colores[i % colores.length], vetas: [colores[(i + 3) % colores.length], colores[(i + 5) % colores.length]], semilla: 30 + i * 9, seco: 0.22, paso: 9 }),
        inicio: inicio, duracion: 640,
      });
      lista.push({
        trazo: P.crearTrazo({ puntos: pts, ancho: ancho * 1.5, color: "#000000", borrar: true, semilla: 60 + i * 9, paso: 9 }),
        inicio: inicio + 420, duracion: 640,
      });
    }
    anim = P.animar(s.ctx, lista, terminar);
  }

  function comenzar() { cont.classList.add("intro--logo"); relojes.push(setTimeout(barrer, 2050)); }
  saltar.addEventListener("click", terminar);
  cont.addEventListener("click", terminar);
  window.addEventListener("keydown", function k() { window.removeEventListener("keydown", k); terminar(); });
  if (logo.decode) logo.decode().then(comenzar, comenzar); else comenzar();
}

/* ---------- Ficha de obra ---------- */
var ficha = $("#ficha");
var fImg = $("#ficha-img");
var fInfo = $("#ficha-info");
var fTrazos = $("#ficha-trazos");
var estado = { obra: null, origen: null, cerrando: false, anim: null };
var ignorarPop = false;

function escala(obra) {
  var svg = $("#ficha-escala");
  var k = 0.88, piso = 172;
  var esEscultura = obra.soporte === "escultura";
  var altoCm = obra.alto_cm || obra.ancho_cm || 50;
  var anchoCm = obra.ancho_cm || (esEscultura ? altoCm * 0.7 : altoCm);
  var alto = Math.min(altoCm * k, 165), ancho = Math.min(anchoCm * k, 176);
  var cx = 150;
  var centro = esEscultura ? 95 : 150;
  var y = Math.max(4, piso - centro * k - alto / 2);
  var lado = 170 * k * 1.14;
  var persona = iconos.persona.replace("<svg ", '<svg x="2" y="' + (piso - lado + 8) + '" width="' + lado + '" height="' + lado + '" ');
  var pedestal = esEscultura ? '<rect x="' + (cx - 26) + '" y="' + (y + alto) + '" width="52" height="' + (piso - y - alto) + '" fill="var(--muro-hondo)"/>' : "";
  var clip = "clip-escala";
  var img = obra.imagen_url.replace(/"/g, "&quot;");
  svg.innerHTML =
    '<line x1="0" x2="240" y1="' + piso + '" y2="' + piso + '" stroke="var(--cafe)" stroke-width="1"/>' +
    '<g style="color:var(--tinta)" opacity=".78" transform="translate(-44 0)">' + persona + "</g>" +
    pedestal +
    '<defs><clipPath id="' + clip + '"><rect x="' + (cx - ancho / 2) + '" y="' + y + '" width="' + ancho + '" height="' + alto + '"/></clipPath></defs>' +
    '<image href="' + img + '" x="' + (cx - ancho / 2) + '" y="' + y + '" width="' + ancho + '" height="' + alto + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + clip + ')"/>' +
    '<rect x="' + (cx - ancho / 2) + '" y="' + y + '" width="' + ancho + '" height="' + alto + '" fill="none" stroke="var(--oro-hondo)" stroke-width="1"/>';
}

function llenar(obra) {
  estado.obra = obra;
  fImg.src = obra.imagen_url;
  fImg.width = obra.imagen_ancho;
  fImg.height = obra.imagen_alto;
  fImg.alt = obra.titulo;
  $("#ficha-titulo").textContent = obra.titulo;
  $("#ficha-tecnica").textContent = obra.tecnica || "Sin especificar";
  $("#ficha-medidas").textContent = obra.medidas || "Sin especificar";
  $("#ficha-anio").textContent = obra.anio || "Sin especificar";
  $("#ficha-historia").textContent = obra.historia;
  $("#ficha-historia").previousElementSibling.hidden = !obra.historia;
  var aLaVenta = obra.estado === "disponible";
  $("#ficha-precio").textContent =
    obra.estado === "vendida" ? "Esta obra ya hace parte de una colección privada."
    : obra.estado === "reservada" ? "Esta obra está reservada."
    : obra.estado === "no_disponible" ? "Esta obra no está a la venta."
    : obra.precio || "Precio a consultar";
  $("#ficha-wa-texto").textContent = aLaVenta ? "Me interesa esta obra" : "Quiero una similar";
  var datos = [obra.tecnica, obra.medidas, obra.anio].filter(Boolean).join(", ");
  var msg = aLaVenta
    ? "Hola Sam, vi la obra “" + obra.titulo + "”" + (datos ? " (" + datos + ")" : "") + " en tu galería web y me interesa adquirirla. ¿Me cuentas el precio y si está disponible?"
    : "Hola Sam, vi la obra “" + obra.titulo + "” en tu galería web y me gustaría encargar una similar.";
  $("#ficha-wa").href = enlaceWa(msg);
  ficha.style.setProperty("--tinte", obra.paleta[0]);
  escala(obra);
}

function pintarFondo(obra, instantaneo) {
  if (estado.anim) estado.anim.cancelar();
  var s = P.preparar(fTrazos, 1.25);
  s.ctx.clearRect(0, 0, s.w, s.h);
  var r = P.azar(obra.slug.length * 57 + (obra.anio || 7));
  var cols = obra.paleta.concat([ORO]);
  var ancho = Math.max(s.w, s.h) * 0.17;
  var lista = cols.concat(cols.slice(0, 2)).map(function (color, i) {
    var y0 = s.h * (0.04 + i * 0.15);
    var ida = i % 2 === 0;
    return {
      trazo: P.crearTrazo({
        puntos: P.ondulada(ida ? -80 : s.w + 80, y0, ida ? s.w + 80 : -80, y0 + (r() - 0.5) * s.h * 0.22, ancho * 0.7, 5, r),
        ancho: color === ORO ? ancho * 0.35 : ancho * (0.8 + r() * 0.4),
        color: color,
        vetas: [cols[(i + 1) % cols.length], "#fffaf0"],
        semilla: 700 + i * 23,
        seco: 0.7,
        paso: 8,
      }),
      inicio: i * 75,
      duracion: 620,
    };
  });
  estado.anim = P.animar(s.ctx, lista);
  if (instantaneo) estado.anim.completar();
}

function entradaInfo() {
  var movil = window.innerWidth < 900;
  fInfo.animate(
    movil
      ? [{ transform: "translateY(44px)", opacity: 0 }, { transform: "none", opacity: 1 }]
      : [{ transform: "perspective(1400px) rotateY(-86deg)", opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: "perspective(1400px) rotateY(0deg)", opacity: 1 }],
    { duration: 760, delay: 260, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" }
  );
  $$("[data-ap]", fInfo).forEach(function (el, i) {
    el.animate([{ transform: "translateY(18px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 520, delay: 520 + i * 70, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" });
  });
  $$(".ficha__controles button").forEach(function (el, i) {
    el.animate([{ transform: "scale(.6)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 360, delay: 640 + i * 60, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" });
  });
}

function rectoLienzo(el) {
  var c = $(".lienzo__cuerpo", el);
  c.style.setProperty("--ry", "0deg");
  c.style.setProperty("--rx", "0deg");
  return $("img", c).getBoundingClientRect();
}

function flip(desde, hacia, inverso, dur) {
  var dx = desde.left - hacia.left, dy = desde.top - hacia.top;
  var sx = desde.width / hacia.width, sy = desde.height / hacia.height;
  var fuera = "translate(" + dx + "px," + dy + "px) scale(" + sx + "," + sy + ")";
  var marcos = [{ transform: fuera }, { transform: "none" }];
  return fImg.animate(inverso ? marcos.reverse() : marcos, { duration: dur, easing: inverso ? "cubic-bezier(.55,0,.2,1)" : "cubic-bezier(.2,.85,.2,1)", fill: "both" });
}

function abrir(obra, origen, sinHistorial) {
  if (ficha.open) return;
  estado.origen = origen || lienzosPared[obra.slug] || null;
  estado.cerrando = false;
  llenar(obra);
  raiz.classList.add("ficha-abierta");
  ficha.scrollTop = 0;
  ficha.showModal();
  ficha.classList.add("ficha--entra");
  if (!sinHistorial) history.pushState({ obra: obra.slug }, "", "#obra/" + obra.slug);
  pintarFondo(obra, reducir);
  if (reducir) return;
  if (origen) {
    var desde = rectoLienzo(origen);
    origen.classList.add("fuera");
    flip(desde, fImg.getBoundingClientRect(), false, 760).finished.then(function (a) { a.cancel(); }, function () {});
  } else {
    fImg.animate([{ opacity: 0, transform: "scale(.94)" }, { opacity: 1, transform: "none" }], { duration: 600, easing: "cubic-bezier(.16,1,.3,1)" });
  }
  entradaInfo();
}

function cerrar(desdeHistorial) {
  if (!ficha.open || estado.cerrando) return;
  estado.cerrando = true;
  var fin = function () {
    ficha.classList.remove("ficha--entra", "ficha--sale");
    ficha.close();
    raiz.classList.remove("ficha-abierta");
    if (estado.origen) {
      estado.origen.classList.remove("fuera");
      estado.origen.focus({ preventScroll: true });
    }
    if (estado.anim) estado.anim.cancelar();
    estado.cerrando = false;
  };
  if (!desdeHistorial && location.hash.indexOf("#obra/") === 0) {
    if (history.state && history.state.obra) { ignorarPop = true; history.back(); }
    else history.replaceState(null, "", location.pathname + location.search);
  }
  if (reducir) { fin(); return; }
  ficha.classList.add("ficha--sale");
  var o = estado.origen;
  var r = o && o.getBoundingClientRect();
  var enVista = r && r.bottom > 0 && r.top < window.innerHeight;
  if (enVista && o.classList.contains("fuera")) {
    flip(rectoLienzo(o), fImg.getBoundingClientRect(), true, 520).finished.then(function (a) { fin(); a.cancel(); }, fin);
  } else {
    setTimeout(fin, 340);
  }
}

function vecina(paso) {
  var i = OBRAS.indexOf(estado.obra);
  var nueva = OBRAS[(i + paso + OBRAS.length) % OBRAS.length];
  if (!nueva || nueva === estado.obra) return;
  if (estado.origen) estado.origen.classList.remove("fuera");
  estado.origen = lienzosPared[nueva.slug] || null;
  if (estado.origen) estado.origen.classList.add("fuera");
  history.replaceState({ obra: nueva.slug }, "", "#obra/" + nueva.slug);
  function mostrar() {
    llenar(nueva);
    ficha.scrollTop = 0;
    pintarFondo(nueva, reducir);
    if (reducir) return;
    fImg.animate([{ transform: "translateX(" + paso * 50 + "px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 420, easing: "cubic-bezier(.16,1,.3,1)" });
    $$("[data-ap]", fInfo).forEach(function (el, n) {
      el.animate([{ transform: "translateY(14px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 400, delay: 80 + n * 45, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" });
    });
  }
  if (!reducir) {
    fImg.animate([{ transform: "none", opacity: 1 }, { transform: "translateX(" + -paso * 50 + "px)", opacity: 0 }], { duration: 170, easing: "ease-in" }).finished.then(mostrar);
  } else mostrar();
}

ficha.addEventListener("cancel", function (e) { e.preventDefault(); cerrar(); });
ficha.addEventListener("keydown", function (e) {
  if (e.key === "ArrowRight") vecina(1);
  if (e.key === "ArrowLeft") vecina(-1);
});
$("#ficha-cerrar").addEventListener("click", function () { cerrar(); });
$("#ficha-prev").addEventListener("click", function () { vecina(-1); });
$("#ficha-next").addEventListener("click", function () { vecina(1); });
ficha.addEventListener("click", function (e) {
  if (e.target === ficha || e.target.id === "ficha-plano" || e.target.classList.contains("ficha__obra")) cerrar();
});

window.addEventListener("popstate", function () {
  if (ignorarPop) { ignorarPop = false; return; }
  var m = location.hash.match(/^#obra\/(.+)$/);
  if (m && porSlug[m[1]] && !ficha.open) abrir(porSlug[m[1]], lienzosPared[m[1]], true);
  else if (!m && ficha.open) cerrar(true);
});

/* ---------- Inicio ---------- */
intro();
var inicial = location.hash.match(/^#obra\/(.+)$/);
if (inicial && porSlug[inicial[1]]) abrir(porSlug[inicial[1]], null, true);
