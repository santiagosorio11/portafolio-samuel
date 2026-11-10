(function () {
  "use strict";

  var P = window.Pincel;
  var raiz = document.documentElement;
  var reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var conPuntero = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var PASTELES = ["#f4b6c8", "#f7c9a9", "#f6e7a1", "#b4e4cc", "#a9d8ef", "#cdb9ea", "#e6b45a"];
  var ORO = "#d9a441";
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var porSlug = {};
  window.OBRAS.forEach(function (o) { porSlug[o.slug] = o; });

  function enlaceWa(mensaje) {
    return "https://wa.me/" + window.WHATSAPP + "?text=" + encodeURIComponent(mensaje);
  }

  $$("[data-icono]").forEach(function (i) { i.innerHTML = window.ICONOS[i.dataset.icono] || ""; });
  $$("[data-wa]").forEach(function (a) { a.href = enlaceWa(window.MENSAJES[a.dataset.wa]); });

  /* ---------- Lienzos ---------- */
  function crearLienzo(obra, sinCarga) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "lienzo lienzo--" + obra.soporte;
    b.setAttribute("aria-haspopup", "dialog");
    b.setAttribute("aria-label", "Ver " + obra.titulo + ", " + obra.medidas + ", " + obra.anio);
    b.dataset.slug = obra.slug;
    var src = "assets/obras/" + obra.slug + ".webp";
    var lados = obra.soporte === "escultura" ? "" :
      ["d", "i", "s", "a"].map(function (l) { return '<span class="lado lado--' + l + '" style="background-image:url(' + src + ')"></span>'; }).join("");
    b.innerHTML =
      '<span class="lienzo__giro"><span class="lienzo__cuerpo" style="aspect-ratio:' + obra.img.w + "/" + obra.img.h + '">' +
      '<img src="' + src + '" width="' + obra.img.w + '" height="' + obra.img.h + '" alt="' + obra.titulo + '"' + (sinCarga ? "" : ' loading="lazy" decoding="async"') + ">" +
      lados + "</span></span>";
    b.addEventListener("click", function () { abrir(obra, b); });
    if (conPuntero && !reducir) inclinable(b);
    return b;
  }

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

  var pared = $("#pared");
  pared.style.setProperty("--alto", window.PARED_ALTO.pared);
  pared.style.setProperty("--alto-m", window.PARED_ALTO.movil);
  var lienzosPared = {};
  window.OBRAS.forEach(function (obra, i) {
    var art = document.createElement("article");
    art.className = "obra" + (obra.soporte === "escultura" ? " obra--escultura" : "");
    art.style.cssText = "--x:" + obra.pared.x + ";--y:" + obra.pared.y + ";--w:" + obra.pared.w + ";--mx:" + obra.movil.x + ";--my:" + obra.movil.y + ";--mw:" + obra.movil.w + ";--d:" + (i % 4) * 90 + "ms";
    var l = crearLienzo(obra);
    lienzosPared[obra.slug] = l;
    art.appendChild(l);
    var cartela = document.createElement("div");
    cartela.className = "cartela";
    cartela.innerHTML = "<h3>" + obra.titulo + "</h3><p>" + obra.medidas + ", " + obra.anio + (obra.vendida ? "<br>Colección privada" : "") + "</p>";
    art.appendChild(cartela);
    pared.appendChild(art);
  });

  $$("[data-obra-hero]").forEach(function (cont) {
    cont.appendChild(crearLienzo(porSlug[cont.dataset.obraHero], true));
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

  /* ---------- Pinceladas del hero ---------- */
  var trazosHero = null;
  function pintarHero(instantaneo) {
    var c = $("#hero-trazos");
    var s = P.preparar(c, 1.5);
    var r = P.azar(23);
    var movil = s.w < 860;
    var ancho = (movil ? s.w * 0.34 : s.w * 0.11);
    var colores = ["#f4b6c8", "#a9d8ef", "#f6e7a1", "#cdb9ea", "#b4e4cc", "#f7c9a9", ORO];
    var lista = colores.map(function (color, i) {
      var y0, y1, x0, x1;
      if (movil) {
        x0 = -40; x1 = s.w + 40;
        y0 = s.h * (0.42 + i * 0.085) + r() * 20; y1 = y0 - s.h * 0.08;
      } else {
        x0 = s.w * (0.42 + r() * 0.1); x1 = s.w + 50;
        y0 = s.h * (1.02 - i * 0.14); y1 = s.h * (0.68 - i * 0.14) + r() * 40;
      }
      var esOro = color === ORO;
      var tr = P.crearTrazo({
        puntos: P.ondulada(x0, y0, x1, y1, ancho * (movil ? 0.3 : 0.8), 5, r),
        ancho: esOro ? ancho * 0.28 : ancho * (0.8 + r() * 0.5),
        color: color,
        vetas: [PASTELES[(i + 2) % 6], "#ffffff"],
        semilla: 90 + i * 13,
        seco: 0.75,
      });
      return { trazo: tr, inicio: i * 120, duracion: 1000 };
    });
    var a = P.animar(s.ctx, lista);
    trazosHero = a;
    if (instantaneo) a.completar();
  }

  function dedoHero() {
    if (!conPuntero || reducir) return;
    var c = $("#hero-dedo");
    var hero = $(".hero");
    var s = P.preparar(c, 1.5);
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
      if (previo) {
        var dx = x - previo[0], dy = y - previo[1], d = Math.hypot(dx, dy);
        if (d < 3) return;
        recorrido += d;
        if (recorrido > 340) { recorrido = 0; color = (color + 1) % PASTELES.length; }
        var nx = -dy / d, ny = dx / d;
        s.ctx.lineCap = "round";
        s.ctx.strokeStyle = PASTELES[color];
        cerdas.forEach(function (ce) {
          if (ce.salto && r() < 0.25) return;
          s.ctx.globalAlpha = ce.a;
          s.ctx.lineWidth = ce.g;
          s.ctx.beginPath();
          s.ctx.moveTo(previo[0] + nx * ce.o, previo[1] + ny * ce.o);
          s.ctx.lineTo(x + nx * ce.o, y + ny * ce.o);
          s.ctx.stroke();
        });
      }
      previo = [x, y];
    });
    hero.addEventListener("pointerleave", function () { previo = null; });
    return s;
  }

  /* ---------- Bandas de color en secciones ---------- */
  var BANDAS = {
    artista: { colores: ["#cdb9ea", "#f4b6c8", "#f7c9a9"], lado: "izq" },
    comienzo: { colores: ["#a9d8ef", "#b4e4cc", "#f6e7a1", "#f4b6c8"], lado: "centro" },
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
          trazo: P.crearTrazo({ puntos: P.ondulada(x0, y0, x1, y1, ancho * 0.7, 5, r), ancho: ancho * (0.85 + r() * 0.4), color: color, vetas: [PASTELES[i], "#ffffff"], semilla: 400 + i * 17, seco: 0.8}),
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
      dedoListo = dedoListo && P.preparar($("#hero-dedo"), 1.5);
      bandas.forEach(function (c) {
        if (!c.dataset.pintada) return;
        var t = trazosBanda(c);
        P.animar(t.s.ctx, t.lista).completar();
      });
    }, 180);
  });

  /* ---------- Intro ---------- */
  var dedoListo = null;
  function arrancarPagina(instantaneo) {
    raiz.classList.remove("con-intro");
    raiz.classList.add("listo");
    pintarHero(instantaneo || reducir);
    dedoListo = dedoHero() || null;
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
    function saltarIntro() { terminar(); }
    saltar.addEventListener("click", saltarIntro);
    cont.addEventListener("click", saltarIntro);
    window.addEventListener("keydown", function k() { window.removeEventListener("keydown", k); saltarIntro(); });
    if (logo.decode) logo.decode().then(comenzar, comenzar); else comenzar();
  }

  /* ---------- Ficha de obra ---------- */
  var ficha = $("#ficha");
  var fImg = $("#ficha-img");
  var fInfo = $("#ficha-info");
  var fTrazos = $("#ficha-trazos");
  var estado = { obra: null, origen: null, cerrando: false, anim: null };

  function escala(obra) {
    var svg = $("#ficha-escala");
    var k = 0.88, piso = 172;
    var alto = obra.cm.h * k, ancho = obra.cm.w * k;
    var cx = 150;
    var centro = obra.soporte === "escultura" ? 95 : 150;
    var y = piso - centro * k - alto / 2;
    var persona = window.ICONOS.persona.replace('<svg ', '<svg x="2" y="' + (piso - 170 * k * 1.14 + 8) + '" width="' + 170 * k * 1.14 + '" height="' + 170 * k * 1.14 + '" ');
    var pedestal = obra.soporte === "escultura" ? '<rect x="' + (cx - 26) + '" y="' + (y + alto) + '" width="52" height="' + (piso - y - alto) + '" fill="var(--muro-hondo)"/>' : "";
    var clip = "clip-" + obra.slug;
    svg.innerHTML =
      '<line x1="0" x2="240" y1="' + piso + '" y2="' + piso + '" stroke="var(--cafe)" stroke-width="1"/>' +
      '<g style="color:var(--tinta)" opacity=".78" transform="translate(-44 0)">' + persona + "</g>" +
      pedestal +
      '<defs><clipPath id="' + clip + '"><rect x="' + (cx - ancho / 2) + '" y="' + y + '" width="' + ancho + '" height="' + alto + '"/></clipPath></defs>' +
      '<image href="assets/obras/' + obra.slug + '.webp" x="' + (cx - ancho / 2) + '" y="' + y + '" width="' + ancho + '" height="' + alto + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + clip + ')"/>' +
      '<rect x="' + (cx - ancho / 2) + '" y="' + y + '" width="' + ancho + '" height="' + alto + '" fill="none" stroke="var(--oro-hondo)" stroke-width="1"/>';
  }

  function llenar(obra) {
    estado.obra = obra;
    fImg.src = "assets/obras/" + obra.slug + ".webp";
    fImg.width = obra.img.w;
    fImg.height = obra.img.h;
    fImg.alt = obra.titulo;
    $("#ficha-titulo").textContent = obra.titulo;
    $("#ficha-tecnica").textContent = obra.tecnica;
    $("#ficha-medidas").textContent = obra.medidas;
    $("#ficha-anio").textContent = obra.anio;
    $("#ficha-historia").textContent = obra.historia;
    $("#ficha-precio").textContent = obra.vendida ? "Esta obra ya hace parte de una colección privada." : obra.precio || "Precio a consultar";
    $("#ficha-wa-texto").textContent = obra.vendida ? "Quiero una similar" : "Me interesa esta obra";
    var msg = obra.vendida
      ? "Hola Sami, vi la obra “" + obra.titulo + "” en tu galería web y me gustaría encargar una similar."
      : "Hola Sami, vi la obra “" + obra.titulo + "” (" + obra.tecnica + ", " + obra.medidas + ", " + obra.anio + ") en tu galería web y me interesa adquirirla. ¿Me cuentas el precio y si está disponible?";
    $("#ficha-wa").href = enlaceWa(msg);
    ficha.style.setProperty("--tinte", obra.paleta[0]);
    escala(obra);
  }

  function pintarFondo(obra, instantaneo) {
    if (estado.anim) estado.anim.cancelar();
    var s = P.preparar(fTrazos, 1.25);
    s.ctx.clearRect(0, 0, s.w, s.h);
    var r = P.azar(obra.slug.length * 57 + obra.anio);
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
    estado.origen = origen || lienzosPared[obra.slug];
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
      origenVisible(obra);
      fImg.animate([{ opacity: 0, transform: "scale(.94)" }, { opacity: 1, transform: "none" }], { duration: 600, easing: "cubic-bezier(.16,1,.3,1)" });
    }
    entradaInfo();
  }

  function origenVisible(obra) { estado.origen = lienzosPared[obra.slug]; }

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
    var lista = window.OBRAS;
    var i = lista.indexOf(estado.obra);
    var nueva = lista[(i + paso + lista.length) % lista.length];
    if (estado.origen) estado.origen.classList.remove("fuera");
    estado.origen = lienzosPared[nueva.slug];
    estado.origen.classList.add("fuera");
    history.replaceState({ obra: nueva.slug }, "", "#obra/" + nueva.slug);
    if (!reducir) {
      fImg.animate([{ transform: "none", opacity: 1 }, { transform: "translateX(" + -paso * 50 + "px)", opacity: 0 }], { duration: 170, easing: "ease-in" }).finished.then(mostrar);
    } else mostrar();
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
  }

  var ignorarPop = false;
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
})();
