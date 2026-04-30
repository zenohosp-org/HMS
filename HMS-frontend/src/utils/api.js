import axios from "axios";
const DIRECTORY_API_URL = "https://api-directory.zenohosp.com";
const api = axios.create({
  baseURL: (() => {
    const rawUrl = import.meta.env.VITE_API_URL || "";
    if (!rawUrl || rawUrl === "/api") return "/api";
    const baseUrl = rawUrl.replace(/\/$/, "");
    return baseUrl.endsWith("/api") ? baseUrl : `${baseUrl}/api`;
  })(),
  headers: { "Content-Type": "application/json" },
  withCredentials: true
  // Automatically send/receive HttpOnly cookies
});
if (import.meta.env.VITE_DEV_MOCK_AUTH === 'true' && import.meta.env.VITE_MOCK_JWT) {
  api.interceptors.request.use((config) => {
    config.headers.Authorization = `Bearer ${import.meta.env.VITE_MOCK_JWT}`;
    return config;
  });
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      if (!err.config?.url?.includes("/auth/me")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);
const authApi = {
  login: async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    return data;
  },
  register: async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    return data;
  },
  me: async () => {
    const { data } = await api.get("/auth/me");
    return data;
  }
};
const directoryLogout = () => axios.post(`${DIRECTORY_API_URL}/api/auth/logout`, {}, { withCredentials: true });
const patientApi = {
  list: async (hospitalId) => {
    const { data } = await api.get(`/patients?hospitalId=${hospitalId}`);
    return data;
  },
  get: async (id, hospitalId) => {
    const { data } = await api.get(`/patients/${id}?hospitalId=${hospitalId}`);
    return data;
  },
  create: async (payload) => {
    const { data } = await api.post("/patients", payload);
    return data;
  },
  update: async (id, payload) => {
    const { data } = await api.put(`/patients/${id}`, payload);
    return data;
  },
  delete: (id) => api.delete(`/patients/${id}`),
  search: async (hospitalId, q) => {
    const res = await api.get("/patients/search", { params: { hospitalId, q } });
    return res.data;
  }
};
const recordApi = {
  list: async (patientId, hospitalId) => {
    const { data } = await api.get(`/records/patient/${patientId}?hospitalId=${hospitalId}`);
    return data;
  },
  create: async (payload) => {
    const { data } = await api.post("/records", payload);
    return data;
  }
};
const staffApi = {
  list: async (hospitalId) => {
    const { data } = await api.get(`/users?hospitalId=${hospitalId}`);
    return data;
  },
  get: async (id) => {
    const { data } = await api.get(`/users/${id}`);
    return data;
  },
  create: async (payload) => {
    const { data } = await api.post("/users", payload);
    return data;
  },
  update: async (id, payload) => {
    const { data } = await api.put(`/users/${id}`, payload);
    return data;
  },
  deactivate: async (id) => {
    await api.patch(`/users/${id}/deactivate`);
  },
  activate: async (id) => {
    await api.patch(`/users/${id}/activate`);
  }
};
const doctorsApi = {
  list: async (hospitalId) => {
    const { data } = await api.get(`/doctors?hospitalId=${hospitalId}`);
    return data;
  },
  get: async (id) => {
    const { data } = await api.get(`/doctors/${id}`);
    return data;
  },
  getByUserId: async (userId) => {
    const { data } = await api.get(`/doctors/user/${userId}`);
    return data;
  },
  create: async (payload) => {
    const { data } = await api.post("/doctors", payload);
    return data;
  },
  update: async (id, payload) => {
    const { data } = await api.put(`/doctors/${id}`, payload);
    return data;
  },
  delete: async (id) => {
    await api.delete(`/doctors/${id}`);
  }
};
const pricingApi = {
  getHospitalPriceLists: async (hospitalId) => {
    const { data } = await api.get(`/pricing/hospital/${hospitalId}`);
    return data;
  },
  getPriceListItems: async (priceListId) => {
    const { data } = await api.get(`/pricing/items/list/${priceListId}`);
    return data;
  }
};
const appointmentsApi = {
  getByHospital: async (hospitalId, date) => {
    const url = date ? `/appointments/hospital/${hospitalId}?date=${date}` : `/appointments/hospital/${hospitalId}`;
    const { data } = await api.get(url);
    return data;
  },
  getByDoctor: async (doctorId, date) => {
    const { data } = await api.get(`/appointments/doctor/${doctorId}?date=${date}`);
    return data;
  },
  getByPatient: async (patientId) => {
    const { data } = await api.get(`/appointments/patient/${patientId}`);
    return data;
  },
  getPastDoctors: async (patientId, hospitalId) => {
    const { data } = await api.get(`/appointments/patient/${patientId}/past-doctors`, { params: { hospitalId } });
    return data;
  },
  create: async (payload) => {
    const { data } = await api.post("/appointments", payload);
    return data;
  },
  updateStatus: async (id, status, cancelledReason) => {
    const { data } = await api.put(`/appointments/${id}/status`, { status, cancelledReason });
    return data;
  }
};
const specializationApi = {
  list: async (hospitalId) => {
    const { data } = await api.get(`/specializations?hospitalId=${hospitalId}`);
    return data;
  },
  create: async (payload) => {
    const { data } = await api.post("/specializations", payload);
    return data;
  },
  update: async (id, payload) => {
    const { data } = await api.put(`/specializations/${id}`, payload);
    return data;
  },
  delete: async (id) => {
    await api.delete(`/specializations/${id}`);
  }
};
const hospitalServiceApi = {
  list: async (hospitalId) => {
    const { data } = await api.get(`/hospital-services?hospitalId=${hospitalId}`);
    return data;
  },
  create: async (payload) => {
    const { data } = await api.post("/hospital-services", payload);
    return data;
  },
  update: async (id, payload) => {
    const { data } = await api.put(`/hospital-services/${id}`, payload);
    return data;
  },
  delete: async (id) => {
    await api.delete(`/hospital-services/${id}`);
  },
  toggleStatus: async (id) => {
    await api.patch(`/hospital-services/${id}/toggle-status`);
  }
};
const roomLogsApi = {
  getHospitalLogs: async (hospitalId, search) => {
    const params = { hospitalId };
    if (search) params.search = search;
    const { data } = await api.get("/rooms/logs", { params });
    return data;
  },
  getRoomLogs: async (roomId, hospitalId) => {
    const { data } = await api.get(`/rooms/${roomId}/logs`, { params: { hospitalId } });
    return data;
  }
};
const radiologyApi = {
  list: async (hospitalId, status) => {
    const params = { hospitalId };
    if (status) params.status = status;
    const { data } = await api.get("/radiology", { params });
    return data;
  },
  get: async (id) => {
    const { data } = await api.get(`/radiology/${id}`);
    return data;
  },
  getByPatient: async (patientId) => {
    const { data } = await api.get(`/radiology/patient/${patientId}`);
    return data;
  },
  getStats: async (hospitalId) => {
    const { data } = await api.get("/radiology/stats", { params: { hospitalId } });
    return data;
  },
  create: async (payload) => {
    const { data } = await api.post("/radiology", payload);
    return data;
  },
  markScanned: async (id) => {
    const { data } = await api.patch(`/radiology/${id}/scan`);
    return data;
  },
  generateReport: async (id, findings, observation) => {
    const { data } = await api.patch(`/radiology/${id}/report`, { findings, observation });
    return data;
  }
};
const shiftsApi = {
  getWeek: async (hospitalId, weekStart) => {
    const { data } = await api.get("/shifts", { params: { hospitalId, weekStart } });
    return data;
  },
  getMonth: async (hospitalId, year, month) => {
    const { data } = await api.get("/shifts/monthly", { params: { hospitalId, year, month } });
    return data;
  },
  assign: async (payload) => {
    const { data } = await api.post("/shifts", payload);
    return data;
  },
  remove: async (id) => {
    await api.delete(`/shifts/${id}`);
  }
};
const invoiceApi = {
  create: async (payload) => {
    const { data } = await api.post("/invoices", payload);
    return data;
  },
  getByHospital: async (hospitalId) => {
    const { data } = await api.get(`/invoices/hospital/${hospitalId}`);
    return data;
  },
  get: async (id) => {
    const { data } = await api.get(`/invoices/${id}`);
    return data;
  },
  getByPatient: async (patientId) => {
    const { data } = await api.get(`/billing/patient/${patientId}/invoices`);
    return data;
  },
  getSmartSuggestions: async (patientId) => {
    const { data } = await api.get("/billing/smart-suggestions", { params: { patientId } });
    return data;
  },
  markAsPaid: async (invoiceId, bankAccountId) => {
    const { data } = await api.patch(`/billing/invoices/${invoiceId}/pay`, { bankAccountId });
    return data;
  }
};
const bankApi = {
  list: async (hospitalId) => {
    const { data } = await api.get("/bank-accounts", { params: { hospitalId } });
    return data;
  }
};

const departmentApi = {
  list: async (hospitalId, activeOnly = false) => {
    const { data } = await api.get("/departments", { params: { hospitalId, activeOnly } });
    return data;
  },
  create: async (payload) => {
    const { data } = await api.post("/departments", payload);
    return data;
  },
  update: async (id, payload) => {
    const { data } = await api.put(`/departments/${id}`, payload);
    return data;
  },
  toggle: async (id) => {
    const { data } = await api.patch(`/departments/${id}/toggle`);
    return data;
  }
};

const designationApi = {
  list: async (hospitalId, activeOnly = false, departmentId = null) => {
    const params = { hospitalId, activeOnly };
    if (departmentId) params.departmentId = departmentId;
    const { data } = await api.get("/designations", { params });
    return data;
  },
  create: async (payload) => {
    const { data } = await api.post("/designations", payload);
    return data;
  },
  toggle: async (id) => {
    const { data } = await api.patch(`/designations/${id}/toggle`);
    return data;
  }
};

const admissionApi = {
  list: async (hospitalId, all = false) => {
    const { data } = await api.get("/admissions", { params: { hospitalId, all } });
    return data;
  },
  get: async (id) => {
    const { data } = await api.get(`/admissions/${id}`);
    return data;
  },
  byPatient: async (patientId) => {
    const { data } = await api.get(`/admissions/patient/${patientId}`);
    return data;
  },
  admit: async (payload) => {
    const { data } = await api.post("/admissions", payload);
    return data;
  },
  assignRoom: async (admissionId, roomId) => {
    const { data } = await api.patch(`/admissions/${admissionId}/assign-room`, { roomId });
    return data;
  },
  discharge: async (admissionId, payload) => {
    const { data } = await api.patch(`/admissions/${admissionId}/discharge`, payload);
    return data;
  }
};

const infrastructureApi = {
  get: async (hospitalId) => {
    const { data } = await api.get("/ipd/infrastructure", { params: { hospitalId } });
    return data;
  },
  save: async (hospitalId, buildings) => {
    const { data } = await api.post("/ipd/infrastructure", buildings, { params: { hospitalId } });
    return data;
  },
};

const assetApi = {
  getByRoom: async (hospitalId, roomId) => {
    const { data } = await api.get(`/assets/room/${roomId}`, { params: { hospitalId } });
    return data;
  },
  getAvailable: async (hospitalId, q) => {
    const { data } = await api.get("/assets/available", { params: { hospitalId, ...(q ? { q } : {}) } });
    return data;
  },
  assignToRoom: async (assetId, roomId, hospitalId) => {
    const { data } = await api.patch(`/assets/${assetId}/assign-room`, { roomId, hospitalId });
    return data;
  },
  unassignFromRoom: async (assetId) => {
    const { data } = await api.patch(`/assets/${assetId}/unassign-room`);
    return data;
  },
};

const ambulanceApi = {
  getTypes: async (hospitalId) => {
    const { data } = await api.get("/ambulance/types", { params: { hospitalId } });
    return data;
  },
  createType: async (hospitalId, payload) => {
    const { data } = await api.post("/ambulance/types", payload, { params: { hospitalId } });
    return data;
  },
  deleteType: async (id) => api.delete(`/ambulance/types/${id}`),

  getBookings: async (hospitalId, params = {}) => {
    const { data } = await api.get("/ambulance/bookings", { params: { hospitalId, ...params } });
    return data;
  },
  createBooking: async (hospitalId, payload) => {
    const { data } = await api.post("/ambulance/bookings", payload, { params: { hospitalId } });
    return data;
  },
  updateStatus: async (id, payload) => {
    const { data } = await api.patch(`/ambulance/bookings/${id}/status`, payload);
    return data;
  },
  updateBooking: async (id, payload) => {
    const { data } = await api.put(`/ambulance/bookings/${id}`, payload);
    return data;
  },
  deleteBooking: async (id) => api.delete(`/ambulance/bookings/${id}`),

  getStats: async (hospitalId) => {
    const { data } = await api.get("/ambulance/stats", { params: { hospitalId } });
    return data;
  },
};

const checkupApi = {
  getPackages: async (hospitalId, activeOnly = false) => {
    const { data } = await api.get("/health-checkups/packages", { params: { hospitalId, activeOnly } });
    return data;
  },
  savePackage: async (hospitalId, payload) => {
    const { data } = await api.post("/health-checkups/packages", payload, { params: { hospitalId } });
    return data;
  },
  togglePackage: async (id) => api.patch(`/health-checkups/packages/${id}/toggle`),
  deletePackage: async (id) => api.delete(`/health-checkups/packages/${id}`),

  getBookings: async (hospitalId, params = {}) => {
    const { data } = await api.get("/health-checkups/bookings", { params: { hospitalId, ...params } });
    return data;
  },
  getBooking: async (id) => {
    const { data } = await api.get(`/health-checkups/bookings/${id}`);
    return data;
  },
  createBooking: async (hospitalId, payload) => {
    const { data } = await api.post("/health-checkups/bookings", payload, { params: { hospitalId } });
    return data;
  },
  updateStatus: async (id, status) => {
    const { data } = await api.patch(`/health-checkups/bookings/${id}/status`, { status });
    return data;
  },
  updateResult: async (bookingId, resultId, payload) => {
    const { data } = await api.patch(`/health-checkups/bookings/${bookingId}/results/${resultId}`, payload);
    return data;
  },
  saveDoctorNotes: async (bookingId, payload) => {
    const { data } = await api.patch(`/health-checkups/bookings/${bookingId}/doctor-notes`, payload);
    return data;
  },
  assignDoctor: async (bookingId, doctorId) => {
    const { data } = await api.patch(`/health-checkups/bookings/${bookingId}/doctor`, { doctorId: doctorId || null });
    return data;
  },
  getStats: async (hospitalId) => {
    const { data } = await api.get("/health-checkups/stats", { params: { hospitalId } });
    return data;
  },
};

var stdin_default = api;
export {
  admissionApi,
  ambulanceApi,
  assetApi,
  checkupApi,
  infrastructureApi,
  appointmentsApi,
  authApi,
  bankApi,
  stdin_default as default,
  departmentApi,
  designationApi,
  directoryLogout,
  doctorsApi,
  hospitalServiceApi,
  invoiceApi,
  patientApi,
  pricingApi,
  radiologyApi,
  recordApi,
  roomLogsApi,
  shiftsApi,
  specializationApi,
  staffApi
};
