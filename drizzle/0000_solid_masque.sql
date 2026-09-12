CREATE TABLE `paper_states` (
	`paper_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'unseen' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `papers` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`abstract` text DEFAULT '' NOT NULL,
	`primary_url` text NOT NULL,
	`authors_json` text DEFAULT '[]' NOT NULL,
	`published_at` text NOT NULL,
	`sources_json` text DEFAULT '[]' NOT NULL,
	`categories_json` text DEFAULT '[]' NOT NULL,
	`identifiers_json` text DEFAULT '{}' NOT NULL,
	`frontier_score` integer DEFAULT 0 NOT NULL,
	`personalized_score` integer DEFAULT 0 NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_papers_published_at` ON `papers` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_papers_frontier_score` ON `papers` (`frontier_score`);--> statement-breakpoint
CREATE INDEX `idx_papers_personalized_score` ON `papers` (`personalized_score`);