import { check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const user = pgTable(
  "user",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    avatar: text("avatar"),
    role: text("role").notNull().default("user"),
    email: text("email").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("user_role_check", sql`${table.role} in ('user', 'curator')`),
  ],
);
