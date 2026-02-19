import { getSessionCookie } from "better-auth/cookies"
import { type NextRequest, NextResponse } from "next/server"

// Simple in-memory rate limiter
// Note: For production with multiple instances, use Upstash Ratelimit or similar
class RateLimiter {
    private requests: Map<string, number[]> = new Map()
    private maxRequests: number
    private windowMs: number

    constructor(maxRequests: number, windowMs: number) {
        this.maxRequests = maxRequests
        this.windowMs = windowMs
    }

    isRateLimited(identifier: string): boolean {
        const now = Date.now()
        const timestamps = this.requests.get(identifier) || []

        // Remove timestamps outside the current window
        const validTimestamps = timestamps.filter(
            (ts) => now - ts < this.windowMs
        )

        if (validTimestamps.length >= this.maxRequests) {
            return true
        }

        // Add current timestamp
        validTimestamps.push(now)
        this.requests.set(identifier, validTimestamps)

        // Clean up old entries periodically
        if (this.requests.size > 10000) {
            this.cleanup(now)
        }

        return false
    }

    private cleanup(now: number) {
        for (const [key, timestamps] of this.requests.entries()) {
            const validTimestamps = timestamps.filter(
                (ts) => now - ts < this.windowMs
            )
            if (validTimestamps.length === 0) {
                this.requests.delete(key)
            } else {
                this.requests.set(key, validTimestamps)
            }
        }
    }
}

// Rate limiters for different endpoints
const authLimiter = new RateLimiter(5, 60 * 1000) // 5 requests per minute
const paymentLimiter = new RateLimiter(5, 60 * 60 * 1000) // 5 requests per hour
const generalLimiter = new RateLimiter(100, 60 * 1000) // 100 requests per minute

export async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname

    // Apply rate limiting for API routes
    if (
        pathname.startsWith("/api/") ||
        pathname.includes("/pay-season") ||
        pathname.includes("/payment")
    ) {
        const ip =
            request.headers.get("x-forwarded-for") ||
            request.headers.get("x-real-ip") ||
            "unknown"

        let limiter: RateLimiter | null = null
        let limitType = ""

        if (pathname.startsWith("/api/auth/")) {
            limiter = authLimiter
            limitType = "Authentication"
        } else if (
            pathname.includes("/pay-season") ||
            pathname.includes("/payment")
        ) {
            limiter = paymentLimiter
            limitType = "Payment"
        } else if (pathname.startsWith("/api/")) {
            limiter = generalLimiter
            limitType = "API"
        }

        if (limiter?.isRateLimited(ip)) {
            return NextResponse.json(
                {
                    error: `${limitType} rate limit exceeded. Please try again later.`,
                    retryAfter: 60
                },
                { status: 429 }
            )
        }
    }

    // Check cookie for optimistic redirects for protected routes
    // Use getSession in your RSC to protect a route via SSR or useAuthenticate client side
    const sessionCookie = getSessionCookie(request)

    if (!sessionCookie) {
        const redirectTo = request.nextUrl.pathname + request.nextUrl.search
        return NextResponse.redirect(
            new URL(`/auth/sign-in?redirectTo=${redirectTo}`, request.url)
        )
    }

    return NextResponse.next()
}

export const config = {
    // Protected routes - all dashboard routes and auth settings
    matcher: [
        "/dashboard/:path*",
        "/auth/settings",
        "/api/:path*",
        "/((?!_next/static|_next/image|favicon.ico|.*\\..*|public).*)"
    ]
}
