"use server";

import db from "@/lib/data/prisma";
import { auth } from " @clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function setAvailabilitySlots(formData) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("unauthorized");
  }
  try {
    const doctor = await db.user.findUnique({
      where: {
        clerkUserId: userId,
        role: "DOCTOR",
      },
    });

    if (!doctor) {
      throw new Error("Doctor not found");
    }

    const startTime = formData.get("startTime");
    const endTime = formData.get("endTime");

    if (!startTime || !endTime) {
      throw new Error("Start time and end time are required");
    }

    if (startTime >= endTime) {
      throw new Error("Start time must be before end time");
    }

    const existingSlot = await db.availability.findMany({
      where: {
        doctorId: doctor.id,
      },
    });

    if (existingSlot.length > 0) {
      const slotWithNoAppointments = existingSlot.filter(
        (slot) => !slot.appointment || slot.appointment.length === 0
      );

      if (slotWithNoAppointments.length > 0) {
        await db.availability.deleteMany({
          where: {
            id: {
              in: slotWithNoAppointments.map((slot) => slot.id),
            },
          },
        });
      }
    }

    const newSlot = await db.availability.create({
      data: {
        doctorId: doctor.id,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status: "AVAILABLE",
      },
    });
    revalidatePath("/doctor");
    return { success: true, slot: newSlot };
  } catch (error) {
    console.error("Failed to set availability slots:", error);
    throw new Error("Failed to set availability: " + error.message);
  }
}

export async function getDoctorAvailability() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const doctor = await db.user.findUnique({
      where: {
        clerkUserId: userId,
        role: "DOCTOR",
      },
    });
    if (!doctor) {
      throw new Error("Doctor not found");
    }

    const availabilitySlot = await db.availability.create({
      where: {
        doctorId: doctor.id,
      },
      orderBy: {
        startTime: "desc",
      },
    });

    return { slots: availabilitySlot };
  } catch (error) {
    throw new Error("Failed to fetch availability slots " + error.message);
  }
}
export async function getDoctorAppointments() {
  //  check userid and findUnique
  //  findUnique to doctor and check doctor
  // findmany to all appointment get data
}
export async function cancelAppointment() {
  // paramenters formdata
  //  check userid and findUnique
  const appointmentId = formData.get("appointmentId");

  if (!appointmentId) {
    throw new Error("Appointment ID is required");
  }

  //  findUnique to appointement data  to include methods patinet and sotor

  if (!appointment) {
    throw new Error("Appointment not found");
  }

  // Verify the user is either the doctor or the patient for this appointment
  if (appointment.doctorId !== user.id && appointment.patientId !== user.id) {
    throw new Error("You are not authorized to cancel this appointment");
  }

  // Perform cancellation in a transaction with update to data status : 'CANCELLED' and then to create creditTransaction patientid and doctor
  // // Update patient's credit balance (increment)
  //  // Update doctor's credit balance (decrement)
  // Determine which path to revalidate based on user role
  if (user.role === "DOCTOR") {
    revalidatePath("/doctor");
  } else if (user.role === "PATIENT") {
    revalidatePath("/appointments");
    }
    
    catch (error) {
    console.error("Failed to cancel appointment:", error);
    throw new Error("Failed to cancel appointment: " + error.message);
  }
}
export async function addAppointmentNotes() {
     // paremeter formdata
    // check userid by auth() and findUique to appoint dactor 
    // to formdata get appointmentId and notes 
    if (!appointmentId || !notes) {
      throw new Error("Appointment ID and notes are required");
    }

    // findunique to appointment and check appointment
    // // Update the appointment notes
     revalidatePath("/doctor");
}
export async function markAppointmentCompleted() {
  // paremeter formdata
  // check userid by auth()
  // after in try catch user.findUnique to check dotcor error doctor not found
  // get appointmentID with fomdata and next check appointmentID error throw to this "Appointment ID is required"
  // appointment to findunique where to checj=k id: and doctor id and include patient : true and next step to check appointment aviable ya not  aviable
  // next step to check appointment.status === "SCHEDULED"
  // next step now(new.date) and appointmentEndTime
  // next step  update  appointment
  // next step revalidated /doctor
}
