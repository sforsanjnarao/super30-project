-- CreateTable
CREATE TABLE "public"."SensorData" (
    "id" SERIAL NOT NULL,
    "deviceId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SensorData_pkey" PRIMARY KEY ("id")
);
