import { db } from "./prisma";
import { currentUser } from "@clerk/nextjs/server";

export const CheckInUser = async () => {
    const user = await currentUser();
    // console.log('user', user);

    if (!user) {
        return null;
    }

    try {
        const loggedInUser = await db.user.findUnique({
            where: {
                clerkUserId: user.id
            },
            include: {
                transactions: {
                    where: {
                        type: "CREDIT_PURCHASE",
                        createAt: {
                            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                        }
                    },
                    orderBy: {
                        createAt: "desc"
                    },
                    take: 1
                }
            }
        });

        if (loggedInUser) {
            return loggedInUser;
        }

        console.log('loggedInUser', loggedInUser);

        const name = `${user.firstName} ${user.lastName}`;

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

        console.log('newUser', newUser);

        return newUser;
    } catch (error) {
        console.log('Error:', error.message);
        return null; // Add return here to handle errors properly
    }
}


// import { db } from "./prisma";
// import { currentUser } from "@clerk/nextjs/server";

// export const CheckInUser = async () => {
//     const user = await currentUser()
//     console.log('user', user)
//     if (!user) {
//         return null
//     }

//     try {
//         const loggedInUser = await db.user.findUnique({
//             where: {
//                 clerkUserId: user.id
//             },
//             include: {
//                 transactions: {
//                     type: "CREDIT_PURCHASE",
//                     createdAt: {
//                         gte: new Date(new Date.getFullYear(), new Date().getMonth(), 1)
//                     }
//                 },
//                 orderBy: {
//                     createdAt: "desc"
//                 },
//                 take: 1

//             }
//         })

//         if (loggedInUser) {
//             return loggedInUser
//         }

//         console.log('loggedInUser', loggedInUser)

//         const name = `${user.firstName} ${user.lastName}`;

//         const newUser = await db.user.create({
//             data: {
//                 clerkUserId: user.id,
//                 name,
//                 imageUrl: user.imageUrl,
//                 email: user.emailAddresses[0].emailAddress,
//                 transactions: {
//                     create: {
//                         type: "CREDIT_PURCHASE",
//                         packageId: "free_user",
//                         amount: 0,
//                     },
//                 },
//             },
//         });

//         console.log('newUser', newUser)

//         return newUser
//     } catch (error) {
//         console.log(error.message);
//     }
// }