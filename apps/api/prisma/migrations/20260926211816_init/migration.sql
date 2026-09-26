-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ORG_ADMIN', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "CameraDirection" AS ENUM ('ENTRY', 'EXIT', 'BOTH');

-- CreateEnum
CREATE TYPE "CameraSourceType" AS ENUM ('RTSP', 'WEBCAM', 'KIOSK');

-- CreateEnum
CREATE TYPE "CameraStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('GRANTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('NOT_ENROLLED', 'ENROLLED', 'NEEDS_REENROLL');

-- CreateEnum
CREATE TYPE "AttendanceEventType" AS ENUM ('ENTRY', 'EXIT');

-- CreateEnum
CREATE TYPE "AttendanceEventSource" AS ENUM ('CAMERA', 'KIOSK', 'MANUAL', 'CORRECTION');

-- CreateEnum
CREATE TYPE "AttendanceEventFlag" AS ENUM ('CLOCK_SKEW', 'LOW_CONFIDENCE');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'ON_LEAVE', 'HOLIDAY', 'WEEKLY_OFF');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('CASUAL', 'SICK', 'EARNED', 'UNPAID', 'OTHER');

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "replacedById" UUID,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "graceMinutes" INTEGER NOT NULL DEFAULT 0,
    "halfDayMinutes" INTEGER NOT NULL,
    "fullDayMinutes" INTEGER NOT NULL,
    "workDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "workEmail" TEXT,
    "departmentId" UUID,
    "defaultShiftId" UUID,
    "userId" UUID,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedOn" DATE NOT NULL,
    "terminatedOn" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Camera" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "direction" "CameraDirection" NOT NULL,
    "sourceType" "CameraSourceType" NOT NULL,
    "streamUrlCiphertext" BYTEA,
    "status" "CameraStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastHeartbeatAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Camera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiometricProfile" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "consentStatus" "ConsentStatus",
    "consentVersion" TEXT,
    "consentGivenAt" TIMESTAMPTZ(3),
    "consentRevokedAt" TIMESTAMPTZ(3),
    "enrollmentStatus" "EnrollmentStatus" NOT NULL DEFAULT 'NOT_ENROLLED',
    "enrolledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BiometricProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaceTemplate" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "keyVersion" INTEGER NOT NULL,
    "modelName" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "qualityScore" REAL NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "type" "AttendanceEventType" NOT NULL,
    "source" "AttendanceEventSource" NOT NULL,
    "cameraId" UUID,
    "confidence" REAL,
    "livenessScore" REAL,
    "capturedAt" TIMESTAMPTZ(3) NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT NOT NULL,
    "createdByUserId" UUID,
    "correctionId" UUID,
    "flags" "AttendanceEventFlag"[] DEFAULT ARRAY[]::"AttendanceEventFlag"[],
    "voidedAt" TIMESTAMPTZ(3),
    "voidReason" TEXT,

    CONSTRAINT "AttendanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "workDate" DATE NOT NULL,
    "shiftId" UUID,
    "status" "AttendanceStatus" NOT NULL,
    "firstInAt" TIMESTAMPTZ(3),
    "lastOutAt" TIMESTAMPTZ(3),
    "workedMinutes" INTEGER NOT NULL DEFAULT 0,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "earlyLeaveMinutes" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCorrection" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "workDate" DATE NOT NULL,
    "requestedType" "AttendanceEventType" NOT NULL,
    "requestedTime" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" UUID NOT NULL,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AttendanceCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isHalfDay" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "actorUserId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "requestId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "User_organizationId_id_key" ON "User"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_organizationId_id_key" ON "Department"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Department_organizationId_name_key" ON "Department"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_organizationId_id_key" ON "Shift"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_organizationId_name_key" ON "Shift"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_organizationId_date_key" ON "Holiday"("organizationId", "date");

-- CreateIndex
CREATE INDEX "Employee_organizationId_status_idx" ON "Employee"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Employee_organizationId_departmentId_idx" ON "Employee"("organizationId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_organizationId_id_key" ON "Employee"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_organizationId_employeeCode_key" ON "Employee"("organizationId", "employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_organizationId_userId_key" ON "Employee"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Camera_organizationId_id_key" ON "Camera"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Camera_organizationId_name_key" ON "Camera"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "BiometricProfile_organizationId_id_key" ON "BiometricProfile"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "BiometricProfile_organizationId_employeeId_key" ON "BiometricProfile"("organizationId", "employeeId");

-- CreateIndex
CREATE INDEX "FaceTemplate_organizationId_idx" ON "FaceTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "FaceTemplate_profileId_idx" ON "FaceTemplate"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceEvent_correctionId_key" ON "AttendanceEvent"("correctionId");

-- CreateIndex
CREATE INDEX "AttendanceEvent_organizationId_employeeId_capturedAt_idx" ON "AttendanceEvent"("organizationId", "employeeId", "capturedAt");

-- CreateIndex
CREATE INDEX "AttendanceEvent_organizationId_capturedAt_idx" ON "AttendanceEvent"("organizationId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceEvent_organizationId_idempotencyKey_key" ON "AttendanceEvent"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AttendanceRecord_organizationId_workDate_status_idx" ON "AttendanceRecord"("organizationId", "workDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_employeeId_workDate_key" ON "AttendanceRecord"("employeeId", "workDate");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_organizationId_status_createdAt_idx" ON "AttendanceCorrection"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_employeeId_workDate_idx" ON "AttendanceCorrection"("employeeId", "workDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_organizationId_status_idx" ON "LeaveRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_startDate_idx" ON "LeaveRequest"("employeeId", "startDate");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_organizationId_departmentId_fkey" FOREIGN KEY ("organizationId", "departmentId") REFERENCES "Department"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_organizationId_defaultShiftId_fkey" FOREIGN KEY ("organizationId", "defaultShiftId") REFERENCES "Shift"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_organizationId_userId_fkey" FOREIGN KEY ("organizationId", "userId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Camera" ADD CONSTRAINT "Camera_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricProfile" ADD CONSTRAINT "BiometricProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricProfile" ADD CONSTRAINT "BiometricProfile_organizationId_employeeId_fkey" FOREIGN KEY ("organizationId", "employeeId") REFERENCES "Employee"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceTemplate" ADD CONSTRAINT "FaceTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceTemplate" ADD CONSTRAINT "FaceTemplate_organizationId_profileId_fkey" FOREIGN KEY ("organizationId", "profileId") REFERENCES "BiometricProfile"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_organizationId_employeeId_fkey" FOREIGN KEY ("organizationId", "employeeId") REFERENCES "Employee"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_organizationId_cameraId_fkey" FOREIGN KEY ("organizationId", "cameraId") REFERENCES "Camera"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_correctionId_fkey" FOREIGN KEY ("correctionId") REFERENCES "AttendanceCorrection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_organizationId_employeeId_fkey" FOREIGN KEY ("organizationId", "employeeId") REFERENCES "Employee"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_organizationId_shiftId_fkey" FOREIGN KEY ("organizationId", "shiftId") REFERENCES "Shift"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_organizationId_employeeId_fkey" FOREIGN KEY ("organizationId", "employeeId") REFERENCES "Employee"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_organizationId_employeeId_fkey" FOREIGN KEY ("organizationId", "employeeId") REFERENCES "Employee"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- CHECK constraints (hand-written: Prisma cannot express these).
-- They are the last line of defence if application validation has a bug.
-- ─────────────────────────────────────────────────────────────

-- Only the platform super admin exists outside an organization.
ALTER TABLE "User" ADD CONSTRAINT "User_role_organization_check"
  CHECK (("role" = 'SUPER_ADMIN') = ("organizationId" IS NULL));

ALTER TABLE "User" ADD CONSTRAINT "User_email_lowercase_check"
  CHECK ("email" = lower("email"));

ALTER TABLE "Shift" ADD CONSTRAINT "Shift_minutes_check"
  CHECK ("startMinute" BETWEEN 0 AND 1439
     AND "endMinute" BETWEEN 0 AND 1439
     AND "graceMinutes" >= 0
     AND "halfDayMinutes" > 0
     AND "fullDayMinutes" >= "halfDayMinutes");

ALTER TABLE "Shift" ADD CONSTRAINT "Shift_workDays_check"
  CHECK ("workDays" <@ ARRAY[1,2,3,4,5,6,7]);

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_termination_check"
  CHECK ("terminatedOn" IS NULL OR "terminatedOn" >= "joinedOn");

ALTER TABLE "FaceTemplate" ADD CONSTRAINT "FaceTemplate_quality_check"
  CHECK ("qualityScore" BETWEEN 0 AND 1);

ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_scores_check"
  CHECK (("confidence" IS NULL OR "confidence" BETWEEN 0 AND 1)
     AND ("livenessScore" IS NULL OR "livenessScore" BETWEEN 0 AND 1));

-- Camera events must reference the camera that produced them.
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_camera_source_check"
  CHECK ("source" <> 'CAMERA' OR "cameraId" IS NOT NULL);

ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_minutes_check"
  CHECK ("workedMinutes" >= 0 AND "lateMinutes" >= 0 AND "earlyLeaveMinutes" >= 0);

ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_dates_check"
  CHECK ("endDate" >= "startDate");
