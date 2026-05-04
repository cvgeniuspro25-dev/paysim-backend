// backend/src/routes/admin.js
const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const {
  verificarToken,
  verificarAdmin,
} = require("../middleware/authMiddleware");

router.use(verificarToken);
router.use(verificarAdmin);

router.get("/perfil", adminController.obtenerPerfil);
router.put("/perfil", adminController.actualizarPerfil);
router.post("/cambiar-password", adminController.cambiarPassword);
router.post("/subir-foto", adminController.subirFoto);

router.get("/usuarios", adminController.listarUsuarios);
router.get("/usuarios/:id", adminController.obtenerUsuario);
router.put("/usuarios/:id", adminController.actualizarUsuario);

router.get("/finanzas", adminController.obtenerFinanzas);

router.get("/promociones", adminController.listarPromociones);
router.post("/promociones", adminController.crearPromocion);
router.put("/promociones/:id", adminController.actualizarPromocion);
router.delete("/promociones/:id", adminController.eliminarPromocion);

module.exports = router;
