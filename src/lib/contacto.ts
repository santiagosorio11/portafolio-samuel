export const WHATSAPP = "573205003237";

export const MENSAJES = {
  saludo: "Hola Sam, vi tu galería web y quisiera hablar contigo sobre tu arte.",
  encargo: "Hola Sam, vi tu galería web y me gustaría encargar una obra con una intención especial.",
};

export function enlaceWa(mensaje: string) {
  return "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(mensaje);
}
