CREATE TABLE `competencies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT '專業職能' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `org_nodes` ADD `confirmation_status` text DEFAULT '已確認' NOT NULL;--> statement-breakpoint
ALTER TABLE `people` ADD `nationality` text DEFAULT '越籍' NOT NULL;--> statement-breakpoint
ALTER TABLE `people` ADD `gender` text DEFAULT '女' NOT NULL;--> statement-breakpoint
ALTER TABLE `people` ADD `profile_json` text DEFAULT '{}' NOT NULL;