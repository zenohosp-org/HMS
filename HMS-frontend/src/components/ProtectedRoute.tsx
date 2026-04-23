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
 * Role names match Directory's convention exactly (all lowercase):
 *   super_admin | hospital_admin | doctor | staff
 *
 * Rules:
 *  - Not authenticated                     → /login
 *  - hospital_admin / doctor / staff without a hospitalId → /unauthorized (misconfigured)
 *  - super_admin                           → /unauthorized (outside HMS scope)
 *  - Role not in allowedRoles              → /unauthorized
 */
export default function ProtectedRoute({ children, allowedRoles }: Props) {
    const { isAuthenticated, isLoading, user } = useAuth()
    const location = useLocation()

    // 1. Wait for session check before redirecting (prevents flash-to-login on new tab)
    if (isLoading) return null

    // 2. Not logged in
    if (!isAuthenticated || !user) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    // 2. Roles that have access to HMS pages
    const hmsRoles: UserRole[] = ['hospital_admin', 'doctor', 'staff']

    // super_admin operates at directory level, not inside individual apps
    if (user.role === 'super_admin') {
        return <Navigate to="/unauthorized" replace />
    }

    // hospital_admin, doctor, staff must have a linked hospital
    if (hmsRoles.includes(user.role) && !user.hospitalId) {
        return <Navigate to="/unauthorized" replace />
    }

    // 3. Unknown role
    if (!hmsRoles.includes(user.role)) {
        return <Navigate to="/unauthorized" replace />
    }

    // 4. Optional per-route role restriction (e.g. hospital_admin-only pages)
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/unauthorized" replace />
    }

    return <>{children}</>
}
