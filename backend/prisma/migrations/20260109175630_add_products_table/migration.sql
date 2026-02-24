-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(15,2) NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "images" TEXT[],
    "weightKg" DECIMAL(10,3),
    "weightLbs" DECIMAL(10,3),
    "length_cm" DECIMAL(10,2),
    "width_cm" DECIMAL(10,2),
    "height_cm" DECIMAL(10,2),
    "length_in" DECIMAL(10,2),
    "width_in" DECIMAL(10,2),
    "height_in" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);
