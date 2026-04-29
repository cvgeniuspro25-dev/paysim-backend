// backend/src/config/cerebro.js
// 🧠 CEREBRO DEL PROYECTO - CONFIGURACIÓN GLOBAL
// Cualquier cambio aquí afecta a toda la aplicación (Backend y Frontend en espejo)

module.exports = {
  // ==========================================
  // SECCIÓN 1: TEMAS Y COLORES (Modo Claro/Oscuro)
  // ==========================================
  tema: {
    claro: {
      fondo: "#FFFFFF",
      texto: "#1A1A1A",
      primario: "#009EE3", // Azul Mercado Pago
      secundario: "#FF6B00", // Naranja
      exito: "#00A650", // Verde
      error: "#F23D4F", // Rojo
      advertencia: "#FFC107", // Amarillo
      info: "#3483FA", // Azul claro
    },
    oscuro: {
      fondo: "#121212",
      texto: "#E0E0E0",
      primario: "#009EE3",
      secundario: "#FF8C42",
      exito: "#00C853",
      error: "#FF5A5F",
      advertencia: "#FFCA28",
      info: "#5C9EFF",
    },
    // Tema activo por defecto
    activo: "claro",
  },

  // ==========================================
  // SECCIÓN 2: PLANES DE SUSCRIPCIÓN
  // ==========================================
  planes: {
    free: {
      nombre: "Free",
      precioMensual: 0,
      tokensIniciales: 100, // Única vez
      permiteEmpleados: false,
      maxEmpleados: 0,
      permiteCompraTokens: true,
      permitePagoPorConsumo: true,
    },
    starter: {
      nombre: "Starter",
      precioMensual: 15, // USD o ARS (definir moneda)
      tokensMensuales: 500,
      permiteEmpleados: false,
      maxEmpleados: 0,
      permiteCompraTokens: true,
      permitePagoPorConsumo: true,
    },
    pro: {
      nombre: "Pro",
      precioMensual: 45,
      tokensMensuales: 2000,
      permiteEmpleados: true,
      maxEmpleados: 3,
      permiteCompraTokens: true,
      permitePagoPorConsumo: true,
      precioEmpleadoExtra: 10, // Por empleado adicional/mes
    },
    enterprise: {
      nombre: "Enterprise",
      precioMensual: 150,
      tokensMensuales: 20000,
      permiteEmpleados: true,
      maxEmpleados: 20,
      permiteCompraTokens: true,
      permitePagoPorConsumo: true,
      precioEmpleadoExtra: 8,
    },
    // Pago por consumo (sin suscripción)
    payAsYouGo: {
      nombre: "Pago por Consumo",
      precioMensual: 0,
      tokensMensuales: 0,
      requiereTarjetaValidada: true,
      facturacionMensual: true,
    },
  },

  // ==========================================
  // SECCIÓN 3: PAQUETES DE TOKENS (Compra única)
  // ==========================================
  paquetesTokens: [
    { cantidad: 100, precio: 5, descuento: 0 },
    { cantidad: 500, precio: 22.5, descuento: 10 }, // 10% descuento
    { cantidad: 1000, precio: 40, descuento: 20 }, // 20% descuento
    { cantidad: 5000, precio: 175, descuento: 30 },
  ],

  // ==========================================
  // SECCIÓN 4: EQUIVALENCIAS Y CÁLCULOS
  // ==========================================
  equivalencias: {
    tokenAPesos: 5000, // 1 token = AR$ 5000
    monedasSoportadas: ["ARS", "USD"],
    // Factor de conversión dinámico (se puede obtener de API externa en producción)
    dolarAPesos: 1000, // 1 USD = 1000 ARS (ejemplo)
  },

  // ==========================================
  // SECCIÓN 5: CONSUMOS DE TOKENS (Costos de acciones)
  // ==========================================
  consumos: {
    crearAplicacion: 2, // Tokens por app creada (Developer)
    crearTarjetaTester: 1, // Tokens por tarjeta creada (Tester)
    renovarTarjetaRobadaPerdida: 0, // Gratis (pero inhabilita anterior)
    reemplazarTarjetaBloqueada: 1, // 1 token
    // La carga de saldo/límite se calcula según equivalencia tokenAPesos
  },

  // ==========================================
  // SECCIÓN 6: LÍMITES Y SEGURIDAD
  // ==========================================
  limites: {
    maxAplicacionesFree: 2,
    maxAplicacionesStarter: 10,
    maxAplicacionesPro: 50,
    maxAplicacionesEnterprise: 200,
    maxTarjetasPorAplicacion: 8, // 8 tarjetas virtuales por app
    longitudMinimaPassword: 8,
    intentosMaximosLogin: 5,
    tiempoBloqueoLogin: 15 * 60 * 1000, // 15 minutos en ms
  },

  // ==========================================
  // SECCIÓN 7: PLANTILLAS DE CORREO ELECTRÓNICO
  // ==========================================
  plantillasEmail: {
    bienvenida: {
      asunto: "¡Bienvenido a PaySim!",
      cuerpo: (nombre) => `Hola ${nombre}, gracias por unirte a PaySim...`,
    },
    resumenMensual: {
      asunto: "Tu resumen mensual de PaySim",
      cuerpo: (nombre, totalTokens) =>
        `Hola ${nombre}, este mes consumiste ${totalTokens} tokens...`,
    },
    // Se irán agregando más plantillas según necesidad
  },

  // ==========================================
  // SECCIÓN 8: DISEÑOS DE MODALES (Clases CSS)
  // ==========================================
  modales: {
    exito: {
      clase: "modal-exito",
      icono: "✅",
      colorFondo: "#00A650",
    },
    error: {
      clase: "modal-error",
      icono: "❌",
      colorFondo: "#F23D4F",
    },
    advertencia: {
      clase: "modal-advertencia",
      icono: "⚠️",
      colorFondo: "#FFC107",
    },
    info: {
      clase: "modal-info",
      icono: "ℹ️",
      colorFondo: "#3483FA",
    },
  },

  // ==========================================
  // SECCIÓN 9: CONFIGURACIÓN DE RESPONSIVIDAD
  // ==========================================
  breakpoints: {
    mobile: "480px",
    tablet: "768px",
    desktop: "1024px",
    wide: "1440px",
  },

  // ==========================================
  // SECCIÓN 10: URLS Y ENDPOINTS (SIN HARDCODEAR)
  // ==========================================
  urls: {
    backendLocal: "http://192.168.10.12:5000",
    frontendLocal: "http://192.168.10.12:5180",
    // En producción se usarán las variables de entorno de Railway/Vercel
  },

  // ==========================================
  // SECCIÓN 11: AUTENTICACIÓN Y REGISTRO
  // ==========================================
  autenticacion: {
    duracionTokenActivacion: 24 * 60 * 60 * 1000, // 24 horas en ms
    duracionTokenRecuperacion: 60 * 60 * 1000, // 1 hora en ms
    password: {
      minLongitud: 8,
      requiereMayuscula: true,
      requiereMinuscula: true,
      requiereNumero: true,
      requiereEspecial: false,
      caracteresEspeciales: "!@#$%^&*()_+-=[]{}|;:,.<>?",
    },
    username: {
      minLongitud: 6,
      maxLongitud: 50,
    },
    pagos: {
      intentosMaximos: 5,
    },
    email: {
      servicio: "gmail",
      remitente: process.env.EMAIL_USER || "noreply@paysim.com",
    },
  },
  // ==========================================
  // SECCIÓN 12: PLANTILLAS DE CORREO ELECTRÓNICO
  // ==========================================
  plantillasEmail: {
    recuperarContrasena: {
      asunto: "Recuperación de contraseña - PaySim",
      cuerpo: (nombre, enlace) => `
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background-color: #009EE3; padding: 30px 20px; text-align: center;">
                    <h1 style="color: #ffffff; font-family: Arial, sans-serif; font-size: 28px; margin: 0;">PaySim</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #333333; font-family: Arial, sans-serif; font-size: 22px; margin: 0 0 15px;">Hola, ${nombre}!</h2>
                    <p style="color: #555555; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                      Recibimos una solicitud para restablecer tu contraseña. Hacé clic en el botón de abajo para continuar.
                    </p>
                    <p style="color: #555555; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                      Si no fuiste vos, simplemente ignorá este mensaje.
                    </p>
                    <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                      <tr>
                        <td align="center" style="background-color: #009EE3; padding: 14px 32px; border-radius: 6px;">
                          <a href="${enlace}" style="color: #ffffff; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; text-decoration: none;">Cambiar contraseña</a>
                        </td>
                      </tr>
                    </table>
                    <p style="color: #777777; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; margin-top: 25px;">
                      Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br>
                      <a href="${enlace}" style="color: #009EE3; word-break: break-all;">${enlace}</a>
                    </p>
                    <p style="color: #999999; font-family: Arial, sans-serif; font-size: 13px; margin-top: 25px;">
                      Este enlace expirará en 1 hora por razones de seguridad.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f8f8f8; padding: 20px 30px; text-align: center;">
                    <p style="color: #aaaaaa; font-family: Arial, sans-serif; font-size: 12px; margin: 0;">© 2026 PaySim. Todos los derechos reservados.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `,
    },
    recordarUsuario: {
      asunto: "Recordatorio de usuario - PaySim",
      cuerpo: (nombre, username) => `
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background-color: #009EE3; padding: 30px 20px; text-align: center;">
                    <h1 style="color: #ffffff; font-family: Arial, sans-serif; font-size: 28px; margin: 0;">PaySim</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #333333; font-family: Arial, sans-serif; font-size: 22px; margin: 0 0 15px;">Hola, ${nombre}!</h2>
                    <p style="color: #555555; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                      Recibimos una solicitud para recordar tu nombre de usuario.
                    </p>
                    <p style="color: #333333; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; text-align: center; margin: 0 0 25px;">
                      Tu nombre de usuario es: <span style="color: #009EE3;">${username}</span>
                    </p>
                    <p style="color: #999999; font-family: Arial, sans-serif; font-size: 13px; margin-top: 25px;">
                      Si no solicitaste esto, ignorá este mensaje.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f8f8f8; padding: 20px 30px; text-align: center;">
                    <p style="color: #aaaaaa; font-family: Arial, sans-serif; font-size: 12px; margin: 0;">© 2026 PaySim. Todos los derechos reservados.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `,
    },
    activacion: {
      asunto: "Activa tu cuenta de PaySim",
      cuerpo: (nombre, activationLink) => `
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <!-- Encabezado -->
                <tr>
                  <td style="background-color: #009EE3; padding: 30px 20px; text-align: center;">
                    <h1 style="color: #ffffff; font-family: Arial, sans-serif; font-size: 28px; margin: 0;">PaySim</h1>
                    <p style="color: #e0f0ff; font-family: Arial, sans-serif; font-size: 16px; margin: 10px 0 0;">Simulador de Pagos Profesional</p>
                  </td>
                </tr>
                <!-- Contenido -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #333333; font-family: Arial, sans-serif; font-size: 22px; margin: 0 0 15px;">¡Bienvenido, ${nombre}!</h2>
                    <p style="color: #555555; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                      Gracias por registrarte en PaySim. Para comenzar a simular pagos, activá tu cuenta haciendo clic en el botón de abajo.
                    </p>
                    <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                      <tr>
                        <td align="center" style="background-color: #009EE3; padding: 14px 32px; border-radius: 6px;">
                          <a href="${activationLink}" style="color: #ffffff; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; text-decoration: none;">Activar cuenta</a>
                        </td>
                      </tr>
                    </table>
                    <p style="color: #777777; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; margin-top: 25px;">
                      Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br>
                      <a href="${activationLink}" style="color: #009EE3; word-break: break-all;">${activationLink}</a>
                    </p>
                    <p style="color: #999999; font-family: Arial, sans-serif; font-size: 13px; margin-top: 25px;">
                      Este enlace expirará en 24 horas por razones de seguridad.
                    </p>
                  </td>
                </tr>
                <!-- Pie -->
                <tr>
                  <td style="background-color: #f8f8f8; padding: 20px 30px; text-align: center;">
                    <p style="color: #aaaaaa; font-family: Arial, sans-serif; font-size: 12px; margin: 0;">
                      Si no creaste esta cuenta, simplemente ignorá este mensaje.<br>
                      © 2026 PaySim. Todos los derechos reservados.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `,
    },
  },
};
