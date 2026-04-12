/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Academy` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Academy_name_key" ON "Academy"("name");
