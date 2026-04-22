import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { NotificationProvider } from '@/context/NotificationContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import Layout from '@/components/layout/Layout'
import Login from '@/pages/Login'
import Unauthorized from '@/pages/Unauthorized'
import SsoCallback from '@/pages/SsoCallback'
import Dashboard from '@/pages/Dashboard'
import DoctorsList from '@/pages/admin/DoctorsList'
import DoctorDetails from '@/pages/admin/DoctorDetails'
import StaffsList from '@/pages/admin/StaffsList'
import Specializations from '@/pages/admin/Specializations'
import Services from '@/pages/admin/Services'
import Patients from '@/pages/patients/Patients'
import PatientDetails from '@/pages/patients/PatientDetails'
import Rooms from '@/pages/rooms/Rooms'
import RoomLogsPage from '@/pages/rooms/RoomLogsPage'
import CreateInvoice from '@/pages/billing/CreateInvoice'
import InvoiceList from '@/pages/billing/InvoiceList'
import AppointmentsDashboard from '@/pages/appointments/AppointmentsDashboard'
import ShiftRoster from '@/pages/admin/ShiftRoster'
import Payroll from '@/pages/admin/Payroll'

export default function App() {
    return (
        <ErrorBoundary>
            <ThemeProvider>
                <AuthProvider>
                    <NotificationProvider>
                        <BrowserRouter>
                            <Routes>
                                {/* Public */}
                                <Route path="/login" element={<Login />} />
                                <Route path="/unauthorized" element={<Unauthorized />} />
                                <Route path="/sso/callback" element={<SsoCallback />} />

                                {/* Protected — authenticated + hospital assigned */}
                                <Route element={
                                    <ProtectedRoute allowedRoles={['super_admin', 'hospital_admin', 'doctor', 'staff']}>
                                        <Layout />
                                    </ProtectedRoute>
                                }>
                                    <Route index element={<Navigate to="/dashboard" replace />} />
                                    <Route path="dashboard" element={<Dashboard />} />
                                    <Route path="patients" element={<Patients />} />
                                    <Route path="patients/:id" element={<PatientDetails />} />
                                    <Route path="rooms" element={<Rooms />} />
                                    <Route path="rooms/logs" element={<RoomLogsPage />} />
                                    <Route path="billing" element={<CreateInvoice />} />
                                    <Route path="billing/invoices" element={
                                        <ProtectedRoute allowedRoles={['super_admin', 'hospital_admin']}>
                                            <InvoiceList />
                                        </ProtectedRoute>
                                    } />
                                    <Route path="appointments" element={<AppointmentsDashboard />} />

                                    <Route path="doctors" element={
                                        <ProtectedRoute allowedRoles={['super_admin', 'hospital_admin']}>
                                            <DoctorsList />
                                        </ProtectedRoute>
                                    } />
                                    <Route path="doctors/:id" element={
                                        <ProtectedRoute allowedRoles={['super_admin', 'hospital_admin', 'doctor']}>
                                            <DoctorDetails />
                                        </ProtectedRoute>
                                    } />
                                    <Route path="staffs" element={
                                        <ProtectedRoute allowedRoles={['super_admin', 'hospital_admin']}>
                                            <StaffsList />
                                        </ProtectedRoute>
                                    } />
                                    <Route path="staffs/roster" element={
                                        <ProtectedRoute allowedRoles={['super_admin', 'hospital_admin']}>
                                            <ShiftRoster />
                                        </ProtectedRoute>
                                    } />
                                    <Route path="staffs/payroll" element={
                                        <ProtectedRoute allowedRoles={['super_admin', 'hospital_admin']}>
                                            <Payroll />
                                        </ProtectedRoute>
                                    } />
                                    <Route path="specializations" element={
                                        <ProtectedRoute allowedRoles={['super_admin', 'hospital_admin']}>
                                            <Specializations />
                                        </ProtectedRoute>
                                    } />
                                    <Route path="services" element={
                                        <ProtectedRoute allowedRoles={['super_admin', 'hospital_admin']}>
                                            <Services />
                                        </ProtectedRoute>
                                    } />
                                </Route>

                                {/* Fallback */}
                                <Route path="*" element={<Navigate to="/dashboard" replace />} />
                            </Routes>
                        </BrowserRouter>
                    </NotificationProvider>
                </AuthProvider>
            </ThemeProvider>
        </ErrorBoundary>
    )
}
