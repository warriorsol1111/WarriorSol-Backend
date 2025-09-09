import { unique } from "drizzle-orm/pg-core";
import {
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
  text,
  boolean,
  numeric,
} from "drizzle-orm/pg-core";

export const launchMailsTable = pgTable(
  "launch_mails",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    email: varchar({ length: 255 }).notNull(),
    site: varchar({ length: 100 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      emailPerSite: unique().on(table.email, table.site), // allows same email across sites, but unique within one
    };
  }
);

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"),
  name: varchar("name", { length: 255 }).notNull(),
  cartId: varchar("cart_id", { length: 255 }),
  profilePhoto: varchar("profile_photo", { length: 1000 }),
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
  isArchived: boolean("is_archived").default(false).notNull(),

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

export const newsletterMailsTable = pgTable("newsletter_mails", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  email: varchar({ length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const donationsTable = pgTable("donations", {
  id: uuid("id").primaryKey().defaultRandom(),

  userId: uuid("user_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),

  stripeSessionId: varchar("stripe_session_id", { length: 255 }),
  stripeInvoiceId: varchar("stripe_invoice_id", { length: 255 }).unique(),
  stripeReceiptUrl: varchar("stripe_receipt_url", { length: 1024 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),

  name: varchar("name", { length: 255 }).notNull().default("Recurring Donor"),
  email: varchar("email", { length: 255 }).notNull(),

  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("usd"),

  donationType: varchar("donation_type", {
    enum: ["one-time", "monthly"], // use "monthly" instead of "recurring"
  }).notNull(),

  status: varchar("status", {
    enum: ["succeeded", "pending", "failed", "paid"],
  })
    .notNull()
    .default("succeeded"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const supportApplicationsTable = pgTable("support_applications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  familyName: varchar("family_name", { length: 256 }).notNull(),
  contactEmail: varchar("contact_email", { length: 256 }).notNull(),
  contactPhone: varchar("contact_phone", { length: 20 }),
  familySize: integer("family_size").notNull(),
  supportType: text("support_type").notNull(),
  requestedAmount: numeric("requested_amount", {
    precision: 10,
    scale: 2,
  }).notNull(),
  situation: text("situation").notNull(),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ordersTable = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  shopifyOrderId: varchar("shopify_order_id", { length: 255 }),
  shopifyOrderName: varchar("shopify_order_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => usersTable.id)
      .notNull(),
    productId: varchar("product_id", { length: 255 }).notNull(),
    score: integer("score").notNull(),
    review: text("review").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueReviewPerProduct: unique().on(table.userId, table.productId),
  })
);

export const tashaDonationsTable = pgTable("tasha_donations", {
  id: uuid("id").primaryKey().defaultRandom(),

  userId: uuid("user_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),

  stripeSessionId: varchar("stripe_session_id", { length: 255 }),
  stripeInvoiceId: varchar("stripe_invoice_id", { length: 255 }).unique(),
  stripeReceiptUrl: varchar("stripe_receipt_url", { length: 1024 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),

  name: varchar("name", { length: 255 }).notNull().default("Recurring Donor"),
  email: varchar("email", { length: 255 }).notNull(),

  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("usd"),

  donationType: varchar("donation_type", {
    enum: ["one-time", "monthly"], // use "monthly" instead of "recurring"
  }).notNull(),

  status: varchar("status", {
    enum: ["succeeded", "pending", "failed", "paid"],
  })
    .notNull()
    .default("succeeded"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const tashaSupportApplicationsTable = pgTable(
  "tasha_support_applications",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    familyName: varchar("family_name", { length: 256 }).notNull(),
    contactEmail: varchar("contact_email", { length: 256 }).notNull(),
    contactPhone: varchar("contact_phone", { length: 20 }),
    familySize: integer("family_size").notNull(),
    supportType: text("support_type").notNull(),
    requestedAmount: numeric("requested_amount", {
      precision: 10,
      scale: 2,
    }).notNull(),
    situation: text("situation").notNull(),
    status: text("status").default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }
);
