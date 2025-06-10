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
