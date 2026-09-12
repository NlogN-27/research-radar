import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const papers = sqliteTable("papers", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  abstract: text("abstract").notNull().default(""),
  primaryUrl: text("primary_url").notNull(),
  authorsJson: text("authors_json").notNull().default("[]"),
  publishedAt: text("published_at").notNull(),
  sourcesJson: text("sources_json").notNull().default("[]"),
  categoriesJson: text("categories_json").notNull().default("[]"),
  identifiersJson: text("identifiers_json").notNull().default("{}"),
  frontierScore: integer("frontier_score").notNull().default(0),
  personalizedScore: integer("personalized_score").notNull().default(0),
  reason: text("reason").notNull().default(""),
  fetchedAt: text("fetched_at").notNull(),
}, (table) => [
  index("idx_papers_published_at").on(table.publishedAt),
  index("idx_papers_frontier_score").on(table.frontierScore),
  index("idx_papers_personalized_score").on(table.personalizedScore),
]);

export const paperStates = sqliteTable("paper_states", {
  paperId: text("paper_id").primaryKey(),
  status: text("status", { enum: ["unseen", "saved", "dismissed"] }).notNull().default("unseen"),
  updatedAt: text("updated_at").notNull(),
});
