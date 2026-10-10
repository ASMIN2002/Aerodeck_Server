const express = require("express");
const router = express.Router();

const userInvoiceController = require("../../controllers/user/userInvoiceController");

/* ============================================
   CREATE INVOICE
   ============================================ */
router.post(
    "/create",
    userInvoiceController.createInvoice
);

/* ============================================
   GET ALL INVOICES
   ============================================ */
router.get(
    "/all",
    userInvoiceController.getAllInvoices
);

/* ============================================
   MARK GENERATED
   ============================================ */
router.put(
    "/mark-generated/:invoice_id",
    userInvoiceController.markGenerated
);

/* ============================================
   TOGGLE SAVED
   ============================================ */
router.put(
    "/toggle-saved/:invoice_id",
    userInvoiceController.toggleSaved
);

/* ============================================
   GET INVOICES BY ADMIN
   ============================================ */
router.get(
    "/admin/:admin_id",
    userInvoiceController.getInvoicesByAdmin
);

/* ============================================
   GET SINGLE INVOICE
   ============================================ */
router.get(
    "/single/:invoice_id",
    userInvoiceController.getInvoiceById
);

module.exports = router;