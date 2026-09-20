import { index, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { experience } from "./experience";
import { user } from "./user";

export const wishlist = pgTable(
  "wishlist",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    experienceId: uuid("experience_id")
      .notNull()
      .references(() => experience.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("wishlist_user_id_experience_id_unique").on(
      table.userId,
      table.experienceId,
    ),
    index("wishlist_user_id_idx").on(table.userId),
    index("wishlist_experience_id_idx").on(table.experienceId),
  ],
);
