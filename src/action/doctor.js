"use server";

import { db } from "@/lib/data/prisma";
import { auth } from "@clerk/nextjs/server";
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
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const doctor = await db.user.findUnique({
      where: {
        clerkUserId: userId,
        role: 'DOCTOR'
      }
    })

    if (!doctor) {
      throw new Error("Doctor not found");
    }

    const appointments = await db.appointment.findMany({
      where: {
        doctorId: doctor.id,
        status: {
          in: ['SCHEDULED']
        }
      },
      include: {
        patient: true
      },
      orderBy: {
        startTime: 'asc'
      }
    })

    return { appointments }
  } catch (error) {
    throw new Error("Failed to fetch appointments " + error.message);
  }
  //  findUnique to doctor and check doctor
  // findmany to all appointment get data
}
export async function cancelAppointment(formData) {
  //  check userid and findUnique
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized");
  }


  try {
    const user = await db.user.findUnique({
      where: {
        clerkUserId: userId
      }
    })

    if (!user) {
      throw new Error("User not found");
    }
    const appointmentId = formData.get("appointmentId");

    if (!appointmentId) {
      throw new Error("Appointment ID is required");
    }

    //  findUnique to appointement data  to include methods patinet and doctor
    const appointments = await db.appointment.findUnique({
      where: {
        id: appointmentId
      },
      include: {
        patient: true,
        doctor: true
      }
    })

    if (!appointments) {
      throw new Error("Appointment not found");
    }

    // Verify the user is either the doctor or the patient for this appointment
    if (appointment.doctorId !== user.id && appointment.patientId !== user.id) {
      throw new Error("You are not authorized to cancel this appointment");
    }

    // Perform cancellation in a transaction with update to data status : 'CANCELLED' and then to create creditTransaction patientid and doctor

    await db.$transaction(async (tx) => {
      await tx.appointment.update({
        where: {
          id: appointmentId
        },
        data: {
          status: "CANCELLED",
        },
      })

      await tx.creditTransaction.create({
        data: {
          userId: appointment.patientId,
          amount: 2,
          type: "APPOINTMENT_DEDUCTION",
        },
      });

      await tx.creditTransaction.create({
        data: {
          userId: appointment.doctorId,
          amount: -2,
          type: "APPOINTMENT_DEDUCTION"
        }
      })

      await tx.user.update({
        where: {
          id: appointment.patientId
        },
        data: {
          credits: {
            increment: 2,
          }
        }
      })

      await tx.user.update({
        where: {
          id: appointment.doctorId
        },
        data: {
          credits: {
            decrement: 2,
          }
        }
      })
    })
    // // Update patient's credit balance (increment)
    //  // Update doctor's credit balance (decrement)
    // Determine which path to revalidate based on user role
    if (user.role === "DOCTOR") {
      revalidatePath("/doctor");
    } else if (user.role === "PATIENT") {
      revalidatePath("/appointments");
    }

  } catch (error) {
    console.error("Failed to cancel appointment:", error);
    throw new Error("Failed to cancel appointment: " + error.message);
  }
}
export async function addAppointmentNotes(formData) {
  const { userId } = await auth()
  if (!userId) {
    throw new Error('unauthorized user')
  }

  try {
    const doctor = await db.user.findUnique({
      where: {
        clerkUserId: doctorId,
        role: 'DOCTOR'
      }
    })

    if (!doctor) {
      throw new Error('doctor not found')
    }

    const appointmentId = formData.get('appointmentId')
    const notes = formData.get('notes')
    if (!appointmentId || !notes) {
      throw new Error("Appointment ID and notes are required");
    }

    const appointments = await db.appointment.findUnique({
      where: {
        id: appointmentId,
        doctorId: doctor.id
      }
    })

    if (!appointments) {
      throw new Error("Appointment not found");
    }

    const updatedAppointment = await db.appointment.update({
      where: {
        id: appointmentId
      },
      data: {
        notes
      }
    })
    revalidatePath("/doctor");
    return { success: true, appointment: updatedAppointment };
  } catch (error) {
    console.error("Failed to add appointment notes:", error);
    throw new Error("Failed to update notes: " + error.message);
  }
  // check userid by auth() and findUique to appoint dactor 
  // to formdata get appointmentId and notes 

  // findunique to appointment and check appointment
  // // Update the appointment notes
}
export async function markAppointmentCompleted(formData) {
  // check userid by auth()
  const { userId } = await auth()
  if (!userId) {
    throw new Error('Unauthorized user')
  }

  try {
    const doctor = await db.user.findUnique({
      where: {
        clerkUserId: doctorId,
        role: 'DOCTOR'
      }
    })

    if (!doctor) {
      throw new Error('Doctor not found')
    }

    const appointmentId = formData.get('appointmentId')

    if (!appointmentId) {
      throw new Error('Appointment ID is required')
    }


    const appointements = await db.appointment.findUnique({
      where: {
        id: appointmentId,
        doctorId: doctor.id
      },
      include: {
        patient: true
      }
    })

    if (!appointements) {
      throw new Error("Appointment not found or not authorized");
    }

    // Check if appointment is currently scheduled
    if (appointements.status !== "SCHEDULED") {
      throw new Error("Only scheduled appointments can be marked as completed");
    }

    const now = new Date()
    const apoappointmentEndTime = new Date(appointements.endTime)
    if (now < apoappointmentEndTime) {
      throw new Error(
        "Cannot mark appointment as completed before the scheduled end time"
      );
    }

    const updatedAppointment = await db.appointment.update({
      where: {
        id: appointmentId,
      },
      data: {
        status: "COMPLETED",
      },
    });

    revalidatePath("/doctor");
    return { success: true, appointment: updatedAppointment };
  } catch (error) {
    console.error("Failed to mark appointment as completed:", error);
    throw new Error(
      "Failed to mark appointment as completed: " + error.message
    );
  }
  // after in try catch user.findUnique to check dotcor error doctor not found
  // get appointmentID with fomdata and next check appointmentID error throw to this "Appointment ID is required"
  // appointment to findunique where to checj=k id: and doctor id and include patient : true and next step to check appointment aviable ya not  aviable
  // next step to check appointment.status === "SCHEDULED"
  // next step now(new.date) and appointmentEndTime
  // next step  update  appointment
  // next step revalidated /doctor
}
