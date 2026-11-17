import React from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Public / Applicant & QR Verification pages
import ApplicantSubmitPage from './pages/ApplicantSubmitPage';
import ApplicantSuccessPage from './pages/ApplicantSuccessPage';
import TrackStatusPage from './pages/TrackStatusPage';
import VerifyPage from './pages/VerifyPage';

// Staff Login & Officer Workspace
import LoginPage from './pages/LoginPage';
import OfficerRequestsPage from './pages/OfficerRequestsPage';
import OfficerRequestDetailPage from './pages/OfficerRequestDetailPage';
import OfficerTemplatesPage from './pages/OfficerTemplatesPage';

// Admin Management Workspace
import AdminUsersPage from './pages/AdminUsersPage';
import AdminCatalogPage from './pages/AdminCatalogPage';
import AdminTemplatesPage from './pages/AdminTemplatesPage';
import AdminReportsPage from './pages/AdminReportsPage';

function NotFoundPage() {
  return (
    <div className="container section-gap narrow-container">
      <div className="card empty-state">
        <h1 className="page-title">صفحه مورد نظر یافت نشد (۴۰۴)</h1>
        <p className="text-muted mt-2">
          آدرس واردشده در سیستم درخواست و چاپ تصدیق‌نامه پوهنتون کندز موجود نمی‌باشد.
        </p>
        <div className="action-row-center mt-4">
          <Link to="/" className="btn btn-primary">
            صفحه ثبت درخواست
          </Link>
          <Link to="/track" className="btn btn-secondary">
            پیگیری درخواست
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Layout>
            <Routes>
              {/* Applicant & Public Routes */}
              <Route path="/" element={<ApplicantSubmitPage />} />
              <Route path="/request-success/:code" element={<ApplicantSuccessPage />} />
              <Route path="/track" element={<TrackStatusPage />} />
              <Route path="/track/:code" element={<TrackStatusPage />} />
              <Route path="/verify" element={<VerifyPage />} />
              <Route path="/verify/:serial" element={<VerifyPage />} />

              {/* Staff Login */}
              <Route path="/login" element={<LoginPage />} />

              {/* Officer & Admin Routes */}
              <Route path="/officer" element={<Navigate to="/officer/requests" replace />} />
              <Route
                path="/officer/requests"
                element={
                  <ProtectedRoute roles={['officer', 'admin']}>
                    <OfficerRequestsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/officer/requests/:id"
                element={
                  <ProtectedRoute roles={['officer', 'admin']}>
                    <OfficerRequestDetailPage defaultTab="details" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/officer/requests/:id/edit"
                element={
                  <ProtectedRoute roles={['officer', 'admin']}>
                    <OfficerRequestDetailPage defaultTab="editor" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/officer/requests/:id/templates"
                element={
                  <ProtectedRoute roles={['officer', 'admin']}>
                    <OfficerRequestDetailPage defaultTab="templates" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/officer/templates"
                element={
                  <ProtectedRoute roles={['officer', 'admin']}>
                    <OfficerTemplatesPage />
                  </ProtectedRoute>
                }
              />

              {/* Admin-Only Routes */}
              <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminUsersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/catalog"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminCatalogPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/admin/faculties" element={<Navigate to="/admin/catalog" replace />} />
              <Route path="/admin/departments" element={<Navigate to="/admin/catalog" replace />} />
              <Route
                path="/admin/templates"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminTemplatesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/reports"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminReportsPage />
                  </ProtectedRoute>
                }
              />

              {/* Fallback 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Layout>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
