// src/components/Layout/Layout.jsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';

const Layout = () => {
  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <Header />
      <main className="px-4 mx-auto max-w-md">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

export default Layout;