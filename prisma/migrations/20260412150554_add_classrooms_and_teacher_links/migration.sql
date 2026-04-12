-- CreateTable
CREATE TABLE "Classroom" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassroomTeacher" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomTeacher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Classroom_academyId_name_idx" ON "Classroom"("academyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Classroom_academyId_code_key" ON "Classroom"("academyId", "code");

-- CreateIndex
CREATE INDEX "ClassroomTeacher_academyId_teacherId_idx" ON "ClassroomTeacher"("academyId", "teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassroomTeacher_academyId_classroomId_teacherId_key" ON "ClassroomTeacher"("academyId", "classroomId", "teacherId");

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "Academy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomTeacher" ADD CONSTRAINT "ClassroomTeacher_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "Academy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomTeacher" ADD CONSTRAINT "ClassroomTeacher_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomTeacher" ADD CONSTRAINT "ClassroomTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
