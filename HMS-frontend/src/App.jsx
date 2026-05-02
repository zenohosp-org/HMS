import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { NotificationProvider } from "@/context/NotificationContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/layout/Layout";
import Login from "@/pages/Login";
import Unauthorized from "@/pages/Unauthorized";
import SsoCallback from "@/pages/SsoCallback";
import Dashboard from "@/pages/Dashboard";
import DoctorsList from "@/pages/admin/DoctorsList";
import DoctorDetails from "@/pages/admin/DoctorDetails";
import StaffsList from "@/pages/admin/StaffsList";
import Specializations from "@/pages/admin/Specializations";
import Services from "@/pages/admin/Services";
import Patients from "@/pages/patients/Patients";
import PatientDetails from "@/pages/patients/PatientDetails";
import Rooms from "@/pages/rooms/Rooms";
import RoomLogsPage from "@/pages/rooms/RoomLogsPage";
import Billing from "@/pages/billing/Billing";
import AppointmentsDashboard from "@/pages/appointments/AppointmentsDashboard";
import ShiftRoster from "@/pages/admin/ShiftRoster";
import Departments from "@/pages/admin/Departments";
import Designations from "@/pages/admin/Designations";
import Admissions from "@/pages/admin/Admissions";
import RadiologyQueue from "@/pages/radiology/RadiologyQueue";
import RadiologyReports from "@/pages/radiology/RadiologyReports";
import RadiologyReportView from "@/pages/radiology/RadiologyReportView";
import InfrastructureMapping from "@/pages/ipd/InfrastructureMapping"
import Settings from "@/pages/settings/Settings"
import AmbulanceBook from "@/pages/ambulance/AmbulanceBook"
import AmbulanceStatus from "@/pages/ambulance/AmbulanceStatus";
import PackageManager from "@/pages/checkups/PackageManager";
import CheckupBookings from "@/pages/checkups/CheckupBookings";
import CheckupBookingDetail from "@/pages/checkups/CheckupBookingDetail";
function App() {
  return <ErrorBoundary><ThemeProvider><AuthProvider><NotificationProvider><BrowserRouter><Routes>{
    /* Public */
  }<Route path="/login" element={<Login />} /><Route path="/unauthorized" element={<Unauthorized />} /><Route path="/sso/callback" element={<SsoCallback />} />{
    /* Protected — authenticated + hospital assigned */
  }<Route element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin", "doctor", "staff"]}><Layout /></ProtectedRoute>}><Route index element={<Navigate to="/dashboard" replace />} /><Route path="dashboard" element={<Dashboard />} /><Route path="patients" element={<Patients />} /><Route path="patients/:id" element={<PatientDetails />} /><Route path="settings" element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin"]}><Settings /></ProtectedRoute>} /><Route path="ipd/infrastructure" element={<Navigate to="/settings" replace />} /><Route path="ambulance/book" element={<AmbulanceBook />} /><Route path="ambulance/status" element={<AmbulanceStatus />} /><Route path="checkups/packages" element={<PackageManager />} /><Route path="checkups/bookings" element={<CheckupBookings />} /><Route path="checkups/bookings/:id" element={<CheckupBookingDetail />} /><Route path="rooms" element={<Rooms />} /><Route path="rooms/logs" element={<RoomLogsPage />} /><Route path="billing" element={<Billing />} /><Route path="appointments" element={<AppointmentsDashboard />} /><Route path="radiology" element={<RadiologyQueue />} /><Route path="radiology/reports" element={<RadiologyReports />} /><Route path="radiology/reports/:id" element={<RadiologyReportView />} /><Route path="doctors" element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin"]}><DoctorsList /></ProtectedRoute>} /><Route path="doctors/:id" element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin", "doctor"]}><DoctorDetails /></ProtectedRoute>} /><Route path="staffs" element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin"]}><StaffsList /></ProtectedRoute>} /><Route path="staffs/roster" element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin"]}><ShiftRoster /></ProtectedRoute>} /><Route path="staffs/departments" element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin"]}><Departments /></ProtectedRoute>} /><Route path="staffs/designations" element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin"]}><Designations /></ProtectedRoute>} /><Route path="admissions" element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin", "doctor", "staff"]}><Admissions /></ProtectedRoute>} /><Route path="specializations" element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin"]}><Specializations /></ProtectedRoute>} /><Route path="services" element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin"]}><Services /></ProtectedRoute>} /></Route>{
    /* Fallback */
  }<Route path="*" element={<Navigate to="/dashboard" replace />} /></Routes></BrowserRouter></NotificationProvider></AuthProvider></ThemeProvider></ErrorBoundary>;
}
export {
  App as default
};
