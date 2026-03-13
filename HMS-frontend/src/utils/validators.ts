/** Returns an error message string if invalid, undefined if valid. */

export const validateEmail = (email: string): string | undefined => {
    if (!email) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email address'
}

export const validatePassword = (password: string): string | undefined => {
    if (!password) return 'Password is required'
    if (password.length < 6) return 'Password must be at least 6 characters'
}

export const validateRequired = (value: string, label = 'This field'): string | undefined => {
    if (!value || !value.trim()) return `${label} is required`
}

export const validatePhone = (phone: string): string | undefined => {
    if (!phone) return undefined // phone is optional
    if (!/^\+?[\d\s\-()]{7,15}$/.test(phone)) return 'Invalid phone number'
}

/** Format a date string to DD/MM/YYYY */
export const formatDate = (iso: string): string => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Format a date-time string to DD/MM/YYYY HH:MM */
export const formatDateTime = (iso: string): string => {
    const d = new Date(iso)
    return d.toLocaleString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    })
}

/** Calculate age from a date of birth string */
export const calcAge = (dob: string): number => {
    const birth = new Date(dob)
    const now = new Date()
    let age = now.getFullYear() - birth.getFullYear()
    const m = now.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
    return age
}

/** Generate a simple invoice number */
export const generateInvoiceNumber = (): string => {
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const rand = Math.floor(Math.random() * 9000) + 1000
    return `INV-${dateStr}-${rand}`
}
