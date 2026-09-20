import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { place } from "./place";

export const experience = pgTable(
  "experience",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => place.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description"),
    goodToKnow: text("good_to_know"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("experience_place_id_idx").on(table.placeId)],
);
