-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "table_status" AS ENUM ('AVAILABLE', 'OCCUPIED', 'NEEDS_CLEANING');

-- CreateEnum
CREATE TYPE "table_session_status" AS ENUM ('ACTIVE', 'BILL_REQUESTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "station_type" AS ENUM ('KITCHEN', 'BAR', 'PASTRY');

-- CreateEnum
CREATE TYPE "modifier_selection_type" AS ENUM ('SINGLE', 'MULTIPLE');

-- CreateEnum
CREATE TYPE "ingredient_unit" AS ENUM ('GRAM', 'ML', 'PIECE', 'PACK', 'SLICE');

-- CreateEnum
CREATE TYPE "staff_role" AS ENUM ('ADMIN', 'CASHIER', 'KITCHEN', 'WAITER');

-- CreateEnum
CREATE TYPE "order_type" AS ENUM ('DINE_IN', 'TAKEAWAY');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('PENDING_PAYMENT', 'WAITING_CASHIER_APPROVAL', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "order_item_status" AS ENUM ('QUEUED', 'COOKING', 'READY', 'SERVED', 'VOIDED');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('QRIS_DYNAMIC', 'VIRTUAL_ACCOUNT', 'MANUAL_TRANSFER', 'CASH', 'EDC_CARD');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "waiter_call_type" AS ENUM ('WATER_TISSUE', 'CLEAN_TABLE', 'ASK_MENU', 'REQUEST_BILL');

-- CreateEnum
CREATE TYPE "waiter_call_status" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "cashier_shift_status" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "cash_drawer_log_type" AS ENUM ('OPENING_FLOAT', 'CASH_IN', 'CASH_OUT', 'SALE', 'REFUND', 'CLOSING_COUNT', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "floor" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tables" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "tableNumber" TEXT NOT NULL,
    "qrSlug" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "status" "table_status" NOT NULL DEFAULT 'AVAILABLE',
    "currentPin" TEXT,
    "pinEnabled" BOOLEAN NOT NULL DEFAULT false,
    "positionX" INTEGER,
    "positionY" INTEGER,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_sessions" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "status" "table_session_status" NOT NULL DEFAULT 'ACTIVE',
    "guestCount" INTEGER NOT NULL DEFAULT 1,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "sessionTokenHash" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "table_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "basePrice" INTEGER NOT NULL,
    "costPrice" INTEGER NOT NULL DEFAULT 0,
    "station" "station_type" NOT NULL DEFAULT 'KITCHEN',
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isBestSeller" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prepTimeMinutes" INTEGER NOT NULL DEFAULT 10,
    "availableFrom" VARCHAR(5),
    "availableUntil" VARCHAR(5),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifier_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "selectionType" "modifier_selection_type" NOT NULL DEFAULT 'SINGLE',
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "minSelect" INTEGER NOT NULL DEFAULT 0,
    "maxSelect" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modifier_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifier_options" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceDelta" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modifier_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unit" "ingredient_unit" NOT NULL,
    "currentStock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "minThreshold" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "costPerUnit" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRestockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_recipes" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "role" "staff_role" NOT NULL DEFAULT 'CASHIER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "orderType" "order_type" NOT NULL DEFAULT 'DINE_IN',
    "status" "order_status" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "tableSessionId" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "subtotal" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "serviceCharge" INTEGER NOT NULL DEFAULT 0,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "uniqueCode" INTEGER NOT NULL DEFAULT 0,
    "grandTotal" INTEGER NOT NULL,
    "notes" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "menuName" TEXT NOT NULL,
    "station" "station_type" NOT NULL DEFAULT 'KITCHEN',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "modifierTotal" INTEGER NOT NULL DEFAULT 0,
    "modifiers" JSONB,
    "notes" TEXT,
    "status" "order_item_status" NOT NULL DEFAULT 'QUEUED',
    "voidReason" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cookingAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "servedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" "payment_method" NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "amountPaid" INTEGER NOT NULL,
    "changeAmount" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT,
    "gatewayRefId" TEXT,
    "gatewayPayload" JSONB,
    "proofImageUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "cashierId" TEXT,
    "shiftId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cashier_shifts" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "status" "cashier_shift_status" NOT NULL DEFAULT 'OPEN',
    "startingCash" INTEGER NOT NULL,
    "expectedCash" INTEGER NOT NULL DEFAULT 0,
    "actualEndingCash" INTEGER,
    "variance" INTEGER,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cashier_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_drawer_logs" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "type" "cash_drawer_log_type" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "orderId" TEXT,
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_drawer_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waiter_calls" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "tableSessionId" TEXT,
    "type" "waiter_call_type" NOT NULL,
    "status" "waiter_call_status" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waiter_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MenuItemToModifierGroup" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MenuItemToModifierGroup_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "areas_slug_key" ON "areas"("slug");

-- CreateIndex
CREATE INDEX "areas_floor_idx" ON "areas"("floor");

-- CreateIndex
CREATE INDEX "areas_isActive_idx" ON "areas"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "tables_qrSlug_key" ON "tables"("qrSlug");

-- CreateIndex
CREATE INDEX "tables_status_idx" ON "tables"("status");

-- CreateIndex
CREATE INDEX "tables_areaId_isActive_idx" ON "tables"("areaId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "tables_areaId_tableNumber_key" ON "tables"("areaId", "tableNumber");

-- CreateIndex
CREATE UNIQUE INDEX "table_sessions_sessionTokenHash_key" ON "table_sessions"("sessionTokenHash");

-- CreateIndex
CREATE INDEX "table_sessions_tableId_status_idx" ON "table_sessions"("tableId", "status");

-- CreateIndex
CREATE INDEX "table_sessions_status_openedAt_idx" ON "table_sessions"("status", "openedAt");

-- CreateIndex
CREATE INDEX "table_sessions_lastActivityAt_idx" ON "table_sessions"("lastActivityAt");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_isActive_sortOrder_idx" ON "categories"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_slug_key" ON "menu_items"("slug");

-- CreateIndex
CREATE INDEX "menu_items_categoryId_isActive_sortOrder_idx" ON "menu_items"("categoryId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "menu_items_station_idx" ON "menu_items"("station");

-- CreateIndex
CREATE INDEX "menu_items_isAvailable_idx" ON "menu_items"("isAvailable");

-- CreateIndex
CREATE INDEX "modifier_groups_isActive_sortOrder_idx" ON "modifier_groups"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "modifier_options_groupId_sortOrder_idx" ON "modifier_options"("groupId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_sku_key" ON "ingredients"("sku");

-- CreateIndex
CREATE INDEX "ingredients_isActive_idx" ON "ingredients"("isActive");

-- CreateIndex
CREATE INDEX "menu_recipes_ingredientId_idx" ON "menu_recipes"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "menu_recipes_menuItemId_ingredientId_key" ON "menu_recipes"("menuItemId", "ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_email_key" ON "staff"("email");

-- CreateIndex
CREATE INDEX "staff_role_isActive_idx" ON "staff"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "orders_tableSessionId_idx" ON "orders"("tableSessionId");

-- CreateIndex
CREATE INDEX "orders_orderType_createdAt_idx" ON "orders"("orderType", "createdAt");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "order_items_status_station_idx" ON "order_items"("status", "station");

-- CreateIndex
CREATE INDEX "order_items_queuedAt_idx" ON "order_items"("queuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gatewayRefId_key" ON "payments"("gatewayRefId");

-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "payments_status_method_idx" ON "payments"("status", "method");

-- CreateIndex
CREATE INDEX "payments_shiftId_idx" ON "payments"("shiftId");

-- CreateIndex
CREATE INDEX "cashier_shifts_staffId_status_idx" ON "cashier_shifts"("staffId", "status");

-- CreateIndex
CREATE INDEX "cashier_shifts_openedAt_idx" ON "cashier_shifts"("openedAt");

-- CreateIndex
CREATE INDEX "cash_drawer_logs_shiftId_createdAt_idx" ON "cash_drawer_logs"("shiftId", "createdAt");

-- CreateIndex
CREATE INDEX "waiter_calls_status_createdAt_idx" ON "waiter_calls"("status", "createdAt");

-- CreateIndex
CREATE INDEX "waiter_calls_tableId_createdAt_idx" ON "waiter_calls"("tableId", "createdAt");

-- CreateIndex
CREATE INDEX "_MenuItemToModifierGroup_B_index" ON "_MenuItemToModifierGroup"("B");

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modifier_options" ADD CONSTRAINT "modifier_options_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_recipes" ADD CONSTRAINT "menu_recipes_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_recipes" ADD CONSTRAINT "menu_recipes_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "table_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "cashier_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_drawer_logs" ADD CONSTRAINT "cash_drawer_logs_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "cashier_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_drawer_logs" ADD CONSTRAINT "cash_drawer_logs_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiter_calls" ADD CONSTRAINT "waiter_calls_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiter_calls" ADD CONSTRAINT "waiter_calls_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "table_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiter_calls" ADD CONSTRAINT "waiter_calls_resolvedByStaffId_fkey" FOREIGN KEY ("resolvedByStaffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MenuItemToModifierGroup" ADD CONSTRAINT "_MenuItemToModifierGroup_A_fkey" FOREIGN KEY ("A") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MenuItemToModifierGroup" ADD CONSTRAINT "_MenuItemToModifierGroup_B_fkey" FOREIGN KEY ("B") REFERENCES "modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

