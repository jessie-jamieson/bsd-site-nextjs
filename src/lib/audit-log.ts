import { db } from "@/database/db"
import { auditLog } from "@/database/schema"

export async function logAuditEntry(params: {
    userId: string
    action: string
    entityType?: string
    entityId?: string | number
    summary: string
}): Promise<void> {
    try {
        await db.insert(auditLog).values({
            user: params.userId,
            action: params.action,
            entity_type: params.entityType ?? null,
            entity_id: params.entityId != null ? String(params.entityId) : null,
            summary: params.summary,
            created_at: new Date()
        })
    } catch (error) {
        console.error("Failed to write audit log:", error)
    }
}

/**
 * Log failed authorization attempt (admin access denied)
 */
export async function logAuthorizationFailure(params: {
    userId: string
    attemptedAction: string
    resource?: string
}): Promise<void> {
    await logAuditEntry({
        userId: params.userId,
        action: "AUTHORIZATION_FAILED",
        entityType: params.resource ?? "admin_resource",
        summary: `Failed authorization attempt: ${params.attemptedAction}`
    })
}

/**
 * Log failed authentication attempt
 */
export async function logAuthenticationFailure(params: {
    identifier: string
    reason: string
}): Promise<void> {
    try {
        // For failed auth, we might not have a userId, so use a placeholder
        await db.insert(auditLog).values({
            user: "system",
            action: "AUTHENTICATION_FAILED",
            entity_type: "auth",
            entity_id: params.identifier,
            summary: `Failed authentication: ${params.reason}`,
            created_at: new Date()
        })
    } catch (error) {
        console.error("Failed to write audit log:", error)
    }
}

/**
 * Log failed payment attempt
 */
export async function logPaymentFailure(params: {
    userId: string
    amount: string
    reason: string
}): Promise<void> {
    await logAuditEntry({
        userId: params.userId,
        action: "PAYMENT_FAILED",
        entityType: "payment",
        summary: `Failed payment of $${params.amount}: ${params.reason}`
    })
}

/**
 * Log security event (rate limiting, suspicious activity, etc.)
 */
export async function logSecurityEvent(params: {
    userId?: string
    eventType: string
    details: string
    severity?: "low" | "medium" | "high"
}): Promise<void> {
    await logAuditEntry({
        userId: params.userId ?? "system",
        action: `SECURITY_${params.severity?.toUpperCase() ?? "MEDIUM"}`,
        entityType: "security",
        summary: `${params.eventType}: ${params.details}`
    })
}
