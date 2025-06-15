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
              role: 'DOCTOR',
              VerificationStatus: "VERIFIED"
          }
      })

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

      const sessionId = await createVideoSession()

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
    const { userId } = await auth()
    if (!userId) {
        throw new Error("Unauthorized");
    }

    try {
        const user = await db.user.findUnique({
            where: {
                clerckUserId: userId
            }
        })

        if (!user) {
            throw new Error("User not found");
        }

        const appointmentId = formData.get('appointmentId')

        const appointment = await db.appointment.findUnique({
            where: {
                id: appointmentId
            }
        })

        
    if (!appointment) {
        throw new Error("Appointment not found");
      }
  
      // Verify the user is either the doctor or the patient for this appointment
      if (appointment.doctorId !== user.id && appointment.patientId !== user.id) {
        throw new Error("You are not authorized to join this call");
        }
        
        if (appointment.status !== 'SCHEDULED') {
            threadId
        }
    } catch (error) {
        
    }
}
