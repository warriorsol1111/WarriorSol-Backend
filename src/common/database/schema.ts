import {
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
  text,
  boolean,
} from "drizzle-orm/pg-core";

export const launchMailsTable = pgTable("launch_mails", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  email: varchar({ length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  cartId: varchar("cart_id", { length: 255 }),
  status: varchar("status", {
    enum: ["active", "suspended", "deactivated", "pending"],
  })
    .notNull()
    .default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const verificationCodes = pgTable("verification_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id),
  code: text("code").notNull(),
  type: varchar("type", {
    enum: ["email", "password_reset", "forget_password"],
  }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  isUsed: boolean("is_used").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});
