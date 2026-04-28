// backend/src/services/cotizacionService.js
const axios = require("axios");
const cerebro = require("../config/cerebro");

// API gratuita del Banco Central de Argentina (no requiere key)
const URL_COTIZACION = "https://api.bluelytics.com.ar/v2/latest";

const actualizarCotizacion = async () => {
  try {
    const { data } = await axios.get(URL_COTIZACION, { timeout: 10000 });
    // blue.value_sell es el valor de venta del dólar blue en Argentina
    const dolarBlue = data.blue?.value_sell;
    if (dolarBlue && !isNaN(dolarBlue)) {
      cerebro.equivalencias.dolarAPesos = Math.round(dolarBlue);
      console.log(
        `✅ Cotización dólar actualizada: $${cerebro.equivalencias.dolarAPesos} ARS`,
      );
    } else {
      console.warn(
        "⚠️ No se pudo obtener la cotización del dólar. Se mantiene el valor anterior.",
      );
    }
  } catch (error) {
    console.error("❌ Error al actualizar cotización:", error.message);
  }
};

// Ejecutar al iniciar y luego cada 6 horas
actualizarCotizacion();
setInterval(actualizarCotizacion, 6 * 60 * 60 * 1000); // 6 horas

module.exports = actualizarCotizacion;
