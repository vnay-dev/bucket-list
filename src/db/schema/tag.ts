import { pgTable, text, uuid } from "drizzle-orm/pg-core";

export const tag = pgTable("tag", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
});
