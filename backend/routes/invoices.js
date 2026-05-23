// backend/routes/invoices.js
const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', invoiceController.getInvoices);
router.get('/:invoiceNumber', invoiceController.getInvoiceByNumber);
router.post('/:saleId/generate', invoiceController.generateInvoice);
router.get('/download/:invoiceNumber', invoiceController.downloadInvoice);
router.post('/:invoiceNumber/send', invoiceController.sendInvoiceEmail);
router.get('/stats/summary', invoiceController.getInvoiceStats);

module.exports = router;