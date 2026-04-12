import { PrismaClient, StaffDepartment, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Missing DATABASE_URL in environment variables");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD = "Pass@123";

/**
 * Returns a secure hash for plaintext passwords used in seed records.
 */
async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, 10);
}

/**
 * Creates or updates a tenant user by academy and username.
 */
async function upsertTenantUser(params: {
  academyId: string;
  username: string;
  fullName: string;
  role: UserRole;
  email?: string;
  phone?: string;
}): Promise<{ id: string; academyId: string }> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const user = await prisma.user.upsert({
    where: {
      academyId_username: {
        academyId: params.academyId,
        username: params.username,
      },
    },
    update: {
      fullName: params.fullName,
      role: params.role,
      email: params.email,
      phone: params.phone,
      status: UserStatus.ACTIVE,
      passwordHash,
      mustChangePassword: false,
    },
    create: {
      academyId: params.academyId,
      username: params.username,
      fullName: params.fullName,
      role: params.role,
      email: params.email,
      phone: params.phone,
      status: UserStatus.ACTIVE,
      passwordHash,
      mustChangePassword: false,
    },
    select: {
      id: true,
      academyId: true,
    },
  });

  return user;
}

/**
 * Seeds a complete academy demo dataset with users, profiles, and billing records.
 */
async function main(): Promise<void> {
  const superAdminAcademy = await prisma.academy.upsert({
    where: { code: "admin-academy" },
    update: {
      name: "Super Admin Academy",
      city: "Cairo",
      country: "Egypt",
      timezone: "Africa/Cairo",
      isActive: true,
    },
    create: {
      code: "admin-academy",
      name: "Super Admin Academy",
      city: "Cairo",
      country: "Egypt",
      timezone: "Africa/Cairo",
      isActive: true,
    },
  });

  await upsertTenantUser({
    academyId: superAdminAcademy.id,
    username: "admin",
    fullName: "Super Admin",
    role: UserRole.ACADEMY_ADMIN,
    email: "admin@admin-academy.com",
  });

  const academy = await prisma.academy.upsert({
    where: { code: "demo-academy" },
    update: {
      name: "Demo Training Academy",
      city: "Cairo",
      country: "Egypt",
      timezone: "Africa/Cairo",
      isActive: true,
    },
    create: {
      code: "demo-academy",
      name: "Demo Training Academy",
      city: "Cairo",
      country: "Egypt",
      timezone: "Africa/Cairo",
      isActive: true,
    },
  });

  const branch = await prisma.branch.upsert({
    where: {
      academyId_code: {
        academyId: academy.id,
        code: "MAIN",
      },
    },
    update: {
      name: "Main Branch",
      isActive: true,
    },
    create: {
      academyId: academy.id,
      code: "MAIN",
      name: "Main Branch",
      address: "Nasr City",
      phone: "+201000000000",
      isActive: true,
    },
  });

  const adminUser = await upsertTenantUser({
    academyId: academy.id,
    username: "admin",
    fullName: "Academy Admin",
    role: UserRole.ACADEMY_ADMIN,
    email: "admin@demo-academy.com",
  });

  const teacherUser = await upsertTenantUser({
    academyId: academy.id,
    username: "teacher1",
    fullName: "Teacher One",
    role: UserRole.TEACHER,
    email: "teacher1@demo-academy.com",
  });

  const studentUser = await upsertTenantUser({
    academyId: academy.id,
    username: "student1",
    fullName: "Student One",
    role: UserRole.STUDENT,
    email: "student1@demo-academy.com",
  });

  const parentUser = await upsertTenantUser({
    academyId: academy.id,
    username: "parent1",
    fullName: "Parent One",
    role: UserRole.PARENT,
    email: "parent1@demo-academy.com",
  });

  const staffUser = await upsertTenantUser({
    academyId: academy.id,
    username: "staff1",
    fullName: "Staff One",
    role: UserRole.STAFF,
    email: "staff1@demo-academy.com",
  });

  await prisma.teacherProfile.upsert({
    where: { userId: teacherUser.id },
    update: {
      academyId: academy.id,
      branchId: branch.id,
      teacherCode: "T-001",
      specialization: "Programming",
    },
    create: {
      academyId: academy.id,
      userId: teacherUser.id,
      branchId: branch.id,
      teacherCode: "T-001",
      specialization: "Programming",
    },
  });

  const studentProfile = await prisma.studentProfile.upsert({
    where: { userId: studentUser.id },
    update: {
      academyId: academy.id,
      branchId: branch.id,
      studentCode: "S-001",
    },
    create: {
      academyId: academy.id,
      userId: studentUser.id,
      branchId: branch.id,
      studentCode: "S-001",
    },
  });

  const parentProfile = await prisma.parentProfile.upsert({
    where: { userId: parentUser.id },
    update: {
      academyId: academy.id,
    },
    create: {
      academyId: academy.id,
      userId: parentUser.id,
      occupation: "Engineer",
    },
  });

  await prisma.staffProfile.upsert({
    where: { userId: staffUser.id },
    update: {
      academyId: academy.id,
      branchId: branch.id,
      staffCode: "ST-001",
      department: StaffDepartment.FRONT_DESK,
      positionTitle: "Reception",
    },
    create: {
      academyId: academy.id,
      userId: staffUser.id,
      branchId: branch.id,
      staffCode: "ST-001",
      department: StaffDepartment.FRONT_DESK,
      positionTitle: "Reception",
    },
  });

  await prisma.parentStudentLink.upsert({
    where: {
      academyId_parentId_studentId: {
        academyId: academy.id,
        parentId: parentProfile.id,
        studentId: studentProfile.id,
      },
    },
    update: {
      relation: "Father",
      isPrimary: true,
    },
    create: {
      academyId: academy.id,
      parentId: parentProfile.id,
      studentId: studentProfile.id,
      relation: "Father",
      isPrimary: true,
    },
  });

  const course = await prisma.course.upsert({
    where: {
      academyId_code: {
        academyId: academy.id,
        code: "WEB-101",
      },
    },
    update: {
      name: "Web Development Basics",
      isActive: true,
    },
    create: {
      academyId: academy.id,
      code: "WEB-101",
      name: "Web Development Basics",
      durationHours: 40,
      isActive: true,
    },
  });

  const teacherProfile = await prisma.teacherProfile.findUniqueOrThrow({
    where: {
      userId: teacherUser.id,
    },
  });

  const batch = await prisma.batch.upsert({
    where: {
      academyId_code: {
        academyId: academy.id,
        code: "WEB-101-B1",
      },
    },
    update: {
      title: "Web Dev Batch 1",
      courseId: course.id,
      instructorId: teacherProfile.id,
      branchId: branch.id,
      startDate: new Date("2026-05-01T10:00:00.000Z"),
      endDate: new Date("2026-06-01T10:00:00.000Z"),
    },
    create: {
      academyId: academy.id,
      code: "WEB-101-B1",
      title: "Web Dev Batch 1",
      courseId: course.id,
      instructorId: teacherProfile.id,
      branchId: branch.id,
      startDate: new Date("2026-05-01T10:00:00.000Z"),
      endDate: new Date("2026-06-01T10:00:00.000Z"),
      capacity: 25,
      status: "ACTIVE",
    },
  });

  const enrollment = await prisma.enrollment.upsert({
    where: {
      academyId_studentId_batchId: {
        academyId: academy.id,
        studentId: studentProfile.id,
        batchId: batch.id,
      },
    },
    update: {
      status: "ACTIVE",
    },
    create: {
      academyId: academy.id,
      studentId: studentProfile.id,
      batchId: batch.id,
      status: "ACTIVE",
    },
  });

  const invoice = await prisma.invoice.upsert({
    where: {
      academyId_invoiceNumber: {
        academyId: academy.id,
        invoiceNumber: "INV-1001",
      },
    },
    update: {
      studentId: studentProfile.id,
      enrollmentId: enrollment.id,
      totalAmount: "150.00",
      paidAmount: "50.00",
      dueDate: new Date("2026-06-05T00:00:00.000Z"),
      status: "PARTIALLY_PAID",
    },
    create: {
      academyId: academy.id,
      studentId: studentProfile.id,
      enrollmentId: enrollment.id,
      invoiceNumber: "INV-1001",
      issueDate: new Date("2026-05-01T00:00:00.000Z"),
      dueDate: new Date("2026-06-05T00:00:00.000Z"),
      currency: "USD",
      totalAmount: "150.00",
      paidAmount: "50.00",
      status: "PARTIALLY_PAID",
    },
  });

  await prisma.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });

  await prisma.invoiceItem.createMany({
    data: [
      {
        invoiceId: invoice.id,
        description: "Course Tuition",
        quantity: 1,
        unitPrice: "120.00",
        lineTotal: "120.00",
      },
      {
        invoiceId: invoice.id,
        description: "Registration Fee",
        quantity: 1,
        unitPrice: "30.00",
        lineTotal: "30.00",
      },
    ],
  });

  await prisma.payment.upsert({
    where: {
      academyId_paymentReference: {
        academyId: academy.id,
        paymentReference: "PAY-1001",
      },
    },
    update: {
      invoiceId: invoice.id,
      amount: "50.00",
      receivedByUserId: adminUser.id,
      method: "CASH",
    },
    create: {
      academyId: academy.id,
      invoiceId: invoice.id,
      paymentReference: "PAY-1001",
      amount: "50.00",
      receivedByUserId: adminUser.id,
      method: "CASH",
    },
  });

  console.log("Seed completed successfully.");
  console.log("Demo academy code: demo-academy");
  console.log("Demo users: admin, teacher1, student1, parent1, staff1");
  console.log(`Demo password for all users: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
