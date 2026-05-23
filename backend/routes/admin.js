// backend/routes/admin.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// All admin routes require authentication and admin role
router.use(protect);
router.use(authorize('sector_admin', 'district_admin', 'provincial_admin', 'national_admin'));

router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/businesses/pending', adminController.getPendingBusinesses);
router.get('/businesses/all', adminController.getAllBusinesses);
router.get('/tax-revenue', adminController.getTaxRevenue);
router.get('/compliance-reports', adminController.getComplianceReports);
router.get('/businesses/geographic', adminController.getBusinessesByGeography);
router.get('/reports/tax-collection', adminController.getTaxCollectionReport);
router.post('/businesses/:id/suspend', adminController.suspendBusiness);
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;