import { index, pgTable, unique, uuid } from "drizzle-orm/pg-core";
import { experience } from "./experience";
import { tag } from "./tag";

export const experienceTag = pgTable(
  "experience_tag",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    experienceId: uuid("experience_id")
      .notNull()
      .references(() => experience.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
  },
  (table) => [
    unique("experience_tag_experience_id_tag_id_unique").on(
      table.experienceId,
      table.tagId,
    ),
    index("experience_tag_experience_id_idx").on(table.experienceId),
    index("experience_tag_tag_id_idx").on(table.tagId),
  ],
);
