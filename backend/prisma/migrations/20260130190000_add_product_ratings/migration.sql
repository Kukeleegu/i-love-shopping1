-- AlterTable
ALTER TABLE "products" ADD COLUMN "average_rating" DECIMAL(3,2);
ALTER TABLE "products" ADD COLUMN "rating_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "product_ratings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_average_rating_idx" ON "products"("average_rating");

-- CreateIndex
CREATE UNIQUE INDEX "product_ratings_user_id_product_id_key" ON "product_ratings"("user_id", "product_id");

-- CreateIndex
CREATE INDEX "product_ratings_product_id_idx" ON "product_ratings"("product_id");

-- AddForeignKey
ALTER TABLE "product_ratings" ADD CONSTRAINT "product_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_ratings" ADD CONSTRAINT "product_ratings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
