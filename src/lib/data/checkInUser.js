import { db } from "./prisma";
import { currentUser } from "@clerk/nextjs/server";
export async function CheckInUser(params) {
    const user = await currentUser()
    if (!user) {
        return null
    }

    try {
        const loggedInUser = await db.user.findUnique({
            where: {
                clerkUserId: user.id
            },
            include: {
                transactions: {
                    type: "CREDIT_PURCHASE",
                    createdAt: {
                        gte: new Date(new Date.getFullYear(), new Date().getMonth(), 1)
                    }
                },
                orderBy: {
                    createdAt: "desc"
                },
                take: 1
                
            }
        })

        if (loggedInUser) {
            return loggedInUser
        }

        const newUser = await db.user.create({
            data: {
              clerkUserId: user.id,
              name,
              imageUrl: user.imageUrl,
              email: user.emailAddresses[0].emailAddress,
              transactions: {
                create: {
                  type: "CREDIT_PURCHASE",
                  packageId: "free_user",
                  amount: 0,
                },
              },
            },
        });
        
        return newUser
    } catch (error) {
        console.log(error.message);
    }
}