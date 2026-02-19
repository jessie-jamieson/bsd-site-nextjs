import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/database/db"
import { users } from "@/database/schema"
import { eq } from "drizzle-orm"
import { logAuthorizationFailure } from "@/lib/audit-log"

/**
 * Check if the current user has admin or director access
 * @returns Promise<boolean> - true if user has admin/director role, false otherwise
 */
export async function checkAdminAccess(): Promise<boolean> {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) return false

    const [user] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1)

    return user?.role === "admin" || user?.role === "director"
}

/**
 * Require admin access, throw error if unauthorized
 * Logs failed authorization attempts to audit log
 * @throws Error if user does not have admin/director access
 */
export async function requireAdminAccess(): Promise<void> {
    const session = await auth.api.getSession({ headers: await headers() })
    const hasAccess = await checkAdminAccess()

    if (!hasAccess) {
        // Log the failed authorization attempt if user is authenticated
        if (session?.user) {
            await logAuthorizationFailure({
                userId: session.user.id,
                attemptedAction: "Admin access required"
            })
        }
        throw new Error("Unauthorized: Admin access required")
    }
}

/**
 * Get the current authenticated session
 * @returns Promise<Session | null> - the current session or null if not authenticated
 */
export async function getCurrentSession() {
    return auth.api.getSession({ headers: await headers() })
}

/**
 * Require authentication, throw error if not authenticated
 * @throws Error if user is not authenticated
 */
export async function requireAuth() {
    const session = await getCurrentSession()
    if (!session?.user) {
        throw new Error("Unauthorized: Authentication required")
    }
    return session
}
