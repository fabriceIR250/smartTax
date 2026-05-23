// backend/controllers/saleController.js
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Business = require('../models/Business');
const TaxTransaction = require('../models/TaxTransaction');
const SyncQueue = require('../models/SyncQueue');

const generateInvoiceNumber = () => {
  return `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
};

exports.createSale = async (req, res) => {
  try {
    const { items, paymentMethod, customerInfo } = req.body;
    const businessId = req.user.businessId;

    let subtotal = 0;
    let taxAmount = 0;
    const processedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ message: `Product ${item.productId} not found` });
      }

      const itemSubtotal = product.price * item.quantity;
      const itemTax = itemSubtotal * (product.taxRate / 100);
      
      subtotal += itemSubtotal;
      taxAmount += itemTax;

      processedItems.push({
        productId: product._id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        subtotal: itemSubtotal,
        taxRate: product.taxRate,
        taxAmount: itemTax,
        total: itemSubtotal + itemTax
      });

      // Update inventory
      product.quantity -= item.quantity;
      await product.save();
    }

    const totalAmount = subtotal + taxAmount;
    const paymentStatus = paymentMethod === 'cash' ? 'pending_tax' : 'paid';
    const taxStatus = paymentMethod === 'cash' ? 'pending' : 'paid';

    const sale = new Sale({
      businessId,
      invoiceNumber: generateInvoiceNumber(),
      items: processedItems,
      subtotal,
      taxAmount,
      totalAmount,
      paymentMethod,
      paymentStatus,
      taxStatus,
      customerName: customerInfo?.name,
      customerPhone: customerInfo?.phone,
      customerEmail: customerInfo?.email,
      saleDate: new Date()
    });

    await sale.save();

    // Create tax transaction if payment is cash
    if (paymentMethod === 'cash') {
      const taxTransaction = new TaxTransaction({
        businessId,
        saleId: sale._id,
        amount: taxAmount,
        type: 'vat',
        status: 'pending',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days due
      });
      await taxTransaction.save();

      // Update business pending tax
      await Business.findByIdAndUpdate(businessId, {
        $inc: { totalPendingTax: taxAmount }
      });
    }

    res.status(201).json({
      message: 'Sale created successfully',
      sale,
      taxAmount,
      taxStatus
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getSales = async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    const query = { businessId: req.user.businessId };

    if (startDate || endDate) {
      query.saleDate = {};
      if (startDate) query.saleDate.$gte = new Date(startDate);
      if (endDate) query.saleDate.$lte = new Date(endDate);
    }
    if (status) query.paymentStatus = status;

    const sales = await Sale.find(query)
      .sort({ saleDate: -1 })
      .limit(parseInt(req.query.limit) || 100);

    const total = await Sale.countDocuments(query);
    const totalRevenue = await Sale.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    res.json({
      sales,
      total,
      totalRevenue: totalRevenue[0]?.total || 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findOne({
      _id: req.params.id,
      businessId: req.user.businessId
    });
    
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }
    
    res.json(sale);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getTodaySummary = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const sales = await Sale.find({
      businessId: req.user.businessId,
      saleDate: { $gte: today, $lt: tomorrow }
    });
    
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalSales = sales.length;
    const totalTax = sales.reduce((sum, sale) => sum + sale.taxAmount, 0);
    
    res.json({
      totalRevenue,
      totalSales,
      totalTax,
      sales
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMonthlyReport = async (req, res) => {
  try {
    const { year, month } = req.query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const report = await Sale.aggregate([
      {
        $match: {
          businessId: req.user.businessId,
          saleDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dayOfMonth: '$saleDate' },
          totalRevenue: { $sum: '$totalAmount' },
          totalTax: { $sum: '$taxAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json(report);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.syncOfflineSales = async (req, res) => {
  try {
    const { offlineSales } = req.body;
    const results = [];
    
    for (const sale of offlineSales) {
      try {
        const newSale = new Sale({
          ...sale,
          businessId: req.user.businessId,
          isSynced: true,
          syncedAt: new Date()
        });
        await newSale.save();
        results.push({ success: true, id: sale._id });
      } catch (error) {
        results.push({ success: false, id: sale._id, error: error.message });
      }
    }
    
    res.json({ message: 'Sync completed', results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getPendingSyncSales = async (req, res) => {
  try {
    const pendingSales = await Sale.find({
      businessId: req.user.businessId,
      isSynced: false
    });
    
    res.json(pendingSales);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};