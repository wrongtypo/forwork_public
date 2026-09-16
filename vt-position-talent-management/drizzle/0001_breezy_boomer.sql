ALTER TABLE `org_nodes` ADD `duties` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `positions` ADD `confirmation_status` text DEFAULT '待確認' NOT NULL;--> statement-breakpoint
ALTER TABLE `positions` ADD `confirmed_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `positions` ADD `confirmed_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `positions` ADD `confirmation_note` text DEFAULT '' NOT NULL;