-- Remove RLS from users (now a platform table) — must happen before dropping tenant_id
DROP POLICY IF EXISTS tenant_isolation_users ON users;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_role_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_tenant_id_fkey";

-- DropIndex
DROP INDEX "users_tenant_id_email_key";

-- DropIndex
DROP INDEX "users_tenant_id_idx";

-- DropIndex
DROP INDEX "users_tenant_id_role_id_idx";

-- DropIndex
DROP INDEX "users_tenant_id_username_key";

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "membership_id" TEXT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "abilities",
DROP COLUMN "role_id",
DROP COLUMN "tenant_id",
ADD COLUMN     "avatar_url" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
