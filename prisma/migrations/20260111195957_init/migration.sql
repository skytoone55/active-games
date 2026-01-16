-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT NOT NULL,
    "maxConcurrentPlayers" INTEGER NOT NULL DEFAULT 80,
    "slotMinutes" INTEGER NOT NULL DEFAULT 15,
    "gameDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "eventRoomDurationMinutes" INTEGER NOT NULL DEFAULT 120,
    "eventGameDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 30,
    "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 30,
    "minEventParticipants" INTEGER NOT NULL DEFAULT 15,
    "eventRoomId" TEXT,
    "eventRoomCapacity" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "settings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'GAME',
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "startDateTime" DATETIME NOT NULL,
    "participantsCount" INTEGER NOT NULL,
    "customerFirstName" TEXT NOT NULL,
    "customerLastName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "bookings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "booking_slots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "slotStartDateTime" DATETIME NOT NULL,
    "participantsCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "booking_slots_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "booking_slots_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "deposits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "amount" REAL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "deposits_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "settings_branchId_key" ON "settings"("branchId");

-- CreateIndex
CREATE INDEX "bookings_branchId_startDateTime_idx" ON "bookings"("branchId", "startDateTime");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "booking_slots_branchId_slotStartDateTime_idx" ON "booking_slots"("branchId", "slotStartDateTime");

-- CreateIndex
CREATE UNIQUE INDEX "booking_slots_branchId_slotStartDateTime_bookingId_key" ON "booking_slots"("branchId", "slotStartDateTime", "bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "deposits_bookingId_key" ON "deposits"("bookingId");
