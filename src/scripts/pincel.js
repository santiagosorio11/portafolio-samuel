/*
  Pincel: motor de pinceladas en canvas.
  Cada trazo se compone de muchas cerdas independientes, con su propio color,
  grosor, temblor y zonas secas. Se dibuja por tramos, así el costo por cuadro
  es mínimo aunque el trazo sea enorme.
*/
export const Pincel = (function () {
  "use strict";

  var RETRASO = 0.16;

  function azar(semilla) {
    var a = semilla >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hexRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function matiz(rgb, delta) {
    return (
      "rgb(" +
      rgb.map(function (c) {
        return Math.max(0, Math.min(255, Math.round(c + delta)));
      }).join(",") +
      ")"
    );
  }

  /* Curva Catmull-Rom muestreada a pasos casi regulares. */
  function muestrear(ctrl, paso) {
    var P = [ctrl[0]].concat(ctrl, [ctrl[ctrl.length - 1]]);
    var salida = [];
    for (var i = 1; i < P.length - 2; i++) {
      var p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
      var largo = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      var n = Math.max(2, Math.ceil(largo / paso));
      for (var k = 0; k < n; k++) {
        var t = k / n, t2 = t * t, t3 = t2 * t;
        salida.push([
          0.5 * (2 * p1[0] + (p2[0] - p0[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (3 * p1[0] - p0[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (p2[1] - p0[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    salida.push(ctrl[ctrl.length - 1]);
    return salida;
  }

  function crearTrazo(o) {
    var r = azar(o.semilla || 7);
    var puntos = muestrear(o.puntos, o.paso || 7);
    var total = puntos.length;
    var normales = puntos.map(function (p, i) {
      var a = puntos[Math.max(0, i - 2)], b = puntos[Math.min(total - 1, i + 2)];
      var dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1;
      return [-dy / m, dx / m];
    });
    var n = Math.min(o.maxCerdas || 150, Math.max(10, Math.round(o.ancho / 2.1)));
    var base = hexRgb(o.color);
    var secundarios = (o.vetas || []).map(hexRgb);
    var cerdas = [];
    for (var i = 0; i < n; i++) {
      var posicion = -1 + (2 * (i + r() * 0.9)) / n;
      var borde = Math.abs(posicion);
      var fuente = secundarios.length && r() < 0.16 ? secundarios[Math.floor(r() * secundarios.length)] : base;
      var seco = o.borrar ? 0 : (o.seco === undefined ? 0.5 : o.seco) * (0.35 + borde);
      var huecos = [];
      if (!o.borrar && r() < seco) {
        var h = 1 + Math.floor(r() * 3);
        while (h--) {
          var inicio = 0.25 + r() * 0.7;
          huecos.push([inicio, inicio + 0.015 + r() * 0.1]);
        }
      }
      cerdas.push({
        o: posicion,
        g: ((o.ancho / n) * (1.25 + r() * 1.5)),
        c: o.borrar ? "#000" : matiz(fuente, (r() - 0.5) * 34),
        ini: Math.floor(total * (o.borrar ? 0 : r() * 0.05 * (0.4 + borde))),
        fin: Math.floor((total - 1) * (1 - (o.borrar ? 0 : r() * 0.16 * (0.3 + borde)))),
        /* Cada cerda avanza con su propio retraso: el frente del trazo queda irregular. */
        lag: Math.floor(total * RETRASO * (r() * 0.75 + borde * 0.25)),
        am: (o.ancho / n) * (0.4 + r() * 1.2),
        f: 0.02 + r() * 0.05,
        fase: r() * 6.28,
        huecos: huecos,
        cur: 0,
      });
    }
    return { puntos: puntos, normales: normales, total: total, cerdas: cerdas, ancho: o.ancho, borrar: !!o.borrar };
  }

  function posicion(tr, c, i) {
    var t = i / tr.total;
    var perfil = Math.pow(Math.min(1, t / 0.05), 0.55) * Math.pow(Math.min(1, (1 - t) / 0.1), 0.45);
    var d = c.o * tr.ancho * 0.5 * (0.55 + 0.45 * perfil) + c.am * Math.sin(c.f * i + c.fase);
    return [tr.puntos[i][0] + tr.normales[i][0] * d, tr.puntos[i][1] + tr.normales[i][1] * d];
  }

  /* progreso va de 0 a 1. Las cerdas son opacas para que los tramos no dejen costuras. */
  function dibujarHasta(ctx, tr, progreso) {
    var frente = progreso * (tr.total - 1) * (1 + RETRASO);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = tr.borrar ? "destination-out" : "source-over";
    for (var k = 0; k < tr.cerdas.length; k++) {
      var c = tr.cerdas[k];
      var limite = Math.min(Math.floor(frente - c.lag), c.fin);
      var desde = Math.max(c.cur, c.ini);
      if (limite <= desde) continue;
      ctx.beginPath();
      var p = posicion(tr, c, desde);
      ctx.moveTo(p[0], p[1]);
      for (var i = desde + 1; i <= limite; i++) {
        var q = posicion(tr, c, i);
        var t = i / tr.total;
        var enHueco = false;
        for (var h = 0; h < c.huecos.length; h++) {
          if (t > c.huecos[h][0] && t < c.huecos[h][1]) { enHueco = true; break; }
        }
        if (enHueco) ctx.moveTo(q[0], q[1]);
        else ctx.lineTo(q[0], q[1]);
      }
      ctx.lineWidth = c.g;
      ctx.strokeStyle = c.c;
      ctx.stroke();
      c.cur = limite;
    }
    ctx.globalCompositeOperation = "source-over";
  }

  /* Secuencia animada de trazos: [{trazo, inicio, duracion}] en milisegundos. */
  function animar(ctx, lista, alTerminar) {
    var t0 = null, id = 0, vivo = true;
    function suave(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
    function cuadro(ahora) {
      if (!vivo) return;
      if (t0 === null) t0 = ahora;
      var pendientes = false;
      for (var i = 0; i < lista.length; i++) {
        var it = lista[i];
        var p = Math.max(0, Math.min(1, (ahora - t0 - it.inicio) / it.duracion));
        if (p < 1) pendientes = true;
        if (p > 0) dibujarHasta(ctx, it.trazo, suave(p));
      }
      if (pendientes) id = requestAnimationFrame(cuadro);
      else { vivo = false; if (alTerminar) alTerminar(); }
    }
    id = requestAnimationFrame(cuadro);
    return {
      cancelar: function () { vivo = false; cancelAnimationFrame(id); },
      completar: function () {
        if (!vivo) return;
        vivo = false;
        cancelAnimationFrame(id);
        lista.forEach(function (it) { dibujarHasta(ctx, it.trazo, 1); });
        if (alTerminar) alTerminar();
      },
    };
  }

  function preparar(canvas, dprMax) {
    var caja = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, dprMax || 1.5);
    canvas.width = Math.max(1, Math.round(caja.width * dpr));
    canvas.height = Math.max(1, Math.round(caja.height * dpr));
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: caja.width, h: caja.height };
  }

  /* Línea ondulada entre dos puntos, útil para barridos anchos. */
  function ondulada(x0, y0, x1, y1, onda, tramos, r) {
    var pts = [];
    for (var i = 0; i <= tramos; i++) {
      var t = i / tramos;
      var off = i === 0 || i === tramos ? 0 : (r() - 0.5) * onda;
      var nx = -(y1 - y0), ny = x1 - x0, m = Math.hypot(nx, ny) || 1;
      pts.push([x0 + (x1 - x0) * t + (nx / m) * off, y0 + (y1 - y0) * t + (ny / m) * off]);
    }
    return pts;
  }

  return { azar: azar, crearTrazo: crearTrazo, dibujarHasta: dibujarHasta, animar: animar, preparar: preparar, ondulada: ondulada, posicion: posicion };
})();
