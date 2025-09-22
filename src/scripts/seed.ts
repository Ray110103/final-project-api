import bcrypt from "bcrypt";
import { PrismaService } from "../modules/prisma/prisma.service";
import { Prisma } from "../generated/prisma";

async function main() {
  const prisma = new PrismaService();

  // Create or find users
  const [tenantUser, normalUser, normalUser2] = await Promise.all([
    prisma.user.upsert({
      where: { email: "tenant1@example.com" },
      update: {},
      create: {
        name: "Tenant One",
        email: "tenant1@example.com",
        password: await bcrypt.hash("password123", 10),
        role: "TENANT",
        isVerified: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "user1@example.com" },
      update: {},
      create: {
        name: "User One",
        email: "user1@example.com",
        password: await bcrypt.hash("password123", 10),
        role: "USER",
        isVerified: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "user2@example.com" },
      update: {},
      create: {
        name: "User Two",
        email: "user2@example.com",
        password: await bcrypt.hash("password123", 10),
        role: "USER",
        isVerified: true,
      },
    }),
  ]);

  // Create or find property for the tenant
  let property = await prisma.property.findFirst({
    where: { title: "Kost Mentari - Test Property", tenantId: tenantUser.id },
  });

  if (!property) {
    property = await prisma.property.create({
      data: {
        title: "Kost Mentari - Test Property",
        slug: "kost-mentari-test",
        status: "ACTIVE",
        description: "Peraturan: Tidak merokok di kamar. Check-in pukul 14:00, check-out pukul 12:00.",
        location: "Jakarta",
        city: "Jakarta",
        address: "Jl. Mentari No. 123",
        latitude: "-6.200000",
        longtitude: "106.816666",
        category: "Kost",
        tenantId: tenantUser.id,
      },
    });
  }

  // Create or find rooms for the property
  let roomA = await prisma.room.findFirst({
    where: { name: "Kamar A - Test", propertyId: property.id },
  });
  if (!roomA) {
    roomA = await prisma.room.create({
      data: {
        name: "Kamar A - Test",
        stock: 10,
        price: new Prisma.Decimal(200000),
        description: "Kamar nyaman untuk 1 orang.",
        propertyId: property.id,
      },
    });
  }

  let roomB = await prisma.room.findFirst({
    where: { name: "Kamar B - Test", propertyId: property.id },
  });
  if (!roomB) {
    roomB = await prisma.room.create({
      data: {
        name: "Kamar B - Test",
        stock: 5,
        price: new Prisma.Decimal(250000),
        description: "Kamar lebih luas untuk 2 orang.",
        propertyId: property.id,
      },
    });
  }

  // Helper to compute totals
  const calcTotal = (price: Prisma.Decimal | number, qty: number, start: Date, end: Date) => {
    const priceNum = Number(price);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return priceNum * days * qty;
  };

  // Dates for transactions
  const now = new Date();
  const startDate1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7); // +7 days
  const endDate1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10); // +10 days

  const startDate2 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3); // +3 days
  const endDate2 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5); // +5 days

  const startDate3 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14); // +14 days
  const endDate3 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 16); // +16 days

  // Seed transactions of various statuses
  // Transactions for Room A
  const t1 = await prisma.transaction.upsert({
    where: { uuid: "11111111-1111-4111-8111-111111111111" },
    update: {},
    create: {
      uuid: "11111111-1111-4111-8111-111111111111",
      userId: normalUser.id,
      username: normalUser.name,
      roomId: roomA.id,
      qty: 1,
      startDate: startDate1,
      endDate: endDate1,
      total: calcTotal(roomA.price, 1, startDate1, endDate1),
      status: "WAITING_FOR_PAYMENT",
      paymentMethod: "MANUAL_TRANSFER",
      expiredAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const t2 = await prisma.transaction.upsert({
    where: { uuid: "22222222-2222-4222-8222-222222222222" },
    update: {},
    create: {
      uuid: "22222222-2222-4222-8222-222222222222",
      userId: normalUser.id,
      username: normalUser.name,
      roomId: roomA.id,
      qty: 2,
      startDate: startDate2,
      endDate: endDate2,
      total: calcTotal(roomA.price, 2, startDate2, endDate2),
      status: "WAITING_FOR_CONFIRMATION",
      paymentMethod: "MANUAL_TRANSFER",
      paymentProof: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    },
  });

  const t3 = await prisma.transaction.upsert({
    where: { uuid: "33333333-3333-4333-8333-333333333333" },
    update: {},
    create: {
      uuid: "33333333-3333-4333-8333-333333333333",
      userId: normalUser2.id,
      username: normalUser2.name,
      roomId: roomA.id,
      qty: 1,
      startDate: startDate3,
      endDate: endDate3,
      total: calcTotal(roomA.price, 1, startDate3, endDate3),
      status: "PAID",
      paymentMethod: "MANUAL_TRANSFER",
    },
  });

  // CANCELLED example (should not hold stock)
  const t4 = await prisma.transaction.upsert({
    where: { uuid: "44444444-4444-4444-8444-444444444444" },
    update: {},
    create: {
      uuid: "44444444-4444-4444-8444-444444444444",
      userId: normalUser.id,
      username: normalUser.name,
      roomId: roomA.id,
      qty: 1,
      startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 20),
      endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 22),
      total: calcTotal(roomA.price, 1, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 20), new Date(now.getFullYear(), now.getMonth(), now.getDate() + 22)),
      status: "CANCELLED",
      paymentMethod: "MANUAL_TRANSFER",
    },
  });

  // EXPIRED example (should not hold stock)
  const t5 = await prisma.transaction.upsert({
    where: { uuid: "55555555-5555-4555-8555-555555555555" },
    update: {},
    create: {
      uuid: "55555555-5555-4555-8555-555555555555",
      userId: normalUser2.id,
      username: normalUser2.name,
      roomId: roomA.id,
      qty: 2,
      startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5),
      endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3),
      total: calcTotal(roomA.price, 2, new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5), new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3)),
      status: "EXPIRED",
      paymentMethod: "MANUAL_TRANSFER",
    },
  });

  // PAYMENT_GATEWAY examples
  const t6 = await prisma.transaction.upsert({
    where: { uuid: "66666666-6666-4666-8666-666666666666" },
    update: {},
    create: {
      uuid: "66666666-6666-4666-8666-666666666666",
      userId: normalUser.id,
      username: normalUser.name,
      roomId: roomA.id,
      qty: 1,
      startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 9),
      endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 11),
      total: calcTotal(roomA.price, 1, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 9), new Date(now.getFullYear(), now.getMonth(), now.getDate() + 11)),
      status: "WAITING_FOR_PAYMENT",
      paymentMethod: "PAYMENT_GATEWAY",
      invoice_url: "https://payment-gateway.example.com/invoice/66666666-6666-4666-8666-666666666666",
      expiredAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const t7 = await prisma.transaction.upsert({
    where: { uuid: "77777777-7777-4777-8777-777777777777" },
    update: {},
    create: {
      uuid: "77777777-7777-4777-8777-777777777777",
      userId: normalUser2.id,
      username: normalUser2.name,
      roomId: roomA.id,
      qty: 2,
      startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
      endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4),
      total: calcTotal(roomA.price, 2, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4)),
      status: "PAID",
      paymentMethod: "PAYMENT_GATEWAY",
      invoice_url: "https://payment-gateway.example.com/invoice/77777777-7777-4777-8777-777777777777",
    },
  });

  // Room B: WAITING_FOR_CONFIRMATION
  const t8 = await prisma.transaction.upsert({
    where: { uuid: "88888888-8888-4888-8888-888888888888" },
    update: {},
    create: {
      uuid: "88888888-8888-4888-8888-888888888888",
      userId: normalUser.id,
      username: normalUser.name,
      roomId: roomB.id,
      qty: 1,
      startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6),
      endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8),
      total: calcTotal(roomB.price, 1, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6), new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8)),
      status: "WAITING_FOR_CONFIRMATION",
      paymentMethod: "MANUAL_TRANSFER",
      paymentProof: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    },
  });

  // Adjust stock per room to reflect current reservations
  // Holds stock: WAITING_FOR_PAYMENT, WAITING_FOR_CONFIRMATION, PAID
  const roomAHeld = 1 /* t1 */ + 2 /* t2 */ + 1 /* t3 */ + 1 /* t6 */ + 2 /* t7 */;
  const roomBHeld = 1 /* t8 */;
  await prisma.room.update({ where: { id: roomA.id }, data: { stock: 10 - roomAHeld } });
  await prisma.room.update({ where: { id: roomB.id }, data: { stock: 5 - roomBHeld } });

  console.log("Seeding complete.");
  console.log("Seeded UUIDs:");
  console.log("WAITING_FOR_PAYMENT:", t1.uuid);
  console.log("WAITING_FOR_CONFIRMATION:", t2.uuid);
  console.log("PAID (manual):", t3.uuid);
  console.log("CANCELLED:", t4.uuid);
  console.log("EXPIRED:", t5.uuid);
  console.log("WAITING_FOR_PAYMENT (gateway):", t6.uuid);
  console.log("PAID (gateway):", t7.uuid);
  console.log("WAITING_FOR_CONFIRMATION (Room B):", t8.uuid);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
