CREATE TABLE `job_description_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`master_id` text NOT NULL,
	`revision` integer NOT NULL,
	`version` text NOT NULL,
	`status` text NOT NULL,
	`effective_date` text DEFAULT '' NOT NULL,
	`expired_date` text DEFAULT '' NOT NULL,
	`record_json` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_jd_versions_revision` ON `job_description_versions` (`master_id`,`revision`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_jd_versions_label` ON `job_description_versions` (`master_id`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_jd_versions_effective` ON `job_description_versions` (`master_id`) WHERE "job_description_versions"."status" = '正式生效';
