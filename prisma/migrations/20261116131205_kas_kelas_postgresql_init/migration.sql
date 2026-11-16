DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('ADMIN', 'KETUA', 'SISWA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "IncomeType" AS ENUM ('STUDENT_PAYMENT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Setting" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "openingBalance" INTEGER NOT NULL DEFAULT 0,
  "dailyFee" INTEGER NOT NULL DEFAULT 1000,
  "startDate" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "Student" (
  "id" TEXT NOT NULL, "nis" TEXT NOT NULL, "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true, "creditBalance" INTEGER NOT NULL DEFAULT 0,
  "startDate" TIMESTAMP(3) NOT NULL, "endDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL, "username" TEXT NOT NULL, "passwordHash" TEXT NOT NULL,
  "name" TEXT NOT NULL, "role" "Role" NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
  "studentId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "User_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Holiday" (
  "date" TIMESTAMP(3) NOT NULL, "name" TEXT NOT NULL,
  CONSTRAINT "Holiday_pkey" PRIMARY KEY ("date")
);
CREATE TABLE IF NOT EXISTS "Allocation" (
  "id" TEXT NOT NULL, "studentId" TEXT NOT NULL, "dueDate" TIMESTAMP(3) NOT NULL,
  "amount" INTEGER NOT NULL, "activeKey" TEXT, "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voidedAt" TIMESTAMP(3),
  CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Allocation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Income" (
  "id" TEXT NOT NULL, "type" "IncomeType" NOT NULL, "amount" INTEGER NOT NULL,
  "date" TIMESTAMP(3) NOT NULL, "description" TEXT, "studentId" TEXT,
  "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voidedAt" TIMESTAMP(3), "voidReason" TEXT,
  CONSTRAINT "Income_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Income_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Expense" (
  "id" TEXT NOT NULL, "amount" INTEGER NOT NULL, "date" TIMESTAMP(3) NOT NULL,
  "category" TEXT NOT NULL, "description" TEXT NOT NULL, "proofUrl" TEXT,
  "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voidedAt" TIMESTAMP(3), "voidReason" TEXT,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL, "entityId" TEXT NOT NULL, "before" JSONB, "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "User_studentId_key" ON "User"("studentId");
CREATE UNIQUE INDEX IF NOT EXISTS "Student_nis_key" ON "Student"("nis");
CREATE INDEX IF NOT EXISTS "Student_name_idx" ON "Student"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Allocation_activeKey_key" ON "Allocation"("activeKey");
CREATE INDEX IF NOT EXISTS "Allocation_studentId_dueDate_idx" ON "Allocation"("studentId", "dueDate");
CREATE INDEX IF NOT EXISTS "Income_date_idx" ON "Income"("date");
CREATE INDEX IF NOT EXISTS "Expense_date_idx" ON "Expense"("date");
CREATE INDEX IF NOT EXISTS "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
