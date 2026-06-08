import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { ReferenceDataProvider } from "@/context/ReferenceDataContext";
import { FeatureFlagsProvider } from "@/context/FeatureFlagsContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/layout/Layout";
import FocusLayout from "@/components/layout/FocusLayout";
import { lazy, Suspense } from "react";
import Login from "@/pages/Login";
import Unauthorized from "@/pages/Unauthorized";
import SsoCallback from "@/pages/SsoCallback";
import { GlobalLoader } from "@/components/ui";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const DoctorsList = lazy(() => import("@/pages/admin/DoctorsList"));
const DoctorDetails = lazy(() => import("@/pages/admin/DoctorDetails"));
const StaffsList = lazy(() => import("@/pages/admin/StaffsList"));
const Specializations = lazy(() => import("@/pages/admin/Specializations"));
const Services = lazy(() => import("@/pages/admin/Services"));
const Patients = lazy(() => import("@/pages/patients/Patients"));
const PatientDetails = lazy(() => import("@/pages/patients/PatientDetails"));
const Rooms = lazy(() => import("@/pages/rooms/Rooms"));
const RoomLogsPage = lazy(() => import("@/pages/rooms/RoomLogsPage"));
const OPDBilling = lazy(() => import("./pages/billing/OPDBilling"));
const IPDBilling = lazy(() => import("./pages/billing/IPDBilling"));
const AmbulanceBilling = lazy(() => import("./pages/billing/AmbulanceBilling"));
const AppointmentsDashboard = lazy(() => import("@/pages/appointments/AppointmentsDashboard"));
const ConsultationViewPage = lazy(() => import("@/pages/appointments/ConsultationViewPage"));
const PrintConsultation = lazy(() => import("@/pages/print/PrintConsultation"));
const PrintDischargeSummary = lazy(() => import("@/pages/print/PrintDischargeSummary"));
const ShiftRoster = lazy(() => import("@/pages/admin/ShiftRoster"));
const Departments = lazy(() => import("@/pages/admin/Departments"));
const Designations = lazy(() => import("@/pages/admin/Designations"));
const Admissions = lazy(() => import("@/pages/admin/Admissions"));
const RadiologyQueue = lazy(() => import("@/pages/radiology/RadiologyQueue"));
const RadiologyReports = lazy(() => import("@/pages/radiology/RadiologyReports"));
const RadiologyReportView = lazy(() => import("@/pages/radiology/RadiologyReportView"));
const InfrastructureMapping = lazy(() => import("@/pages/ipd/InfrastructureMapping"));
const Settings = lazy(() => import("@/pages/settings/Settings"));
const GeneralSettings = lazy(() => import("@/pages/settings/GeneralSettings"));
const PatientServices = lazy(() => import("@/pages/settings/PatientServices"));
const AmbulanceBook = lazy(() => import("@/pages/ambulance/AmbulanceBook"));
const AmbulanceStatus = lazy(() => import("@/pages/ambulance/AmbulanceStatus"));
const PackageManager = lazy(() => import("@/pages/checkups/PackageManager"));
const CheckupBookings = lazy(() => import("@/pages/checkups/CheckupBookings"));
const CheckupBookingDetail = lazy(() => import("@/pages/checkups/CheckupBookingDetail"));
const UiGallery = lazy(() => import("@/pages/dev/UiGallery"));
function App() {
 return <ErrorBoundary><AuthProvider><FeatureFlagsProvider><NotificationProvider><ReferenceDataProvider><BrowserRouter><Suspense fallback={<GlobalLoader />}><Routes>{
 /* Public */
 }<Route path="/login" element={<Login />} /><Route path="/unauthorized" element={<Unauthorized />} /><Route path="/sso/callback" element={<SsoCallback />} />{
 /* Dev-only — design-system gallery. Not gated by auth so it
 loads even when the backend is unreachable. Stripped from
 production builds via import.meta.env.DEV. */
 }{import.meta.env.DEV && <Route path="/dev/ui-gallery" element={<UiGallery />} />}{
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
 <Route
 path="/print/admission/:admissionId/discharge-summary"
 element={
 <ProtectedRoute allowedRoles={["super_admin", "hospital_admin", "doctor", "staff"]}>
 <PrintDischargeSummary />
 </ProtectedRoute>
 }
 />
 {
 /* Fallback */
 }<Route path="*" element={<Navigate to="/dashboard" replace />} /></Routes></Suspense></BrowserRouter></ReferenceDataProvider></NotificationProvider></FeatureFlagsProvider></AuthProvider></ErrorBoundary>;
}
export {
 App as default
};
