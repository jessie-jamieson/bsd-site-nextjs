import { db } from "@/database/db"
import { discounts } from "@/database/schema"
import { eq, and, or, isNull, gt } from "drizzle-orm"

export interface UserDiscount {
    id: number
    percentage: string
    expiration: Date | null
}

export async function getActiveDiscountForUser(
    userId: string
): Promise<UserDiscount | null> {
    const now = new Date()

    const [discount] = await db
        .select({
            id: discounts.id,
            percentage: discounts.percentage,
            expiration: discounts.expiration
        })
        .from(discounts)
        .where(
            and(
                eq(discounts.user, userId),
                eq(discounts.used, false),
                or(isNull(discounts.expiration), gt(discounts.expiration, now))
            )
        )
        .limit(1)

    return discount
        ? {
              id: discount.id,
              percentage: discount.percentage || "0",
              expiration: discount.expiration
          }
        : null
}

export async function markDiscountAsUsed(discountId: number): Promise<void> {
    await db
        .update(discounts)
        .set({ used: true })
        .where(eq(discounts.id, discountId))
}

export function calculateDiscountedAmount(
    baseAmount: string,
    discountPercentage: string
): string {
    const base = parseFloat(baseAmount)
    const discount = parseFloat(discountPercentage)

    // Validate discount percentage is within acceptable range (0-100)
    if (Number.isNaN(discount) || discount < 0 || discount > 100) {
        throw new Error(
            `Invalid discount percentage: ${discountPercentage}. Must be between 0 and 100.`
        )
    }

    // Validate base amount is a positive number
    if (Number.isNaN(base) || base < 0) {
        throw new Error(
            `Invalid base amount: ${baseAmount}. Must be a positive number.`
        )
    }

    const discounted = base * (1 - discount / 100)
    return discounted.toFixed(2)
}
