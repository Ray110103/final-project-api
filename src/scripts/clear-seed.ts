import { PrismaService } from "../modules/prisma/prisma.service";

async function main() {
  const prisma = new PrismaService();
  const seededUUIDs = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "33333333-3333-4333-8333-333333333333",
    "44444444-4444-4444-8444-444444444444",
    "55555555-5555-4555-8555-555555555555",
    "66666666-6666-4666-8666-666666666666",
    "77777777-7777-4777-8777-777777777777",
    "88888888-8888-4888-8888-888888888888",
  ];

  const seededUserEmails = [
    "tenant1@example.com",
    "user1@example.com",
    "user2@example.com",
  ];

  try {
    // Delete seeded transactions by known UUIDs (safe, independent of relations)
    await prisma.transaction.deleteMany({ where: { uuid: { in: seededUUIDs } } });

    // Find the seeded property and cascade-delete related data
    const property = await prisma.property.findFirst({
      where: { title: "Kost Mentari - Test Property" },
      select: { id: true },
    });

    if (property) {
      const rooms = await prisma.room.findMany({
        where: { propertyId: property.id },
        select: { id: true },
      });
      const roomIds = rooms.map((r) => r.id);

      if (roomIds.length) {
        // Child tables first
        await prisma.transaction.deleteMany({ where: { roomId: { in: roomIds } } });
        await prisma.roomImage.deleteMany({ where: { roomId: { in: roomIds } } });
        await prisma.roomNonAvailability.deleteMany({ where: { roomId: { in: roomIds } } });
        await prisma.seasonalRate.deleteMany({ where: { roomId: { in: roomIds } } });
      }

      // Property-level child tables
      await prisma.propertyImage.deleteMany({ where: { propertyId: property.id } });
      await prisma.propertyFacility.deleteMany({ where: { propertyId: property.id } });

      // Reviews linked to this property (if any)
      await prisma.review.deleteMany({ where: { propertyId: property.id } });

      // Delete rooms and then property
      await prisma.room.deleteMany({ where: { propertyId: property.id } });
      await prisma.property.delete({ where: { id: property.id } });
    }

    // Finally delete seeded users
    await prisma.user.deleteMany({ where: { email: { in: seededUserEmails } } });

    console.log("Clear seed completed.");
  } catch (e) {
    console.error("Clear seed error:", e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
