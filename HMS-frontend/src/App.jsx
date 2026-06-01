import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { ReferenceDataProvider } from "@/context/ReferenceDataContext";
import { FeatureFlagsProvider } from "@/context/FeatureFlagsContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/layout/Layout";
import FocusLayout from "@/components/layout/FocusLayout";
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
import OPDBilling from "./pages/billing/OPDBilling";
import IPDBilling from "./pages/billing/IPDBilling";
import AmbulanceBilling from "./pages/billing/AmbulanceBilling";
import AppointmentsDashboard from "@/pages/appointments/AppointmentsDashboard";
import ConsultationViewPage from "@/pages/appointments/ConsultationViewPage";
import PrintConsultation from "@/pages/print/PrintConsultation";
import ShiftRoster from "@/pages/admin/ShiftRoster";
import Departments from "@/pages/admin/Departments";
import Designations from "@/pages/admin/Designations";
import Admissions from "@/pages/admin/Admissions";
import RadiologyQueue from "@/pages/radiology/RadiologyQueue";
import RadiologyReports from "@/pages/radiology/RadiologyReports";
import RadiologyReportView from "@/pages/radiology/RadiologyReportView";
import InfrastructureMapping from "@/pages/ipd/InfrastructureMapping"
import Settings from "@/pages/settings/Settings"
import GeneralSettings from "@/pages/settings/GeneralSettings"
import PatientServices from "@/pages/settings/PatientServices"
import AmbulanceBook from "@/pages/ambulance/AmbulanceBook"
import AmbulanceStatus from "@/pages/ambulance/AmbulanceStatus";
import PackageManager from "@/pages/checkups/PackageManager";
import CheckupBookings from "@/pages/checkups/CheckupBookings";
import CheckupBookingDetail from "@/pages/checkups/CheckupBookingDetail";
function App() {
  return <ErrorBoundary><ThemeProvider><AuthProvider><FeatureFlagsProvider><NotificationProvider><ReferenceDataProvider><BrowserRouter><Routes>{
    /* Public */
  }<Route path="/login" element={<Login />} /><Route path="/unauthorized" element={<Unauthorized />} /><Route path="/sso/callback" element={<SsoCallback />} />{
    /* Protected — authenticated + hospital assigned */
  }<Route element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin", "doctor", "staff"]}><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          
          {/* Patients */}
          <Route path="patients" element={<Patients />} />
          <Route path="patients/:id" element={<PatientDetails />} />
          
          {/* Settings */}
          <Route path="settings" element={<Navigate to="/settings/general" replace />} />
          <Route path="settings/general" element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin"]}><GeneralSettings /></ProtectedRoute>} />
          <Route path="settings/infrastructure" element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin"]}><Settings /></ProtectedRoute>} />
          <Route path="settings/patient-services" element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin"]}><PatientServices /></ProtectedRoute>} />
          <Route path="ipd/infrastructure" element={<Navigate to="/settings/infrastructure" replace />} />
          
          {/* Ambulance */}
          <Route path="ambulance" element={<Navigate to="/ambulance/book" replace />} />
          <Route path="ambulance/book" element={<AmbulanceBook />} />
          <Route path="ambulance/status" element={<AmbulanceStatus />} />
          
          {/* Health Checkups */}
          <Route path="checkups/packages" element={<PackageManager />} />
          <Route path="checkups/bookings" element={<CheckupBookings />} />
          <Route path="checkups/bookings/:id" element={<CheckupBookingDetail />} />
          
          {/* Rooms */}
          <Route path="rooms" element={<Navigate to="/rooms/allocation" replace />} />
          <Route path="rooms/allocation" element={<Rooms />} />
          <Route path="rooms/logs" element={<RoomLogsPage />} />
          
          {/* Billing */}
          <Route path="billing" element={<Navigate to="/billing/opd" replace />} />
          <Route path="billing/opd" element={<OPDBilling />} />
          <Route path="billing/ipd" element={<IPDBilling />} />
          <Route path="billing/ambulance" element={<AmbulanceBilling />} />
          
          {/* Appointments */}
          <Route path="appointments" element={<AppointmentsDashboard />} />
          
          {/* Radiology */}
          <Route path="radiology" element={<Navigate to="/radiology/imaging-queue" replace />} />
          <Route path="radiology/imaging-queue" element={<RadiologyQueue />} />
          <Route path="radiology/imagin-queue" element={<RadiologyQueue />} />
          <Route path="radiology/reports" element={<RadiologyReports />} />
          <Route path="radiology/reports/:id" element={<RadiologyReportView />} />
          
          {/* Doctors */}
          <Route path="doctors" element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin"]}><DoctorsList /></ProtectedRoute>} />
          <Route path="doctors/:id" element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin", "doctor"]}><DoctorDetails /></ProtectedRoute>} />
          
          {/* Staffs / HR */}
          <Route path="staffs" element={<Navigate to="/staffs/directory" replace />} />
          <Route path="staffs/directory" element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin"]}><StaffsList /></ProtectedRoute>} />
          <Route path="staffs/roster" element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin"]}><ShiftRoster /></ProtectedRoute>} />
          <Route path="staffs/departments" element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin"]}><Departments /></ProtectedRoute>} />
          <Route path="staffs/designations" element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin"]}><Designations /></ProtectedRoute>} />
          
          {/* Admissions */}
          <Route path="admissions" element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin", "doctor", "staff"]}><Admissions /></ProtectedRoute>} />
          
          {/* Admin Metadata */}
          <Route path="specializations" element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin"]}><Specializations /></ProtectedRoute>} />
          <Route path="services" element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin"]}><Services /></ProtectedRoute>} />
        </Route>

        {/* Focus-mode routes — topbar persists, sidebar hidden so the
            workspace can take the full viewport width. Currently the
            doctor's queue-walked Consultation View; future workflows
            (OT case viewer, ward round) can hang off the same shell. */}
        <Route element={<ProtectedRoute allowedRoles={["super_admin", "hospital_admin", "doctor", "staff"]}><FocusLayout /></ProtectedRoute>}>
          <Route path="consultation-view" element={<ConsultationViewPage />} />
        </Route>

        {/* Print routes — no chrome at all so the rendered page IS the
            printable artefact. ProtectedRoute still wraps so an
            unauthenticated user can't fetch someone else's record by
            URL-stuffing. */}
        <Route
          path="/print/appointment/:appointmentId"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "hospital_admin", "doctor", "staff"]}>
              <PrintConsultation />
            </ProtectedRoute>
          }
        />
        {
    /* Fallback */
  }<Route path="*" element={<Navigate to="/dashboard" replace />} /></Routes></BrowserRouter></ReferenceDataProvider></NotificationProvider></FeatureFlagsProvider></AuthProvider></ThemeProvider></ErrorBoundary>;
}
export {
  App as default
};
