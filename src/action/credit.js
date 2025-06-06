"use server";

import { db } from "@/lib/data/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { format } from "date-fns";

// Define credit allocations per plan
const PLAN_CREDITS = {
  free_user: 0, // Basic plan: 2 credits
  standard: 10, // Standard plan: 10 credits per month
  premium: 24, // Premium plan: 24 credits per month
};

// Each appointment costs 2 credits
const APPOINTMENT_CREDIT_COST = 2;
export async function checkAndAllocateCredits() {
  try {
    if (!user) {
      return null;
    }

    if (user?.role === "PATIENT") {
      return user;
    }

    const { has } = await auth();

    const hasBasic = has({ plan: "free_user" });
    const hasStander = has({ plan: "standard" });
    const hasPremium = has({ plan: "premium" });

    let currentPlan = null;
    let creditsToAllocate = 0;

    // this code change switch  case
    if (hasPremium) {
      currentPlan = "premium";
      creditsToAllocate = PLAN_CREDITS.premium;
    } else if (hasStander) {
      currentPlan = "standard";
      creditsToAllocate = PLAN_CREDITS.standard;
    } else if (hasBasic) {
      currentPlan = "free_user";
      creditsToAllocate = PLAN_CREDITS.free_user;
    }

    if (!currentPlan) {
      return user;
    }

    const currentMonth = format(new Date(), "yyyy-MM");

    if (user.transactions.length > 0) {
      const latestTransactions = user.transactions[0];
      const transactionMonth = format(
        new Date(latestTransactions.createdAt),
        "yyyy-MM"
      );
    }
    const transactionsPlan = latestTransactions.packageId;

    if (transactionMonth === currentMonth && transactionsPlan === currentPlan) {
      return user;
    }

    const updatedUser = await db.$transaction(async (tx) => {
      // Create transaction record
      await tx.creditTransaction.create({
        data: {
          userId: user.id,
          amount: creditsToAllocate,
          type: "CREDIT_PURCHASE",
          packageId: currentPlan,
        },
      });

      // Update user's credit balance
      const updatedUser = await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          credits: {
            increment: creditsToAllocate,
          },
        },
      });

      return updatedUser;
    });

    // Revalidate relevant paths to reflect updated credit balance
    revalidatePath("/doctors");
    revalidatePath("/appointments");

    return updatedUser;
  } catch (error) {
    console.error(
      "Failed to check subscription and allocate credits:",
      error.message
    );
    return null;
  }
}

export async function deductCreditsForAppointment(userId, doctorId) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      // include: { transactions: true },
    });

    const doctor = await db.user.findUnique({
      where: {
        id: doctorId,
      },
    });

    if (!user || user.credits < APPOINTMENT_CREDIT_COST) {
      return { success: false, message: "Insufficient credits" };
    }

    if (!doctor) {
      throw new Error("Doctor not found");
    }

    const result = await db.$transaction(async (tx) => {
      // Deduct credits
      await tx.creditTransaction.create({
        data: {
          userId: user.id,
          amount: -APPOINTMENT_CREDIT_COST,
          type: "APPOINTMENT_DEDUCTION",
        },
      });

      // Create transaction record for credit deduction
      await tx.creditTransaction.create({
        data: {
          userId: doctor.id,
          amount: APPOINTMENT_CREDIT_COST,
          type: "APPOINTMENT_DEDUCTION",
        },
      });

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          credits: {
            decrement: APPOINTMENT_CREDIT_COST,
          },
        },
      });

      await tx.user.update({
        where: {
          id: doctor.id,
        },
        data: {
          increment: APPOINTMENT_CREDIT_COST,
        },
      });

      return updatedUser;
    });
    return { success: true, user: result };
  } catch (error) {
    console.error("Failed to deduct credits for appointment:", error.message);
    return { success: false, message: error.message };
  }
}
