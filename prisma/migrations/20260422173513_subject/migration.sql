/*
  Warnings:

  - A unique constraint covering the columns `[academyId,rollNumber]` on the table `StudentProfile` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ParentProfile" ADD COLUMN     "address" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "profilePicUrl" TEXT;

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "caste" TEXT,
ADD COLUMN     "classroomId" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "height" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "profilePicUrl" TEXT,
ADD COLUMN     "religion" TEXT,
ADD COLUMN     "rollNumber" TEXT,
ADD COLUMN     "weight" TEXT;

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "receiverUserId" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_academyId_createdAt_idx" ON "Message"("academyId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_academyId_senderUserId_idx" ON "Message"("academyId", "senderUserId");

-- CreateIndex
CREATE INDEX "Message_academyId_receiverUserId_idx" ON "Message"("academyId", "receiverUserId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_academyId_rollNumber_key" ON "StudentProfile"("academyId", "rollNumber");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "Academy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverUserId_fkey" FOREIGN KEY ("receiverUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
