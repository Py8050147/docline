"use server";
import { db } from "@/lib/data/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { deductCreditsForAppointment } from "./credit";
import { Vonage } from "@vonage/server-sdk";
import { Auth } from "@vonage/auth";
import { addDays, addMinutes, format, isBefore, endOfDay } from "date-fns";
import { Award } from "lucide-react";
import { threadId } from "worker_threads";
import { date } from "zod";

const credentials = new Auth({
  applicationId: process.env.NEXT_PUBLIC_VONAGE_APPLICATION_ID,
  privateKey: process.env.VONAGE_PRIVATE_KEY,
});

const options = {};
const vonage = new Vonage(credentials, options);

export async function bookAppointment(formData) {
  // get userid with auth and check userid
  const { userId } = await auth();
  if (!userId) {
    return false;
  }
  // find patient with findUnique
  try {
    const patient = await db.user.findUnique({
      where: {
        clerckUserId: userId,
        role: "PATIENT",
      },
    });

    if (!patient) {
      throw new Error("Patient not found");
    }

    // // Parse form data with docotrid, starttime, endtime and desvriptiuons

    const doctorId = formData.get("doctorId");
    const startTime = new Date(formData.get("startTime"));
    const endTime = new Date(formData.get("endTime"));
    const patientDescription = formData.get("description") || null;

    if (!doctorId || !startTime || !endTime) {
      throw new Error("Doctor, start time, and end time are required");
    }

    const doctor = await db.user.findUnique({
      where: {
        id: doctorId,
        role: "DOCTOR",
        VerificationStatus: "VERIFIED",
      },
    });

    if (!doctor) {
      throw new Error("Doctor not found or not verified");
    }

    if (patient.credits < 2) {
      throw new Error("Insufficient credits to book an appointment");
    }

    const overlappingAppointment = await db.appointment.findFirst({
      where: {
        doctorId: doctorId,
        status: "SCHEDULED",
        OR: [
          {
            // New appointment starts during an existing appointment
            startTime: {
              lte: startTime,
            },
            endTime: {
              gt: startTime,
            },
          },
          {
            // New appointment ends during an existing appointment
            startTime: {
              lt: endTime,
            },
            endTime: {
              gte: endTime,
            },
          },
          {
            // New appointment completely overlaps an existing appointment
            startTime: {
              gte: startTime,
            },
            endTime: {
              lte: endTime,
            },
          },
        ],
      },
    });

    if (overlappingAppointment) {
      throw new Error("This time slot is already booked");
    }

    const sessionId = await createVideoSession();

    const { success, error } = await deductCreditsForAppointment(
      patient.id,
      doctor.id
    );

    if (!success) {
      throw new Error(error || "Failed to deduct credits");
    }

    const appointment = await db.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        startTime,
        endTime,
        patientDescription,
        status: "SCHEDULED",
        videoSessionId: sessionId, // Store the Vonage session ID
      },
    });

    revalidatePath("/appointments");
    return { success: true, appointment: appointment };
  } catch (error) {
    console.error("Failed to book appointment:", error);
    throw new Error("Failed to book appointment:" + error.message);
  }
}

async function createVideoSession() {
  try {
    const session = await vonage.video.createSession({ mediaMode: "routed" });
    return session.sessionId;
  } catch (error) {
    throw new Error("Failed to create video session: " + error.message);
  }
}

export async function generateVideoToken(formData) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const user = await db.user.findUnique({
      where: {
        clerckUserId: userId,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const appointmentId = formData.get("appointmentId");

    const appointment = await db.appointment.findUnique({
      where: {
        id: appointmentId,
      },
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    // Verify the user is either the doctor or the patient for this appointment
    if (appointment.doctorId !== user.id && appointment.patientId !== user.id) {
      throw new Error("You are not authorized to join this call");
    }

    if (appointment.status !== "SCHEDULED") {
      throw new Error("this appoThis appointment is not currently scheduled");
    }

    const now = new Date();
    const appointmentTime = new Date(appointment.startTime);
    const timeDifference = (appointmentTime - now) / (1000 * 60);

    if (timeDifference > 30) {
      throw new Error(
        "The call will be available 30 minutes before the scheduled time"
      );
    }

    const appointmentEndTime = new Date(appointment.endTime);
    const expirationToken =
      Math.floor(appointmentEndTime.getTime() / 1000) + 60 * 60;

    const connectionData = JSON.stringify({
      name: user.name,
      role: user.role,
      userId: user.id,
    });

    const token = vonage.video.generateClientToken(appointment.videoSessionId, {
      role: "publisher",
      expireTime: expirationToken,
      data: connectionData,
    });

    await db.appointment.upadate({
      where: {
        id: appointmentId,
      },
      data: {
        videoSessionToken: token,
      },
    });

    return {
      success: true,
      videoSessionId: appointment.videoSessionId,
      token: token,
    };
  } catch (error) {
    console.error("Failed to generate video token:", error);
    throw new Error("Failed to generate video token:" + error.message);
  }
}

export async function getDoctorById(doctorId) {
    try {
        const doctor = await db.user.findUnique({
            where: {
                id: doctorId,
                role: "DOCTOR",
                verificationStatus: "VERIFIED",
            }
        })

        if (!doctor) {
            throw new Error('doctor not found')
        }

        return {doctor}
    } catch (error) {
        console.error("Failed to fetch doctor:", error);
        throw new Error("Failed to fetch doctor details");
    }
}

export async function getAvailableTimeSlots(doctorId) {
    try {
        const doctor = await db.user.findUnique({
            where: {
                id: doctorId,
                role: "DOCTOR",
                verificationStatus: "VERIFIED",
            }
        })

        if (!doctor) {
            throw new Error('doctor not found')
        }

        const availability = await db.availability.findFirst({
            where: {
              doctorId: doctor.id,
              status: "AVAILABLE",
            },
          });
      
          if (!availability) {
            throw new Error("No availability set by doctor");
        }
        
        const now = new Date();
        const days = [now, addDays(now, 1), addDays(now, 2), addDays(now, 3)];
    
        // Fetch existing appointments for the doctor over the next 4 days
        const lastDay = endOfDay(days[3]);

        const existingAppointments = await db.appointment.findMany({
            where: {
              doctorId: doctor.id,
              status: "SCHEDULED",
              startTime: {
                lte: lastDay,
              },
            },
          });
      
        const availableSlotsByDay = {};
        
        for (const day of days) {
            const dayString = format(day, "yyyy-MM-dd");
            availableSlotsByDay[dayString] = [];
      
            // Create a copy of the availability start/end times for this day
            const availabilityStart = new Date(availability.startTime);
            const availabilityEnd = new Date(availability.endTime);
      
            // Set the day to the current day we're processing
            availabilityStart.setFullYear(
              day.getFullYear(),
              day.getMonth(),
              day.getDate()
            );
            availabilityEnd.setFullYear(
              day.getFullYear(),
              day.getMonth(),
              day.getDate()
            );

            let current = new Date(availabilityStart);
            const end = new Date(availabilityEnd);

            while (
                isBefore(addMinutes(current, 30), end) ||
                +addMinutes(current, 30) === +end
              ) {
                const next = addMinutes(current, 30);
        
                // Skip past slots
                if (isBefore(current, now)) {
                  current = next;
                  continue;
                }
        
                const overlaps = existingAppointments.some((appointment) => {
                  const aStart = new Date(appointment.startTime);
                  const aEnd = new Date(appointment.endTime);
        
                  return (
                    (current >= aStart && current < aEnd) ||
                    (next > aStart && next <= aEnd) ||
                    (current <= aStart && next >= aEnd)
                  );
                });
        
                if (!overlaps) {
                    availableSlotsByDay[dayString].push({
                      startTime: current.toISOString(),
                      endTime: next.toISOString(),
                      formatted: `${format(current, "h:mm a")} - ${format(
                        next,
                        "h:mm a"
                      )}`,
                      day: format(current, "EEEE, MMMM d"),
                    });
                  }
          
                  current = next;
                }
        }
        
        const result = Object.entries(availableSlotsByDay).map(([date, slots]) => ({
            date,
            displayDate:
              slots.length > 0
                ? slots[0].day
                : format(new Date(date), "EEEE, MMMM d"),
            slots,
          }));
      
        return { days: result };
        

    } catch (error) {
        console.error("Failed to fetch available slots:", error);
        throw new Error("Failed to fetch available time slots: " + error.message);
    }
}