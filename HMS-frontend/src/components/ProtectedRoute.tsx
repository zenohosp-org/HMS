import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, UserRole } from '@/context/AuthContext'

interface Props {
    children: React.ReactNode
    allowedRoles?: UserRole[]
}

/**
 * Guards routes by authentication and role.
 *
 * Rules:
 *  - Not authenticated            → /login
 *  - HOSPITAL_ADMIN with hospital → allowed ✅
 *  - HOSPITAL_ADMIN without hospital → /unauthorized (misconfigured account)
 *  - DOCTOR / STAFF with hospital → allowed ✅
 *  - DOCTOR / STAFF without hospital → /unauthorized ("contact admin")
 *  - SUPER_ADMIN                  → /unauthorized (outside HMS scope)
 *  - Role not in allowedRoles     → /unauthorized
 */
export default function ProtectedRoute({ children, allowedRoles }: Props) {
    const { isAuthenticated, user } = useAuth()
    const location = useLocation()

    // 1. Not logged in
    if (!isAuthenticated || !user) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    // 2. All HMS roles (HOSPITAL_ADMIN, DOCTOR, STAFF) must have a hospital
    const hmsRoles: UserRole[] = ['ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'STAFF']
    
    // Hospital check applies only to roles that are NOT Admin
    if (user.role !== 'ADMIN' && hmsRoles.includes(user.role) && !user.hospitalId) {
        return <Navigate to="/unauthorized" replace />
    }

    // 3. Any unknown roles are blocked from HMS
    if (!hmsRoles.includes(user.role)) {
        return <Navigate to="/unauthorized" replace />
    }

    // 4. Optional per-route role restriction (e.g. admin-only pages)
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/unauthorized" replace />
    }

    return <>{children}</>
}
