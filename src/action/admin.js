"use server";
import { db } from "@/lib/data/prisma";
import { auth } from "@clerk/nextjs/server";

import { revalidatePath } from "next/cache";

export async function getVerifyAdmin(params) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("unauthorized persons");
  }
  try {
    const user = await db.user.findUnique({
      where: {
        clerkUserId: userId,
      },
    });

    return user?.role === "ADMIN";
  } catch (error) {
    console.error("Failed to verify admin:", error);
    return false;
  }
}

export async function getPendingDoctor() {
    const isAdmin = await verifyAdmin();
  if (!isAdmin) throw new Error("Unauthorized");
try {
    const pendingDoctor = await db.user.findMany({
        where: {
            role: 'DOCTOR',
            VerificationStatus: 'PENDING'
        },
        orderBy: {
            createdAt: 'desc'
        }
    })

    return {doctor: pendingDoctor}
} catch (error) {
    throw new Error("Failed to fetch pending doctors");
}
}

export async function getVerifyedDoctor () {
  const isAdmin = await verifyAdmin()
  if (!isAdmin) {
    return false
  }
  try {
    const verifiedDoctor = await db.user.findMany({
      where: {
        role: 'DOCTOR',
        VerificationStatus: 'VERIFIED'
      },
      orderBy: {
        name: 'asc'
      }
    })
    return {doctor: verifiedDoctor}
  } catch (error) {
    throw new Error("Failed to fetch pending doctors");
  }
}

export async function upadateStatus(formData) {
  const isAdmin = await verifyAdmin()
  if (!isAdmin) {
    return false
  }

  const doctorId = formData.get('doctorId')
  const status = formData.get('status')
  if (!doctorId || !["VERIFIED", "REJECTED"].includes(status)) {
    throw new Error("Invalid input");
  }
  try {
    const updatedDoctor = await db.user.update({
      where: {
        id: doctorId
      },
      data: {
        VerificationStatus: status
      }
    })
 
    revalidatePath('/admin')
    return {doctor: updatedDoctor}
  } catch (error) {
    console.error("Failed to update doctor status:", error);
    throw new Error(`Failed to update doctor status: ${error.message}`);
  }
}

export async function updatedDoctorActiveStatus(formData) {
  const isAdmin = await verifyAdmin()
  if (!isAdmin) {
    return false
  }

  const doctorId = formData.get('doctorId')
  const suspend = formData.get('suspend') === 'true';
  if (!doctorId) {
    throw new Error('doctor not found')
  }

  try {
    const status = suspend ? 'PENDING' : 'VERIFIED'
    = await db.user.update({
      where: {
        id: doctorId
      },
      data: {
        VerificationStatus: status
      }
    })
 
    revalidatePath('/admin')
    return { success: true };
  } catch (error) {
    console.error("Failed to update doctor active status:", error);
    throw new Error(`Failed to update doctor status: ${error.message}`);
  }
}

export async function getPendingPayout() {
  const isAdmin = await verifyAdmin()
  if (!isAdmin) {
    return false
  }

  try {
    const pendingPayout = await db.payout.findUnique({
      where: {
        status: 'PROCESSING'
      },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
            specialty: true,
            credits: true,
          },
        }
      },
      orderBy: {
        cretedAt: 'desc'
      }
    })

    return {payout: pendingPayout}
  } catch (error) {
    console.error("Failed to fetch pending payouts:", error);
    throw new Error("Failed to fetch pending payouts");
  }
}

export async function approvePayout(formData) {
  const isAdmin = await verifyAdmin()
  if (!isAdmin) {
    return false
  }

  const payoutId = formData.get("payoutId");

  if (!payoutId) {
    throw new Error("Payout ID is required");
  }

  try {
    const { userId } = await auth();
    const admin = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    // Find the payout request
    const payout = await db.payout.findUnique({
      where: {
        id: payoutId,
        status: "PROCESSING",
      },
      include: {
        doctor: true,
      },
    });

    
    if (!payout) {
      throw new Error("Payout request not found or already processed");
    }

    // Check if doctor has enough credits
    if (payout.doctor.credits < payout.credits) {
      throw new Error("Doctor doesn't have enough credits for this payout");
    }

    await db.$transaction(async (tx) => {
      // Update payout status to PROCESSED
      await tx.payout.update({
        where: {
          id: payoutId,
        },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
          processedBy: admin?.id || "unknown",
        },
      });

      // Deduct credits from doctor's account
      await tx.user.update({
        where: {
          id: payout.doctorId,
        },
        data: {
          credits: {
            decrement: payout.credits,
          },
        },
      });

      // Create a transaction record for the deduction
      await tx.creditTransaction.create({
        data: {
          userId: payout.doctorId,
          amount: -payout.credits,
          type: "ADMIN_ADJUSTMENT",
        },
      });
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("Failed to approve payout:", error);
    throw new Error(`Failed to approve payout: ${error.message}`);
  }
}