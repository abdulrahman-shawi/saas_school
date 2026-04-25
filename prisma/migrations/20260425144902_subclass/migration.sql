-- CreateTable
CREATE TABLE "ClassroomCourse" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomCourse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassroomCourse_academyId_courseId_idx" ON "ClassroomCourse"("academyId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassroomCourse_academyId_classroomId_courseId_key" ON "ClassroomCourse"("academyId", "classroomId", "courseId");

-- AddForeignKey
ALTER TABLE "ClassroomCourse" ADD CONSTRAINT "ClassroomCourse_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "Academy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomCourse" ADD CONSTRAINT "ClassroomCourse_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomCourse" ADD CONSTRAINT "ClassroomCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
