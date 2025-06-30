import { integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const launchMailsTable = pgTable("launch_mails", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  email: varchar({ length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
