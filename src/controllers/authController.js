// backend/src/controllers/authController.js
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const db = require("../config/db");
const cerebro = require("../config/cerebro");
const axios = require("axios");

// Configurar transporter de nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT, 10),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Error al conectar con el servidor de correo:", error);
  } else {
    console.log("✅ Servidor de correo listo para enviar mensajes");
  }
});

const generarToken = () => crypto.randomBytes(32).toString("hex");

const enviarEmailActivacion = async (destinatario, nombre, token) => {
  const frontendUrl =
    process.env.NODE_ENV === "production"
      ? process.env.FRONTEND_URL_PROD
      : cerebro.urls.frontendLocal;
  const activationLink = `${frontendUrl}/activar/${token}`;

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
    to: destinatario,
    subject: cerebro.plantillasEmail.activacion.asunto,
    html: cerebro.plantillasEmail.activacion.cuerpo(nombre, activationLink),
  };

  await transporter.sendMail(mailOptions);
};

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const {
      username,
      password,
      dni,
      email,
      nombre,
      apellido,
      tipoCuenta,
      plan,
    } = req.body;

    // 1. Validar campos obligatorios
    if (!username || !password || !dni || !email || !tipoCuenta || !plan) {
      return res
        .status(400)
        .json({ error: "Todos los campos son obligatorios" });
    }

    // 2. Validar formato email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ error: "El formato del email no es válido" });
    }

    // 3. Validar requisitos de contraseña
    const passConfig = cerebro.autenticacion.password;
    if (password.length < passConfig.minLongitud) {
      return res.status(400).json({
        error: `La contraseña debe tener al menos ${passConfig.minLongitud} caracteres`,
      });
    }
    if (passConfig.requiereMayuscula && !/[A-Z]/.test(password)) {
      return res
        .status(400)
        .json({ error: "La contraseña debe contener al menos una mayúscula" });
    }
    if (passConfig.requiereMinuscula && !/[a-z]/.test(password)) {
      return res
        .status(400)
        .json({ error: "La contraseña debe contener al menos una minúscula" });
    }
    if (passConfig.requiereNumero && !/[0-9]/.test(password)) {
      return res
        .status(400)
        .json({ error: "La contraseña debe contener al menos un número" });
    }
    // El carácter especial es opcional, no se valida como requerido

    // 4. Validar username (longitud)
    const { minLongitud, maxLongitud } = cerebro.autenticacion.username;
    if (username.length < minLongitud || username.length > maxLongitud) {
      return res.status(400).json({
        error: `El username debe tener entre ${minLongitud} y ${maxLongitud} caracteres`,
      });
    }

    // 5. Verificar unicidad case‑insensitive
    // Validar formato del DNI (solo números, 7-10 dígitos)
    if (!/^\d{7,10}$/.test(dni)) {
      return res.status(400).json({
        error: "El DNI debe contener entre 7 y 10 dígitos numéricos",
      });
    }

    // Verificar unicidad de username y dni (asíncrono)
    const userCheck = await db.query(
      "SELECT id FROM usuarios WHERE LOWER(username) = LOWER($1)",
      [username],
    );
    if (userCheck.rows.length > 0) {
      return res
        .status(409)
        .json({ error: "El nombre de usuario ya está en uso" });
    }

    const dniCheck = await db.query("SELECT id FROM usuarios WHERE dni = $1", [
      dni,
    ]);
    if (dniCheck.rows.length > 0) {
      return res.status(409).json({ error: "El DNI ya está registrado" });
    }

    // 6. Validar tipo de cuenta empresa
    if (tipoCuenta === "empresa") {
      const planesPermitidos = ["pro", "enterprise"];
      if (!planesPermitidos.includes(plan.toLowerCase())) {
        return res
          .status(400)
          .json({ error: "La cuenta empresa requiere plan Pro o Enterprise" });
      }
    }

    // 7. Hashear contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 8. Insertar usuario
    const insertUserQuery = `
      INSERT INTO usuarios (username, dni, email, password_hash, nombre, apellido, tipo_cuenta, rol, email_verificado, activo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'titular', FALSE, TRUE)
      RETURNING id, username, email, tipo_cuenta, created_at
    `;
    const userResult = await db.query(insertUserQuery, [
      username.toLowerCase(),
      dni,
      email,
      passwordHash,
      nombre,
      apellido,
      tipoCuenta,
    ]);
    const nuevoUsuario = userResult.rows[0];

    // 9. Insertar suscripción (¡esto faltaba!)
    // Buscar plan ignorando mayúsculas/minúsculas
    const planKey = Object.keys(cerebro.planes).find(
      (k) => k.toLowerCase() === plan.toLowerCase(),
    );
    if (!planKey) {
      return res.status(400).json({ error: "Plan no válido" });
    }
    const planData = cerebro.planes[planKey];
    const planIdQuery = await db.query(
      "SELECT id FROM planes WHERE LOWER(nombre) = LOWER($1)",
      [planKey],
    );
    if (planIdQuery.rows.length === 0) {
      return res
        .status(400)
        .json({ error: "Plan no encontrado en la base de datos" });
    }
    const planId = planIdQuery.rows[0].id;
    await db.query(
      "INSERT INTO suscripciones (usuario_id, plan_id, estado) VALUES ($1, $2, 'pendiente')",
      [nuevoUsuario.id, planId],
    );

    // 10. Generar token de activación
    const token = generarToken();
    const expiraEn = new Date(
      Date.now() + cerebro.autenticacion.duracionTokenActivacion,
    );
    await db.query(
      "INSERT INTO tokens (usuario_id, tipo, token, expira_en) VALUES ($1, $2, $3, $4)",
      [nuevoUsuario.id, "activacion", token, expiraEn],
    );

    // 11. Enviar email
    await enviarEmailActivacion(email, nombre || username, token);

    // 12. Responder éxito
    res.status(201).json({
      mensaje: "Registro exitoso. Te enviamos un email para activar tu cuenta.",
      usuario: {
        id: nuevoUsuario.id,
        username: nuevoUsuario.username,
        email: nuevoUsuario.email,
        tipoCuenta: nuevoUsuario.tipo_cuenta,
        creado: nuevoUsuario.created_at,
      },
    });
  } catch (error) {
    console.error("Error en registro:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// GET /api/auth/activar/:token
exports.activarCuenta = async (req, res) => {
  try {
    const { token } = req.params;

    // 1. Buscar token
    const tokenResult = await db.query(
      "SELECT * FROM tokens WHERE token = $1 AND tipo = $2",
      [token, "activacion"],
    );

    // 2. ¿Token existe?
    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: "Token inválido o no encontrado" });
    }

    const tokenData = tokenResult.rows[0];

    // 3. ¿Token ya usado?
    if (tokenData.usado) {
      return res
        .status(400)
        .json({ error: "Este enlace de activación ya fue utilizado" });
    }

    // 4. ¿Token expirado?
    if (new Date() > new Date(tokenData.expira_en)) {
      return res.status(400).json({
        error: "El enlace de activación ha expirado. Solicitá uno nuevo.",
      });
    }

    // 5. Obtener usuario y plan
    const usuario = await db.query(
      `SELECT u.id, u.email, u.email_verificado, p.nombre as plan_nombre, s.estado as suscripcion_estado
       FROM usuarios u
       LEFT JOIN suscripciones s ON u.id = s.usuario_id
       LEFT JOIN planes p ON s.plan_id = p.id
       WHERE u.id = $1`,
      [tokenData.usuario_id],
    );

    if (usuario.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const userData = usuario.rows[0];
    const planNombre = userData.plan_nombre?.toLowerCase() || "free";

    // 6. Lógica según plan
    if (planNombre === "free") {
      // Si la cuenta ya está activada (por doble clic o StrictMode)
      if (userData.email_verificado) {
        return res.status(200).json({
          mensaje: "Cuenta ya activada. Redirigiendo al inicio de sesión.",
          ya_activada: true,
        });
      }

      // Activar cuenta
      await db.query("UPDATE tokens SET usado = TRUE WHERE id = $1", [
        tokenData.id,
      ]);
      await db.query(
        "UPDATE usuarios SET email_verificado = TRUE WHERE id = $1",
        [userData.id],
      );
      await db.query(
        "UPDATE suscripciones SET estado = 'activa' WHERE usuario_id = $1 AND estado = 'pendiente'",
        [userData.id],
      );

      // Cargar tokens iniciales si el plan tiene tokens
      const planKey = Object.keys(cerebro.planes).find(
        (k) => k.toLowerCase() === "free",
      );
      if (planKey) {
        const planData = cerebro.planes[planKey];
        const tokensIniciales = planData.tokensIniciales || 0;
        if (tokensIniciales > 0) {
          // Insertar billetera si no existe
          await db.query(
            `INSERT INTO billeteras (usuario_id, saldo_tokens)
             VALUES ($1, $2)
             ON CONFLICT (usuario_id) DO NOTHING`,
            [userData.id, tokensIniciales],
          );
          // Registrar transacción de carga
          await db.query(
            `INSERT INTO transacciones_token (usuario_id, tipo, cantidad, descripcion, saldo_resultante, origen)
             VALUES ($1, 'carga', $2, 'Tokens iniciales plan ${planData.nombre}', $2, 'activacion_cuenta')`,
            [userData.id, tokensIniciales],
          );
        }
      }

      return res.status(200).json({
        mensaje: "Cuenta activada exitosamente. Ya podés iniciar sesión.",
        activada: true,
      });
    } else if (planNombre === "payasyougo") {
      // Pago por consumo: validar tarjeta con $1 ARS y tokenizar
      if (userData.email_verificado) {
        return res.status(200).json({
          mensaje: "Cuenta ya activada. Redirigiendo al inicio de sesión.",
          ya_activada: true,
        });
      }

      // Redirigir a PayM con cobro simbólico de 1 ARS y tokenización forzada
      return res.status(200).json({
        mensaje:
          "Token válido. Redirigiendo a la pasarela de pago para validar tu tarjeta.",
        requierePago: true,
        plan: "payasyougo",
        usuario_id: userData.id,
        pasarelaUrl: `${process.env.PAYM_FRONTEND_URL}/checkout?api_key=${process.env.PAYM_PUBLIC_KEY}&amount=1&currency=ARS&concept=Validación de tarjeta - PayAsYouGo&ref=user_${userData.id}_token_${token}&tokenize=true&tokenize_disabled=true`,
      });
    } else {
      // Planes pagos (Starter, Pro, Enterprise)
      // Si la cuenta ya está activada (pago ya realizado)
      if (userData.email_verificado) {
        return res.status(200).json({
          mensaje: "Cuenta ya activada. Redirigiendo al inicio de sesión.",
          ya_activada: true,
        });
      }

      // Si la suscripción ya está activa, activar cuenta directamente
      if (userData.suscripcion_estado === "activa") {
        await db.query("UPDATE tokens SET usado = TRUE WHERE id = $1", [
          tokenData.id,
        ]);
        await db.query(
          "UPDATE usuarios SET email_verificado = TRUE WHERE id = $1",
          [userData.id],
        );
        return res.status(200).json({
          mensaje: "Cuenta activada exitosamente. Ya podés iniciar sesión.",
          activada: true,
        });
      }

      // Redirigir a PayM sin marcar token como usado
      return res.status(200).json({
        mensaje:
          "Token válido. Redirigiendo a la pasarela de pago para completar la activación.",
        requierePago: true,
        plan: planNombre,
        usuario_id: userData.id,
        pasarelaUrl: `${process.env.PAYM_FRONTEND_URL}/checkout?api_key=${process.env.PAYM_PUBLIC_KEY}&amount=${cerebro.planes[planNombre]?.precioMensual || 0}&currency=USD&concept=Activación de cuenta ${planNombre}&ref=user_${userData.id}_token_${token}&tokenize=true`,
      });
    }
  } catch (error) {
    console.error("Error en activación:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// POST /api/auth/check-username
exports.checkUsername = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || username.length < 6) {
      return res
        .status(400)
        .json({ disponible: false, error: "Mínimo 6 caracteres" });
    }
    const result = await db.query(
      "SELECT id FROM usuarios WHERE LOWER(username) = LOWER($1)",
      [username],
    );
    return res.json({ disponible: result.rows.length === 0 });
  } catch (error) {
    console.error("Error en check-username:", error);
    return res
      .status(500)
      .json({ disponible: false, error: "Error del servidor" });
  }
};

// POST /api/auth/check-dni
exports.checkDni = async (req, res) => {
  try {
    const { dni } = req.body;
    if (!dni || dni.length < 7) {
      return res
        .status(400)
        .json({ disponible: false, error: "DNI muy corto" });
    }
    const result = await db.query("SELECT id FROM usuarios WHERE dni = $1", [
      dni,
    ]);
    return res.json({ disponible: result.rows.length === 0 });
  } catch (error) {
    console.error("Error en check-dni:", error);
    return res
      .status(500)
      .json({ disponible: false, error: "Error del servidor" });
  }
};

// POST /api/auth/confirmar-pago
exports.confirmarPago = async (req, res) => {
  try {
    const { ref, transaction_id, card_id } = req.body;
    if (!ref || !transaction_id) {
      return res
        .status(400)
        .json({ error: "Faltan parámetros (ref, transaction_id)" });
    }

    // Extraer ID de usuario del campo ref (formato: user_13)
    // Extraer ID de usuario del nuevo formato: user_ID_token_...
    const userId = parseInt(ref.split("_")[1]);
    if (isNaN(userId)) {
      return res.status(400).json({ error: "Referencia de usuario inválida" });
    }

    // Verificar que el usuario existe
    const usuario = await db.query(
      "SELECT id, email_verificado FROM usuarios WHERE id = $1",
      [userId],
    );
    if (usuario.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Si la cuenta ya está activada, responder éxito sin hacer nada
    if (usuario.rows[0].email_verificado) {
      return res.status(200).json({
        mensaje: "Cuenta ya activada anteriormente.",
        activada: true,
      });
    }

    // Buscar token de activación pendiente para este usuario
    const tokenResult = await db.query(
      "SELECT id FROM tokens WHERE usuario_id = $1 AND tipo = 'activacion' AND usado = FALSE AND expira_en > NOW()",
      [userId],
    );
    if (tokenResult.rows.length === 0) {
      return res
        .status(400)
        .json({ error: "No se encontró un token de activación válido" });
    }

    const tokenId = tokenResult.rows[0].id;

    // Marcar token como usado
    await db.query("UPDATE tokens SET usado = TRUE WHERE id = $1", [tokenId]);

    // Activar la cuenta
    await db.query(
      "UPDATE usuarios SET email_verificado = TRUE WHERE id = $1",
      [userId],
    );

    // Activar la suscripción
    await db.query(
      "UPDATE suscripciones SET estado = 'activa' WHERE usuario_id = $1 AND estado = 'pendiente'",
      [userId],
    );

    // Guardar card_id en la suscripción si viene
    if (card_id) {
      await db.query(
        "UPDATE suscripciones SET metodo_pago_tokenizado = $1 WHERE usuario_id = $2",
        [card_id, userId],
      );
    }

    // Cargar tokens según el plan
    const suscripcion = await db.query(
      "SELECT p.nombre as plan_nombre FROM suscripciones s JOIN planes p ON s.plan_id = p.id WHERE s.usuario_id = $1",
      [userId],
    );
    if (suscripcion.rows.length > 0) {
      const planNombre = suscripcion.rows[0].plan_nombre.toLowerCase();
      const planKey = Object.keys(cerebro.planes).find(
        (k) => k.toLowerCase() === planNombre,
      );
      if (planKey) {
        const planData = cerebro.planes[planKey];
        // Solo cargar tokens si el plan tiene tokens mensuales (no Free ni PayAsYouGo)
        const tokensACargar = planData.tokensMensuales || 0;
        if (tokensACargar > 0) {
          // Insertar o actualizar billetera
          await db.query(
            `INSERT INTO billeteras (usuario_id, saldo_tokens)
             VALUES ($1, $2)
             ON CONFLICT (usuario_id) DO UPDATE SET saldo_tokens = billeteras.saldo_tokens + $2`,
            [userId, tokensACargar],
          );
          // Registrar transacción
          await db.query(
            `INSERT INTO transacciones_token (usuario_id, tipo, cantidad, descripcion, saldo_resultante, origen)
             VALUES ($1, 'carga', $2, 'Tokens iniciales plan ${planData.nombre}', $2, 'activacion_pago')`,
            [userId, tokensACargar],
          );
        }
      }
    }

    // Reintegro automático para PayAsYouGo
    if (suscripcion.rows.length > 0) {
      const planNombre = suscripcion.rows[0].plan_nombre.toLowerCase();
      if (planNombre === "payasyougo") {
        try {
          await axios.post(`${process.env.PAYM_BASE_URL}/payments/refund`, {
            api_key: process.env.PAYM_PUBLIC_KEY,
            transaction_id,
            card_id,
          });
          console.log(
            `✅ Reintegro automático PayAsYouGo: transacción ${transaction_id}`,
          );
        } catch (refundError) {
          console.error(
            "❌ Error al hacer reintegro PayAsYouGo:",
            refundError.message,
          );
          // No revertimos la activación; el pago ya está hecho.
        }
      }
    }

    return res.status(200).json({
      mensaje: "Pago confirmado exitosamente. Cuenta activada.",
      activada: true,
    });
  } catch (error) {
    console.error("Error en confirmar-pago:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};

// POST /api/auth/invalidar-token
exports.invalidarToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Token requerido" });
    }

    const result = await db.query(
      "UPDATE tokens SET usado = TRUE WHERE token = $1 AND tipo = 'activacion' AND usado = FALSE",
      [token],
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: "Token no encontrado o ya utilizado" });
    }

    return res.json({ mensaje: "Token invalidado correctamente" });
  } catch (error) {
    console.error("Error en invalidar-token:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};
