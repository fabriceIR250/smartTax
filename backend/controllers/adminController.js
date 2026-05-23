// backend/controllers/adminController.js
const User = require('../models/User');
const Business = require('../models/Business');
const Sale = require('../models/Sale');
const TaxTransaction = require('../models/TaxTransaction');
const AuditLog = require('../models/AuditLog');

exports.getDashboardStats = async (req, res) => {
  try {
    let query = {};
    
    // Apply geographic restrictions
    if (req.user.role === 'sector_admin') {
      query['address.sector'] = req.user.sector;
    } else if (req.user.role === 'district_admin') {
      query['address.district'] = req.user.district;
    } else if (req.user.role === 'provincial_admin') {
      query['address.province'] = req.user.province;
    }
    
    const [totalBusinesses, totalSales, totalTaxCollected, pendingBusinesses] = await Promise.all([
      Business.countDocuments(query),
      Sale.countDocuments(),
      TaxTransaction.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Business.countDocuments({ ...query, status: 'pending' })
    ]);
    
    res.json({
      totalBusinesses,
      totalSales,
      totalTaxCollected: totalTaxCollected[0]?.total || 0,
      pendingBusinesses
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getPendingBusinesses = async (req, res) => {
  try {
    let query = { status: 'pending' };
    
    if (req.user.role === 'sector_admin') {
      query['address.sector'] = req.user.sector;
    } else if (req.user.role === 'district_admin') {
      query['address.district'] = req.user.district;
    } else if (req.user.role === 'provincial_admin') {
      query['address.province'] = req.user.province;
    }
    
    const businesses = await Business.find(query)
      .populate('ownerId', 'fullName email phoneNumber')
      .sort({ createdAt: 1 });
    
    res.json(businesses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAllBusinesses = async (req, res) => {
  try {
    let query = {};
    
    if (req.user.role === 'sector_admin') {
      query['address.sector'] = req.user.sector;
    } else if (req.user.role === 'district_admin') {
      query['address.district'] = req.user.district;
    } else if (req.user.role === 'provincial_admin') {
      query['address.province'] = req.user.province;
    }
    
    const businesses = await Business.find(query)
      .populate('ownerId', 'fullName email phoneNumber')
      .sort({ createdAt: -1 });
    
    res.json(businesses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getTaxRevenue = async (req, res) => {
  try {
    const revenue = await TaxTransaction.aggregate([
      {
        $match: { status: 'paid' }
      },
      {
        $group: {
          _id: {
            year: { $year: '$paidAt' },
            month: { $month: '$paidAt' }
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);
    
    res.json(revenue);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getComplianceReports = async (req, res) => {
  try {
    const reports = await Business.aggregate([
      {
        $lookup: {
          from: 'taxtransactions',
          localField: '_id',
          foreignField: 'businessId',
          as: 'taxes'
        }
      },
      {
        $project: {
          name: 1,
          registrationNumber: 1,
          totalTaxDue: { $sum: '$taxes.amount' },
          totalTaxPaid: {
            $sum: {
              $cond: [{ $eq: ['$taxes.status', 'paid'] }, '$taxes.amount', 0]
            }
          },
          complianceRate: {
            $multiply: [
              {
                $divide: [
                  {
                    $sum: {
                      $cond: [{ $eq: ['$taxes.status', 'paid'] }, '$taxes.amount', 0]
                    }
                  },
                  { $sum: '$taxes.amount' }
                ]
              },
              100
            ]
          }
        }
      }
    ]);
    
    res.json(reports);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getBusinessesByGeography = async (req, res) => {
  try {
    const geography = await Business.aggregate([
      {
        $group: {
          _id: {
            province: '$address.province',
            district: '$address.district',
            sector: '$address.sector'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.province': 1, '_id.district': 1, '_id.sector': 1 } }
    ]);
    
    res.json(geography);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getTaxCollectionReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const report = await TaxTransaction.aggregate([
      {
        $match: {
          paidAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          },
          status: 'paid'
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
            paymentMethod: '$paymentMethod'
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);
    
    res.json(report);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.suspendBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }
    
    business.status = 'suspended';
    await business.save();
    
    // Log action
    const auditLog = new AuditLog({
      userId: req.user.id,
      action: 'SUSPEND_BUSINESS',
      targetType: 'Business',
      targetId: business._id,
      details: { reason: req.body.reason },
      ipAddress: req.ip
    });
    await auditLog.save();
    
    res.json({ message: 'Business suspended successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .populate('userId', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};