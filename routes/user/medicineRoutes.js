const express = require("express");
const router = express.Router();

const {
    getMedicines,
    getMedicineById,
    addMedicine,
    updateMedicine,
    deleteMedicine,
} = require("../../controllers/user/medicineController");

router.get("/", getMedicines);
router.get("/:id", getMedicineById);
router.post("/", addMedicine);
router.put("/:id", updateMedicine);
router.delete("/:id", deleteMedicine);

module.exports = router;