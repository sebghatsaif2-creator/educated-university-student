import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ roles = ['officer', 'admin'], children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page-loader" role="status">
        <div className="spinner" />
        <span>در حال بررسی دسترسی کاربری...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (roles.length > 0 && !roles.includes(user.role)) {
    return (
      <div className="container section-gap">
        <div className="card empty-state">
          <h2>عدم دسترسی به این بخش</h2>
          <p className="text-muted">
            حساب کاربری شما صلاحیت مشاهده این صفحه را ندارد. این بخش ویژه مدیر سیستم می‌باشد.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
