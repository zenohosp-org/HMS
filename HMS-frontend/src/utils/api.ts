import axios from 'axios'

const DIRECTORY_API_URL = 'https://api-directory.zenohosp.com'

// ── Axios Instance ────────────────────────────────────────────────────────────

const api = axios.create({
    baseURL: (() => {
        const rawUrl = import.meta.env.VITE_API_URL || '';
        if (!rawUrl || rawUrl === '/api') return '/api';
        const baseUrl = rawUrl.replace(/\/$/, '');
        return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
    })(),
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,  // Automatically send/receive HttpOnly cookies
})

// Handle 401 globally — session expired, redirect to login
api.interceptors.response.use(
    res => res,
    err => {
        if (err.response?.status === 401) {
            if (!err.config?.url?.includes('/auth/me')) {
                window.location.href = '/login'
            }
        }
        return Promise.reject(err)
    }
)

// ── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
    login: async (email: string, password: string) => {
        const { data } = await api.post('/auth/login', { email, password })
        return data
    },
    register: async (payload: {
        email: string; password: string
        firstName: string; lastName: string; phone?: string
    }) => {
        const { data } = await api.post('/auth/register', payload)
        return data
    },
    me: async () => {
        const { data } = await api.get('/auth/me')
        return data
    },
}

// Clears the sso_token cookie on the Directory server (cross-app logout)
export const directoryLogout = () =>
    axios.post(`${DIRECTORY_API_URL}/api/auth/logout`, {}, { withCredentials: true })

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Patient {
    id: number
    mrn: string
    firstName: string
    lastName: string
    dob: string
    gender: string
    phone: string | null
    email: string | null
    bloodGroup: string | null
    address: string | null
    state: string | null
    createdAt: string
}

export interface PatientRecord {
    id: string
    historyType: string
    description: string | null
    nextVisitDate: string | null
    createdAt: string
    createdBy: { firstName: string; lastName: string; role: string }
}

export interface StaffUser {
    id: string
    email: string
    firstName: string
    lastName: string | null
    role: string
    roleDisplay: string
    specialization: string | null
    department: string | null
    isActive: boolean
    about?: string
    experienceYears?: number
    languages?: string
    education?: string
    certifications?: string
    rating?: number
    reviewCount?: number
    address?: string
    phone?: string
    state?: string
    employeeCode?: string
    designation?: string
    gender?: string
    dateOfJoining?: string
    branchId?: string
    departmentId?: string
    lastLoginAt?: string
}

export interface DoctorUser {
    id: string
    userId: string
    hospitalId: string
    firstName: string
    lastName: string
    email: string
    phone: string
    userIsActive: boolean
    specialization: string | null
    qualification: string | null
    medicalRegistrationNumber: string | null
    registrationCouncil: string | null
    consultationFee: number | null
    followUpFee: number | null
    availableDays: string | null
    slotDurationMin: number
    maxDailySlots: number | null
}

export interface PriceList {
    id: string
    hospitalId: string
    name: string
    description?: string
    isDefault: boolean
    isActive: boolean
}

export interface PriceListItem {
    id: string
    priceListId: string
    itemType: 'CONSULTATION' | 'ROOM_RENT' | 'OT_CHARGE' | 'LAB_TEST' | 'PROCEDURE' | 'NURSING' | 'OTHER'
    itemId?: string
    itemName: string
    price: number
    isActive: boolean
}

export interface Appointment {
    id: string
    hospitalId: string
    branchId?: string
    patientId: number
    patientName: string
    patientPhone?: string
    doctorId: string
    doctorName: string
    doctorSpecialization?: string
    apptDate: string
    apptTime: string
    apptEndTime: string
    type: 'OPD' | 'FOLLOWUP' | 'EMERGENCY' | 'TELECONSULT'
    status: 'SCHEDULED' | 'CONFIRMED' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
    tokenNumber?: number
    chiefComplaint?: string
    cancelledReason?: string
    priceListId?: string
    priceListName?: string
    createdById?: string
    createdByName?: string
    createdAt?: string
    updatedAt?: string
}

export interface Specialization {
    id: string
    hospitalId: string
    name: string
    description: string
    isActive: boolean
    createdAt: string
    noOfDoctor: number
}

export interface HospitalService {
    id: string
    hospitalId: string
    name: string
    specializationId: string
    price: number
    isActive: boolean
    createdAt: string
    updatedAt: string
}

export interface Invoice {
    id?: string
    invoiceNumber: string
    hospitalId: string
    patientId: number
    appointmentId?: string
    specializationId?: string
    subtotal: number
    tax: number
    discount: number
    total: number
    notes?: string
    status: 'UNPAID' | 'PAID' | 'CANCELLED'
    items: InvoiceItem[]
    createdAt?: string
}

export interface InvoiceItem {
    id?: string
    serviceId?: string
    description: string
    quantity: number
    unitPrice: number
    totalPrice: number
}

// ── Patient API ───────────────────────────────────────────────────────────────

export const patientApi = {
    list: async (hospitalId: string): Promise<Patient[]> => {
        const { data } = await api.get(`/patients?hospitalId=${hospitalId}`)
        return data
    },
    get: async (id: number, hospitalId: string): Promise<Patient> => {
        const { data } = await api.get(`/patients/${id}?hospitalId=${hospitalId}`)
        return data
    },
    create: async (payload: Partial<Patient> & { hospitalId: string }): Promise<Patient> => {
        const { data } = await api.post('/patients', payload)
        return data
    },
    update: async (id: number, payload: Partial<Patient>): Promise<Patient> => {
        const { data } = await api.put(`/patients/${id}`, payload)
        return data
    },
    delete: (id: string | number) => api.delete(`/patients/${id}`),
    search: async (hospitalId: string, q?: string) => {
        const res = await api.get<Patient[]>('/patients/search', { params: { hospitalId, q } })
        return res.data
    }
}

// ── Medical Records API ───────────────────────────────────────────────────────

export const recordApi = {
    list: async (patientId: number, hospitalId: string): Promise<PatientRecord[]> => {
        const { data } = await api.get(`/records/patient/${patientId}?hospitalId=${hospitalId}`)
        return data
    },
    create: async (payload: {
        patientId: number
        hospitalId: string
        historyType: string
        description?: string
        nextVisitDate?: string
    }): Promise<PatientRecord> => {
        const { data } = await api.post('/records', payload)
        return data
    },
}

// ── Staff / User Management API ───────────────────────────────────────────────

export const staffApi = {
    list: async (hospitalId: string): Promise<StaffUser[]> => {
        const { data } = await api.get(`/users?hospitalId=${hospitalId}`)
        return data
    },
    get: async (id: string): Promise<StaffUser> => {
        const { data } = await api.get(`/users/${id}`)
        return data
    },
    create: async (payload: {
        email: string; password?: string; firstName: string; lastName?: string
        role: string; hospitalId: string; phone?: string; employeeCode?: string
        designation?: string; gender?: string; dateOfJoining?: string
        branchId?: string; departmentId?: string
    }): Promise<StaffUser> => {
        const { data } = await api.post('/users', payload)
        return data
    },
    update: async (id: string, payload: Partial<StaffUser>): Promise<StaffUser> => {
        const { data } = await api.put(`/users/${id}`, payload)
        return data
    },
    deactivate: async (id: string): Promise<void> => {
        await api.patch(`/users/${id}/deactivate`)
    },
    activate: async (id: string): Promise<void> => {
        await api.patch(`/users/${id}/activate`)
    },
}

// ── Doctors API ───────────────────────────────────────────────────────────────

export const doctorsApi = {
    list: async (hospitalId: string): Promise<DoctorUser[]> => {
        const { data } = await api.get(`/doctors?hospitalId=${hospitalId}`)
        return data
    },
    get: async (id: string): Promise<DoctorUser> => {
        const { data } = await api.get(`/doctors/${id}`)
        return data
    },
    getByUserId: async (userId: string): Promise<DoctorUser> => {
        const { data } = await api.get(`/doctors/user/${userId}`)
        return data
    },
    create: async (payload: Partial<DoctorUser>): Promise<DoctorUser> => {
        const { data } = await api.post('/doctors', payload)
        return data
    },
    update: async (id: string, payload: Partial<DoctorUser>): Promise<DoctorUser> => {
        const { data } = await api.put(`/doctors/${id}`, payload)
        return data
    },
    delete: async (id: string): Promise<void> => {
        await api.delete(`/doctors/${id}`)
    },
}

// ── Pricing API ───────────────────────────────────────────────────────────────

export const pricingApi = {
    getHospitalPriceLists: async (hospitalId: string): Promise<PriceList[]> => {
        const { data } = await api.get(`/pricing/hospital/${hospitalId}`)
        return data
    },
    getPriceListItems: async (priceListId: string): Promise<PriceListItem[]> => {
        const { data } = await api.get(`/pricing/items/list/${priceListId}`)
        return data
    }
}

// ── Appointments API ──────────────────────────────────────────────────────────

export const appointmentsApi = {
    getByHospital: async (hospitalId: string, date?: string): Promise<Appointment[]> => {
        const url = date ? `/appointments/hospital/${hospitalId}?date=${date}` : `/appointments/hospital/${hospitalId}`
        const { data } = await api.get(url)
        return data
    },
    getByDoctor: async (doctorId: string, date: string): Promise<Appointment[]> => {
        const { data } = await api.get(`/appointments/doctor/${doctorId}?date=${date}`)
        return data
    },
    getByPatient: async (patientId: number): Promise<Appointment[]> => {
        const { data } = await api.get(`/appointments/patient/${patientId}`)
        return data
    },
    create: async (payload: Partial<Appointment>): Promise<Appointment> => {
        const { data } = await api.post('/appointments', payload)
        return data
    },
    updateStatus: async (id: string, status: string, cancelledReason?: string): Promise<Appointment> => {
        const { data } = await api.put(`/appointments/${id}/status`, { status, cancelledReason })
        return data
    }
}

// ── Specializations API ───────────────────────────────────────────────────────

export const specializationApi = {
    list: async (hospitalId: string): Promise<Specialization[]> => {
        const { data } = await api.get(`/specializations?hospitalId=${hospitalId}`)
        return data
    },
    create: async (payload: Partial<Specialization>): Promise<Specialization> => {
        const { data } = await api.post('/specializations', payload)
        return data
    },
    update: async (id: string, payload: Partial<Specialization>): Promise<Specialization> => {
        const { data } = await api.put(`/specializations/${id}`, payload)
        return data
    },
    delete: async (id: string): Promise<void> => {
        await api.delete(`/specializations/${id}`)
    }
}

// ── Hospital Services API ────────────────────────────────────────────────────

export const hospitalServiceApi = {
    list: async (hospitalId: string): Promise<HospitalService[]> => {
        const { data } = await api.get(`/hospital-services?hospitalId=${hospitalId}`)
        return data
    },
    create: async (payload: Partial<HospitalService>): Promise<HospitalService> => {
        const { data } = await api.post('/hospital-services', payload)
        return data
    },
    update: async (id: string, payload: Partial<HospitalService>): Promise<HospitalService> => {
        const { data } = await api.put(`/hospital-services/${id}`, payload)
        return data
    },
    delete: async (id: string): Promise<void> => {
        await api.delete(`/hospital-services/${id}`)
    },
    toggleStatus: async (id: string): Promise<void> => {
        await api.patch(`/hospital-services/${id}/toggle-status`)
    }
}

// ── Room Logs API ────────────────────────────────────────────────────────────

export interface RoomLog {
    id: number
    roomId: number
    roomNumber: string
    event: 'ROOM_CREATED' | 'ALLOCATED' | 'DEALLOCATED' | 'ATTENDER_ASSIGNED' | 'ATTENDER_UPDATED'
    patientName?: string
    patientMrn?: string
    attenderName?: string
    allocationToken?: string
    performedBy?: string
    createdAt: string
}

export const roomLogsApi = {
    getHospitalLogs: async (hospitalId: string, search?: string): Promise<RoomLog[]> => {
        const params: Record<string, string> = { hospitalId }
        if (search) params.search = search
        const { data } = await api.get('/rooms/logs', { params })
        return data
    },
    getRoomLogs: async (roomId: number, hospitalId: string): Promise<RoomLog[]> => {
        const { data } = await api.get(`/rooms/${roomId}/logs`, { params: { hospitalId } })
        return data
    },
}

// ── Invoice API ─────────────────────────────────────────────────────────────

export const invoiceApi = {
    create: async (payload: Partial<Invoice>): Promise<Invoice> => {
        const { data } = await api.post('/invoices', payload)
        return data
    },
    getByHospital: async (hospitalId: string): Promise<Invoice[]> => {
        const { data } = await api.get(`/invoices/hospital/${hospitalId}`)
        return data
    },
    get: async (id: string): Promise<Invoice> => {
        const { data } = await api.get(`/invoices/${id}`)
        return data
    }
}

export default api
