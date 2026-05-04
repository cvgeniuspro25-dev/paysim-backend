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

    let query = `
      SELECT u.id, u.username, u.nombre, u.apellido, u.dni, u.tipo_cuenta, u.email_verificado, u.activo,
             p.nombre AS plan, b.saldo_tokens, b.deuda_tokens,
             CASE 
               WHEN s.estado = 'impaga' AND s.fecha_fin < NOW() THEN true
               ELSE false
             END AS en_deuda
      FROM usuarios u
      LEFT JOIN suscripciones s ON u.id = s.usuario_id AND s.estado = 'activa'
      LEFT JOIN planes p ON s.plan_id = p.id
      LEFT JOIN billeteras b ON u.id = b.usuario_id
      WHERE u.rol != 'admin'
    `;

    const params = [];
    let paramIndex = 1;

    if (busqueda) {
      query += ` AND (u.apellido ILIKE $${paramIndex} OR u.username ILIKE $${paramIndex} OR u.dni ILIKE $${paramIndex})`;
      params.push(`%${busqueda}%`);
      paramIndex++;
    }

    if (estado) {
      query += ` AND u.email_verificado = $${paramIndex}`;
      params.push(estado === "activado");
      paramIndex++;
    }

    if (plan) {
      query += ` AND LOWER(p.nombre) = LOWER($${paramIndex})`;
      params.push(plan);
      paramIndex++;
    }

    if (tipo_cuenta) {
      query += ` AND u.tipo_cuenta = $${paramIndex}`;
      params.push(tipo_cuenta);
      paramIndex++;
    }

    if (activo !== undefined) {
      query += ` AND u.activo = $${paramIndex}`;
      params.push(activo === "true");
      paramIndex++;
    }

    if (deuda !== undefined) {
      if (deuda === "true") {
        query += ` AND s.estado = 'impaga' AND s.fecha_fin < NOW()`;
      } else {
        query += ` AND (s.estado IS NULL OR s.estado != 'impaga' OR s.fecha_fin >= NOW())`;
      }
    }

    query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
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
      const planData = cerebro.planes[cambiar_plan.toLowerCase()];
      if (!planData) {
        return res.status(400).json({ error: "Plan no válido" });
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
