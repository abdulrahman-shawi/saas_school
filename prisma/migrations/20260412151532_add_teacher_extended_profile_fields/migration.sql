-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "currentAddress" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "maritalStatus" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "permanentAddress" TEXT,
ADD COLUMN     "profilePicUrl" TEXT,
ADD COLUMN     "qualification" TEXT,
ADD COLUMN     "workExperience" TEXT;
