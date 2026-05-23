// src/pages/admin/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Users, DollarSign, CheckCircle, TrendingUp, MapPin } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const AdminDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    totalBusinesses: 0,
    totalSales: 0,
    totalTaxCollected: 0,
    pendingBusinesses: 0
  });
  const [revenueData, setRevenueData] = useState([]);
  const [pendingBusinesses, setPendingBusinesses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const [statsRes, revenueRes, pendingRes] = await Promise.all([
        api.get('/admin/dashboard/stats'),
        api.get('/admin/reports/tax-collection'),
        api.get('/admin/businesses/pending')
      ]);
      
      setStats(statsRes.data);
      setRevenueData(revenueRes.data);
      setPendingBusinesses(pendingRes.data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const approveBusiness = async (businessId) => {
    try {
      await api.post(`/admin/businesses/${businessId}/approve`);
      fetchAdminData();
      alert('Business approved successfully');
    } catch (error) {
      console.error('Error approving business:', error);
      alert('Failed to approve business');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="py-4 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
        <p className="text-gray-600 text-sm mt-1">
          {user?.role === 'national_admin' ? 'National Overview' :
           user?.role === 'provincial_admin' ? 'Provincial Overview' :
           user?.role === 'district_admin' ? 'District Overview' : 'Sector Overview'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <Building2 className="w-5 h-5 text-blue-500" />
            <span className="text-xl font-bold">{stats.totalBusinesses}</span>
          </div>
          <p className="text-sm text-gray-600">Total Businesses</p>
        </div>
        
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-5 h-5 text-green-500" />
            <span className="text-xl font-bold">RWF {stats.totalTaxCollected?.toLocaleString()}</span>
          </div>
          <p className="text-sm text-gray-600">Tax Collected</p>
        </div>
        
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-5 h-5 text-purple-500" />
            <span className="text-xl font-bold">{stats.totalSales}</span>
          </div>
          <p className="text-sm text-gray-600">Total Sales</p>
        </div>
        
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-5 h-5 text-yellow-500" />
            <span className="text-xl font-bold">{stats.pendingBusinesses}</span>
          </div>
          <p className="text-sm text-gray-600">Pending Approvals</p>
        </div>
      </div>

      {/* Revenue Chart */}
      {revenueData.length > 0 && (
        <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3">Tax Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="_id.date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pending Businesses */}
      {pendingBusinesses.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-800">Pending Business Approvals</h3>
          </div>
          <div className="divide-y">
            {pendingBusinesses.map((business) => (
              <div key={business._id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-gray-800">{business.name}</p>
                    <p className="text-xs text-gray-500">TIN: {business.taxIdentificationNumber}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {business.address?.sector}, {business.address?.district}
                    </p>
                  </div>
                  <button
                    onClick={() => approveBusiness(business._id)}
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;