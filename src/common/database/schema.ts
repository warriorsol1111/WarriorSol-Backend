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
  passwordHash: text("password_hash"), // now nullable
  name: varchar("name", { length: 255 }).notNull(),
  cartId: varchar("cart_id", { length: 255 }),
  authProvider: varchar("auth_provider", {
    enum: ["credentials", "google"],
  })
    .notNull()
    .default("credentials"),
  status: varchar("status", {
    enum: ["active", "suspended", "deactivated", "pending"],
  })
    .notNull()
    .default("pending"),
  role: varchar("role", {
    enum: ["user", "admin"],
  }).default("user"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const verificationCodes = pgTable("verification_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),

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

export const userStoriesTable = pgTable("user_stories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id),
  userName: varchar("user_name", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  attachment: varchar("attachment", { length: 255 }),
  userType: varchar("user_type", {
    enum: [
      "warrior",
      "spouse",
      "bloodline",
      "caregiver",
      "guardian",
      "griever",
      "supporter",
    ],
  })
    .notNull()
    .default("warrior"),
  status: varchar("status", {
    enum: ["pending", "approved", "rejected"],
  })
    .notNull()
    .default("pending"),
  isAnonymous: boolean("is_anonymous").default(false).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const wishlistTable = pgTable("wishlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  variantId: varchar("variant_id", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
