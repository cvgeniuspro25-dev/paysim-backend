// backend/src/controllers/adminController.js
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const db = require("../config/db");
const cerebro = require("../config/cerebro");

// ==============================================
// PERFIL DEL ADMINISTRADOR
// ==============================================

// GET /api/admin/perfil
exports.obtenerPerfil = async (req, res) => {
  try {
    const { id } = req.user;
    const result = await db.query(
      `SELECT username, email, nombre, apellido, dni, fecha_nacimiento, sexo,
              domicilio, localidad, cod_postal, provincia, telefono, foto_perfil
       FROM usuarios WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error al obtener perfil:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// PUT /api/admin/perfil
exports.actualizarPerfil = async (req, res) => {
  try {
    const { id } = req.user;
    // El username NUNCA se puede cambiar (regla de negocio)
    const {
      nombre,
      apellido,
      email,
      dni,
      fecha_nacimiento,
      sexo,
      domicilio,
      localidad,
      cod_postal,
      provincia,
      telefono,
    } = req.body;

    // Validar campos obligatorios
    if (!dni || !sexo) {
      return res.status(400).json({ error: "DNI y sexo son obligatorios" });
    }

    // Validar sexo
    if (!["masculino", "femenino", "otro"].includes(sexo)) {
      return res.status(400).json({ error: "Sexo inválido" });
    }

    // Validar DNI (solo números, 7-10 dígitos)
    if (!/^\d{7,10}$/.test(dni)) {
      return res.status(400).json({ error: "DNI inválido" });
    }

    // Verificar que el DNI no esté en uso por otro usuario
    const dniCheck = await db.query(
      "SELECT id FROM usuarios WHERE dni = $1 AND id != $2",
      [dni, id],
    );
    if (dniCheck.rows.length > 0) {
      return res.status(409).json({ error: "El DNI ya está en uso" });
    }

    const result = await db.query(
      `UPDATE usuarios SET
        nombre = COALESCE($1, nombre),
        apellido = COALESCE($2, apellido),
        email = COALESCE($3, email),
        dni = $4,
        fecha_nacimiento = $5,
        sexo = $6,
        domicilio = $7,
        localidad = $8,
        cod_postal = $9,
        provincia = $10,
        telefono = $11
       WHERE id = $12
       RETURNING username, email, nombre, apellido, dni, fecha_nacimiento, sexo,
                 domicilio, localidad, cod_postal, provincia, telefono, foto_perfil`,
      [
        nombre,
        apellido,
        email,
        dni,
        fecha_nacimiento || null,
        sexo,
        domicilio || null,
        localidad || null,
        cod_postal || null,
        provincia || null,
        telefono || null,
        id,
      ],
    );

    res.json({
      mensaje: "Perfil actualizado correctamente",
      perfil: result.rows[0],
    });
  } catch (error) {
    console.error("Error al actualizar perfil:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// POST /api/admin/cambiar-password
exports.cambiarPassword = async (req, res) => {
  try {
    const { id } = req.user;
    const { password_actual, password_nueva } = req.body;

    if (!password_actual || !password_nueva) {
      return res.status(400).json({ error: "Ambos campos son obligatorios" });
    }

    // Validar requisitos de contraseña nueva
    const passConfig = cerebro.autenticacion.password;
    if (password_nueva.length < passConfig.minLongitud) {
      return res.status(400).json({
        error: `La contraseña debe tener al menos ${passConfig.minLongitud} caracteres`,
      });
    }
    if (passConfig.requiereMayuscula && !/[A-Z]/.test(password_nueva)) {
      return res
        .status(400)
        .json({ error: "Debe contener al menos una mayúscula" });
    }
    if (passConfig.requiereMinuscula && !/[a-z]/.test(password_nueva)) {
      return res
        .status(400)
        .json({ error: "Debe contener al menos una minúscula" });
    }
    if (passConfig.requiereNumero && !/[0-9]/.test(password_nueva)) {
      return res
        .status(400)
        .json({ error: "Debe contener al menos un número" });
    }

    // Verificar contraseña actual
    const usuario = await db.query(
      "SELECT password_hash FROM usuarios WHERE id = $1",
      [id],
    );
    const passwordValida = await bcrypt.compare(
      password_actual,
      usuario.rows[0].password_hash,
    );
    if (!passwordValida) {
      return res.status(401).json({ error: "Contraseña actual incorrecta" });
    }

    // Hashear y actualizar
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password_nueva, salt);
    await db.query("UPDATE usuarios SET password_hash = $1 WHERE id = $2", [
      hash,
      id,
    ]);

    res.json({ mensaje: "Contraseña actualizada correctamente" });
  } catch (error) {
    console.error("Error al cambiar contraseña:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// POST /api/admin/subir-foto
exports.subirFoto = async (req, res) => {
  try {
    const { foto_base64 } = req.body;
    if (!foto_base64) {
      return res
        .status(400)
        .json({ error: "No se ha recibido ninguna imagen" });
    }

    const { id } = req.user;

    await db.query("UPDATE usuarios SET foto_perfil = $1 WHERE id = $2", [
      foto_base64,
      id,
    ]);

    res.json({
      mensaje: "Foto actualizada correctamente",
      foto_url: foto_base64,
    });
  } catch (error) {
    console.error("Error al subir foto:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ==============================================
// GESTIÓN DE USUARIOS
// ==============================================

// GET /api/admin/usuarios
exports.listarUsuarios = async (req, res) => {
  try {
    const {
      busqueda,
      estado,
      plan,
      tipo_cuenta,
      activo,
      deuda,
      offset = 0,
      limit = 20,
    } = req.query;

    const conditions = [];
    const params = [];

    // Búsqueda textual
    if (busqueda) {
      params.push(`%${busqueda}%`);
      conditions.push(
        `(u.apellido ILIKE $${params.length} OR u.username ILIKE $${params.length} OR u.dni ILIKE $${params.length})`,
      );
    }

    // Estado del usuario (unificado)
    if (estado) {
      switch (estado) {
        case "activado":
          // Cuenta verificada, activa, sin deuda
          conditions.push("u.email_verificado = TRUE");
          conditions.push("u.activo = TRUE");
          conditions.push(
            "(s.estado IS NULL OR s.estado != 'impaga' OR s.fecha_fin >= NOW())",
          );
          break;
        case "pendiente":
          // Cuenta no verificada
          conditions.push("u.email_verificado = FALSE");
          break;
        case "bloqueado":
          // Cuenta desactivada manualmente
          conditions.push("u.activo = FALSE");
          break;
        case "deuda":
          // Suscripción impaga y vencida
          conditions.push("s.estado = 'impaga'");
          conditions.push("s.fecha_fin < NOW()");
          break;
      }
    }

    // Plan
    if (plan) {
      params.push(plan);
      conditions.push(`LOWER(p.nombre) = LOWER($${params.length})`);
    }

    // Tipo de cuenta
    if (tipo_cuenta) {
      params.push(tipo_cuenta);
      conditions.push(`u.tipo_cuenta = $${params.length}`);
    }

    // Los parámetros activo y deuda se eliminan porque el switch ya los contempla

    const whereClause =
      conditions.length > 0
        ? `WHERE u.rol != 'admin' AND ${conditions.join(" AND ")}`
        : `WHERE u.rol != 'admin'`;

    const query = `
      SELECT u.id, u.username, u.nombre, u.apellido, u.dni, u.tipo_cuenta, u.email_verificado, u.activo, u.created_at,
             p.nombre AS plan, b.saldo_tokens, b.deuda_tokens,
             CASE 
               WHEN s.estado = 'impaga' AND s.fecha_fin < NOW() THEN true
               ELSE false
             END AS en_deuda
      FROM usuarios u
      LEFT JOIN suscripciones s ON u.id = s.usuario_id
      LEFT JOIN planes p ON s.plan_id = p.id
      LEFT JOIN billeteras b ON u.id = b.usuario_id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Error al listar usuarios:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// GET /api/admin/usuarios/:id
exports.obtenerUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await db.query(
      `SELECT u.*, p.nombre AS plan, b.saldo_tokens, b.deuda_tokens,
              s.estado AS estado_suscripcion, s.metodo_pago_tokenizado
       FROM usuarios u
       LEFT JOIN suscripciones s ON u.id = s.usuario_id AND s.estado = 'activa'
       LEFT JOIN planes p ON s.plan_id = p.id
       LEFT JOIN billeteras b ON u.id = b.usuario_id
       WHERE u.id = $1`,
      [id],
    );

    if (usuario.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Obtener transacciones del usuario
    const transacciones = await db.query(
      "SELECT * FROM transacciones_token WHERE usuario_id = $1 ORDER BY created_at DESC LIMIT 50",
      [id],
    );

    res.json({ ...usuario.rows[0], transacciones: transacciones.rows });
  } catch (error) {
    console.error("Error al obtener usuario:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// PUT /api/admin/usuarios/:id
exports.actualizarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { bloquear, desbloquear, cambiar_plan, regalar_tokens, tipo_cuenta } =
      req.body;

    if (bloquear) {
      await db.query("UPDATE usuarios SET activo = FALSE WHERE id = $1", [id]);
    }

    if (desbloquear) {
      await db.query("UPDATE usuarios SET activo = TRUE WHERE id = $1", [id]);
    }

    if (cambiar_plan) {
      const planKeyNuevo = Object.keys(cerebro.planes).find(
        (k) => k.toLowerCase() === cambiar_plan.toLowerCase(),
      );
      if (!planKeyNuevo) {
        return res.status(400).json({ error: "Plan no válido" });
      }
      const planData = cerebro.planes[planKeyNuevo];

      // Obtener plan actual del usuario
      const suscripcionActual = await db.query(
        `SELECT p.nombre FROM suscripciones s
         JOIN planes p ON s.plan_id = p.id
         WHERE s.usuario_id = $1 AND s.estado = 'activa'`,
        [id],
      );
      if (suscripcionActual.rows.length > 0) {
        const planActualNombre = suscripcionActual.rows[0].nombre.toLowerCase();
        const planActualKey = Object.keys(cerebro.planes).find(
          (k) => k.toLowerCase() === planActualNombre,
        );
        if (planActualKey) {
          const tokensActuales =
            cerebro.planes[planActualKey].tokensMensuales || 0;
          const tokensNuevos = planData.tokensMensuales || 0;
          if (tokensNuevos < tokensActuales) {
            return res.status(400).json({
              error:
                "No está permitido cambiar a un plan inferior. El usuario debe hacerlo desde su panel.",
            });
          }
        }
      }

      const planId = await db.query(
        "SELECT id FROM planes WHERE LOWER(nombre) = LOWER($1)",
        [cambiar_plan],
      );
      if (planId.rows.length === 0) {
        return res
          .status(400)
          .json({ error: "Plan no encontrado en la base de datos" });
      }

      // Desactivar suscripción actual
      await db.query(
        "UPDATE suscripciones SET estado = 'cancelada' WHERE usuario_id = $1 AND estado = 'activa'",
        [id],
      );

      // Crear nueva suscripción
      await db.query(
        "INSERT INTO suscripciones (usuario_id, plan_id, estado) VALUES ($1, $2, 'activa')",
        [id, planId.rows[0].id],
      );

      // Agregar tokens del nuevo plan (acumulables, nunca se descuentan los existentes)
      const tokens = planData.tokensMensuales || 0;
      if (tokens > 0) {
        await db.query(
          `INSERT INTO billeteras (usuario_id, saldo_tokens)
           VALUES ($1, $2)
           ON CONFLICT (usuario_id) DO UPDATE SET saldo_tokens = billeteras.saldo_tokens + $2`,
          [id, tokens],
        );
        await db.query(
          `INSERT INTO transacciones_token (usuario_id, tipo, cantidad, descripcion, saldo_resultante, origen)
           VALUES ($1, 'carga', $2, 'Cambio de plan a ${cambiar_plan}', $2, 'cambio_plan')`,
          [id, tokens],
        );
      }
    }

    if (regalar_tokens && parseInt(regalar_tokens) > 0) {
      const tokens = parseInt(regalar_tokens);
      await db.query(
        `INSERT INTO billeteras (usuario_id, saldo_tokens)
         VALUES ($1, $2)
         ON CONFLICT (usuario_id) DO UPDATE SET saldo_tokens = billeteras.saldo_tokens + $2`,
        [id, tokens],
      );
      await db.query(
        `INSERT INTO transacciones_token (usuario_id, tipo, cantidad, descripcion, saldo_resultante, origen)
         VALUES ($1, 'ajuste', $2, 'Regalo de tokens por administrador', $2, 'regalo_admin')`,
        [id, tokens],
      );
    }

    if (tipo_cuenta) {
      const tiposValidos = ["developer", "tester", "empresa"];
      if (!tiposValidos.includes(tipo_cuenta)) {
        return res.status(400).json({ error: "Tipo de cuenta no válido" });
      }
      await db.query("UPDATE usuarios SET tipo_cuenta = $1 WHERE id = $2", [
        tipo_cuenta,
        id,
      ]);
    }

    res.json({ mensaje: "Usuario actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ==============================================
// FINANZAS
// ==============================================

// GET /api/admin/finanzas
exports.obtenerFinanzas = async (req, res) => {
  try {
    // Ingresos totales (compras de paquetes, suscripciones, etc.)
    // Como no tenemos una tabla de facturación real, mostramos estadísticas de tokens
    const stats = await db.query(`
      SELECT
        (SELECT COALESCE(SUM(cantidad), 0) FROM transacciones_token WHERE tipo = 'compra_paquete') AS tokens_vendidos,
        (SELECT COALESCE(SUM(cantidad), 0) FROM transacciones_token WHERE tipo = 'consumo') AS tokens_consumidos,
        (SELECT COUNT(*) FROM usuarios WHERE email_verificado = TRUE) AS usuarios_activos,
        (SELECT COUNT(*) FROM usuarios WHERE email_verificado = FALSE) AS usuarios_pendientes,
        (SELECT COALESCE(SUM(saldo_tokens), 0) FROM billeteras) AS tokens_en_circulacion,
        (SELECT COALESCE(SUM(deuda_tokens), 0) FROM billeteras) AS tokens_en_deuda
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    console.error("Error al obtener finanzas:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ==============================================
// PROMOCIONES
// ==============================================

// GET /api/admin/promociones
exports.listarPromociones = async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM promociones ORDER BY created_at DESC",
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error al listar promociones:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// POST /api/admin/promociones
exports.crearPromocion = async (req, res) => {
  try {
    const {
      titulo,
      descripcion,
      descuento_porcentaje,
      planes_aplica,
      fecha_inicio,
      fecha_fin,
    } = req.body;

    if (!titulo || !descuento_porcentaje || !fecha_inicio || !fecha_fin) {
      return res.status(400).json({ error: "Campos obligatorios faltantes" });
    }

    const result = await db.query(
      `INSERT INTO promociones (titulo, descripcion, descuento_porcentaje, planes_aplica, fecha_inicio, fecha_fin)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        titulo,
        descripcion || "",
        descuento_porcentaje,
        planes_aplica || [],
        fecha_inicio,
        fecha_fin,
      ],
    );

    res
      .status(201)
      .json({ mensaje: "Promoción creada", promocion: result.rows[0] });
  } catch (error) {
    console.error("Error al crear promoción:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// PUT /api/admin/promociones/:id
exports.actualizarPromocion = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      titulo,
      descripcion,
      descuento_porcentaje,
      planes_aplica,
      fecha_inicio,
      fecha_fin,
      activa,
    } = req.body;

    const result = await db.query(
      `UPDATE promociones SET
        titulo = COALESCE($1, titulo),
        descripcion = COALESCE($2, descripcion),
        descuento_porcentaje = COALESCE($3, descuento_porcentaje),
        planes_aplica = COALESCE($4, planes_aplica),
        fecha_inicio = COALESCE($5, fecha_inicio),
        fecha_fin = COALESCE($6, fecha_fin),
        activa = COALESCE($7, activa)
       WHERE id = $8 RETURNING *`,
      [
        titulo,
        descripcion,
        descuento_porcentaje,
        planes_aplica,
        fecha_inicio,
        fecha_fin,
        activa,
        id,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Promoción no encontrada" });
    }

    res.json({ mensaje: "Promoción actualizada", promocion: result.rows[0] });
  } catch (error) {
    console.error("Error al actualizar promoción:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// DELETE /api/admin/promociones/:id
exports.eliminarPromocion = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM promociones WHERE id = $1", [id]);
    res.json({ mensaje: "Promoción eliminada" });
  } catch (error) {
    console.error("Error al eliminar promoción:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// GET /api/admin/usuarios/:id/detalle
exports.obtenerDetalleUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await db.query(
      `SELECT u.username, u.email, u.nombre, u.apellido, u.dni, u.tipo_cuenta, u.email_verificado, u.activo, u.created_at,
              p.nombre AS plan, b.saldo_tokens, b.deuda_tokens,
              s.estado AS estado_suscripcion, s.fecha_inicio AS suscripcion_inicio,
              s.metodo_pago_tokenizado,
              (SELECT COUNT(*) FROM aplicaciones WHERE usuario_id = u.id) AS total_apps,
              (SELECT COUNT(*) FROM tarjetas WHERE usuario_id = u.id) AS total_tarjetas
       FROM usuarios u
       LEFT JOIN suscripciones s ON u.id = s.usuario_id AND s.estado = 'activa'
       LEFT JOIN planes p ON s.plan_id = p.id
       LEFT JOIN billeteras b ON u.id = b.usuario_id
       WHERE u.id = $1`,
      [id],
    );
    if (usuario.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const transacciones = await db.query(
      "SELECT tipo, cantidad, descripcion, saldo_resultante, created_at FROM transacciones_token WHERE usuario_id = $1 ORDER BY created_at DESC LIMIT 50",
      [id],
    );

    const resumenes = await db.query(
      "SELECT periodo, total_tokens_consumidos, pagado, created_at FROM resumenes_mensuales WHERE usuario_id = $1 ORDER BY periodo DESC LIMIT 12",
      [id],
    );

    res.json({
      ...usuario.rows[0],
      transacciones: transacciones.rows,
      resumenes: resumenes.rows,
    });
  } catch (error) {
    console.error("Error al obtener detalle de usuario:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// POST /api/admin/usuarios/:id/regalar-tokens
exports.regalarTokens = async (req, res) => {
  try {
    const { id } = req.params;
    const { password_admin, cantidad } = req.body;

    if (!password_admin || !cantidad) {
      return res.status(400).json({
        error:
          "Contraseña de administrador y cantidad de tokens son obligatorias.",
      });
    }

    const tokens = parseInt(cantidad, 10);
    if (isNaN(tokens) || tokens <= 0) {
      return res
        .status(400)
        .json({ error: "La cantidad debe ser un número positivo." });
    }

    // Validar contraseña del admin
    const adminId = req.user.id;
    const adminResult = await db.query(
      "SELECT password_hash FROM usuarios WHERE id = $1 AND rol = 'admin'",
      [adminId],
    );
    if (adminResult.rows.length === 0) {
      return res.status(403).json({ error: "Acción no permitida." });
    }

    const passwordValida = await bcrypt.compare(
      password_admin,
      adminResult.rows[0].password_hash,
    );
    if (!passwordValida) {
      return res
        .status(401)
        .json({ error: "Contraseña de administrador incorrecta." });
    }

    // Verificar que el usuario existe
    const usuario = await db.query("SELECT id FROM usuarios WHERE id = $1", [
      id,
    ]);
    if (usuario.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    // Límite diario por usuario: 100 tokens
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);
    const hoyFin = new Date();
    hoyFin.setHours(23, 59, 59, 999);

    const regalosHoyUsuario = await db.query(
      `SELECT COALESCE(SUM(cantidad), 0) AS total
       FROM transacciones_token
       WHERE usuario_id = $1 AND tipo = 'ajuste' AND origen = 'regalo_admin'
       AND created_at BETWEEN $2 AND $3`,
      [id, hoyInicio, hoyFin],
    );
    const totalHoyUsuario = parseInt(regalosHoyUsuario.rows[0].total, 10);
    if (totalHoyUsuario + tokens > 100) {
      return res.status(400).json({
        error: `Límite diario excedido. Ya se regalaron ${totalHoyUsuario} tokens a este usuario hoy (máximo 100).`,
      });
    }

    // Límite diario global: 5000 tokens
    const regalosHoyGlobal = await db.query(
      `SELECT COALESCE(SUM(cantidad), 0) AS total
       FROM transacciones_token
       WHERE tipo = 'ajuste' AND origen = 'regalo_admin'
       AND created_at BETWEEN $1 AND $2`,
      [hoyInicio, hoyFin],
    );
    const totalHoyGlobal = parseInt(regalosHoyGlobal.rows[0].total, 10);
    if (totalHoyGlobal + tokens > 5000) {
      return res.status(400).json({
        error: `Límite diario global excedido. Ya se regalaron ${totalHoyGlobal} tokens hoy (máximo 5000).`,
      });
    }

    // Acreditar tokens en billetera
    await db.query(
      `INSERT INTO billeteras (usuario_id, saldo_tokens)
       VALUES ($1, $2)
       ON CONFLICT (usuario_id) DO UPDATE SET saldo_tokens = billeteras.saldo_tokens + $2`,
      [id, tokens],
    );

    // Registrar transacción
    await db.query(
      `INSERT INTO transacciones_token (usuario_id, tipo, cantidad, descripcion, saldo_resultante, origen)
       VALUES ($1, 'ajuste', $2, 'Regalo de tokens por administrador', (SELECT saldo_tokens FROM billeteras WHERE usuario_id = $1), 'regalo_admin')`,
      [id, tokens],
    );

    res.json({ mensaje: `${tokens} tokens regalados exitosamente.` });
  } catch (error) {
    console.error("Error al regalar tokens:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

// DELETE /api/admin/usuarios/:id
exports.eliminarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { password_admin, username_confirmacion } = req.body;

    if (!password_admin || !username_confirmacion) {
      return res.status(400).json({
        error:
          "Contraseña de administrador y confirmación de usuario son obligatorias.",
      });
    }

    const adminId = req.user.id;
    const adminResult = await db.query(
      "SELECT password_hash FROM usuarios WHERE id = $1 AND rol = 'admin'",
      [adminId],
    );
    if (adminResult.rows.length === 0) {
      return res.status(403).json({ error: "Acción no permitida." });
    }

    const passwordValida = await bcrypt.compare(
      password_admin,
      adminResult.rows[0].password_hash,
    );
    if (!passwordValida) {
      return res
        .status(401)
        .json({ error: "Contraseña de administrador incorrecta." });
    }

    const usuarioResult = await db.query(
      "SELECT id, username, dni, nombre, apellido FROM usuarios WHERE id = $1",
      [id],
    );
    if (usuarioResult.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    if (usuarioResult.rows[0].username !== username_confirmacion) {
      return res
        .status(400)
        .json({ error: "El nombre de usuario de confirmación no coincide." });
    }

    const usuario = usuarioResult.rows[0];

    // Transferir tokens al fondo antes de eliminar
    const billetera = await db.query(
      "SELECT saldo_tokens FROM billeteras WHERE usuario_id = $1",
      [id],
    );
    const tokensATransferir =
      billetera.rows.length > 0 ? billetera.rows[0].saldo_tokens : 0;

    if (tokensATransferir > 0) {
      // Acreditar al fondo
      await db.query(
        "UPDATE fondo SET saldo_tokens = saldo_tokens + $1, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
        [tokensATransferir],
      );

      // Registrar movimiento
      const motivo = `Tokens transferidos desde la cuenta eliminada de ${usuario.username} (${usuario.nombre || ""} ${usuario.apellido || ""}).`;
      await db.query(
        `INSERT INTO fondo_movimientos (usuario_origen_id, usuario_origen_username, usuario_origen_dni, cantidad, motivo)
         VALUES ($1, $2, $3, $4, $5)`,
        [usuario.id, usuario.username, usuario.dni, tokensATransferir, motivo],
      );
    }

    // Eliminar usuario (las tablas relacionadas se eliminan por ON DELETE CASCADE)
    await db.query("DELETE FROM usuarios WHERE id = $1", [id]);

    res.json({
      mensaje: "Usuario eliminado correctamente. Tokens transferidos al fondo.",
      tokens_transferidos: tokensATransferir,
    });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

// GET /api/admin/fondo
exports.obtenerFondo = async (req, res) => {
  try {
    const fondo = await db.query(
      "SELECT saldo_tokens, invertido_tokens, gotas_acumuladas FROM fondo WHERE id = 1",
    );
    if (fondo.rows.length === 0) {
      return res.status(404).json({ error: "Fondo no encontrado." });
    }
    const { saldo_tokens, invertido_tokens, gotas_acumuladas } = fondo.rows[0];

    // Gota diaria (último registro)
    const ultimoGoteo = await db.query(
      "SELECT fecha, cantidad FROM fondo_goteo ORDER BY fecha DESC LIMIT 1",
    );
    const gota_diaria =
      ultimoGoteo.rows.length > 0 ? ultimoGoteo.rows[0] : null;

    // Movimientos recientes (últimos 50)
    const movimientos = await db.query(
      "SELECT fm.cantidad, fm.motivo, fm.created_at, fm.usuario_origen_username FROM fondo_movimientos fm ORDER BY fm.created_at DESC LIMIT 50",
    );

    res.json({
      saldo_tokens,
      invertido_tokens,
      gotas_acumuladas,
      gota_diaria,
      movimientos: movimientos.rows,
    });
  } catch (error) {
    console.error("Error al obtener fondo:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

// POST /api/admin/fondo/invertir
exports.invertirFondo = async (req, res) => {
  try {
    const { monto } = req.body;
    const tokens = parseInt(monto, 10);

    if (!tokens || tokens <= 0) {
      return res
        .status(400)
        .json({ error: "El monto a invertir debe ser un número positivo." });
    }

    const fondo = await db.query(
      "SELECT saldo_tokens, invertido_tokens FROM fondo WHERE id = 1 FOR UPDATE",
    );
    if (fondo.rows.length === 0) {
      return res.status(404).json({ error: "Fondo no encontrado." });
    }
    const { saldo_tokens, invertido_tokens } = fondo.rows[0];

    if (tokens > saldo_tokens) {
      return res.status(400).json({
        error: `No tenés suficientes tokens. Saldo disponible: ${saldo_tokens}`,
      });
    }

    // Validar horario: entre las 15:00 y las 23:59 (hora Argentina)
    const ahora = new Date();
    const horaArgentina = new Date(
      ahora.toLocaleString("en-US", {
        timeZone: "America/Argentina/Buenos_Aires",
      }),
    );
    const horas = horaArgentina.getHours();
    const minutos = horaArgentina.getMinutes();

    if (horas < 15) {
      return res.status(400).json({
        error: "Las inversiones están permitidas a partir de las 15:00.",
      });
    }
    if (horas >= 23 && minutos > 59) {
      return res.status(400).json({
        error: "Las inversiones deben realizarse antes de las 23:59.",
      });
    }

    // Actualizar saldo e inversión
    await db.query(
      "UPDATE fondo SET saldo_tokens = saldo_tokens - $1, invertido_tokens = invertido_tokens + $1, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
      [tokens],
    );

    // Registrar movimiento
    const motivo = `Inversión de ${tokens} tokens (tasa 40% anual).`;
    await db.query(
      `INSERT INTO fondo_movimientos (usuario_origen_id, usuario_origen_username, cantidad, motivo)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, req.user.username, tokens, motivo],
    );

    res.json({ mensaje: `Invertidos ${tokens} tokens correctamente.` });
  } catch (error) {
    console.error("Error al invertir en fondo:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

// GET /api/admin/fondo/buscar-movimiento?termino=xxx
exports.buscarMovimientoFondo = async (req, res) => {
  try {
    const { termino } = req.query;
    if (!termino) {
      return res.status(400).json({
        error: "Debe indicar un término de búsqueda (usuario o DNI).",
      });
    }

    const movimientos = await db.query(
      `SELECT fm.cantidad, fm.motivo, fm.created_at, fm.usuario_origen_username
       FROM fondo_movimientos fm
       WHERE fm.usuario_origen_username ILIKE $1 OR fm.usuario_origen_id::text ILIKE $1
       ORDER BY fm.created_at DESC
       LIMIT 50`,
      [`%${termino}%`],
    );

    res.json({ movimientos: movimientos.rows });
  } catch (error) {
    console.error("Error al buscar movimientos del fondo:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};
