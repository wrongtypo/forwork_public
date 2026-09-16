CREATE TABLE `job_descriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`site` text DEFAULT 'VT' NOT NULL,
	`department` text DEFAULT '' NOT NULL,
	`grade` text DEFAULT '' NOT NULL,
	`reports_to` text DEFAULT '待確認' NOT NULL,
	`status` text DEFAULT '訪談前初稿' NOT NULL,
	`version` text DEFAULT '0.1' NOT NULL,
	`effective_date` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`confidentiality` text DEFAULT '人事機密' NOT NULL,
	`confirmation_status` text DEFAULT '待確認' NOT NULL,
	`confirmed_by` text DEFAULT '' NOT NULL,
	`confirmed_at` text DEFAULT '' NOT NULL,
	`confirmation_note` text DEFAULT '' NOT NULL,
	`document_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
ALTER TABLE `positions` ADD `job_description_id` text;
--> statement-breakpoint
CREATE INDEX `idx_positions_job_description` ON `positions` (`job_description_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_job_descriptions_code` ON `job_descriptions` (`code`);
