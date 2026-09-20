import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { experience } from "./experience";
import { place } from "./place";
import { user } from "./user";

export const submission = pgTable(
  "submission",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    placeId: uuid("place_id")
      .notNull()
      .references(() => place.id, { onDelete: "restrict" }),
    experienceId: uuid("experience_id").references(() => experience.id, {
      onDelete: "set null",
    }),
    content: text("content").notNull(),
    goodToKnow: text("good_to_know"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "submission_status_check",
      sql`${table.status} in ('pending', 'approved', 'rejected')`,
    ),
    index("submission_user_id_idx").on(table.userId),
    index("submission_place_id_idx").on(table.placeId),
    index("submission_experience_id_idx").on(table.experienceId),
    index("submission_status_idx").on(table.status),
  ],
);
