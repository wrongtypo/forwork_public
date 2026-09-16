CREATE TABLE `change_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `org_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`position_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`employee_no` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `position_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`position_id` text NOT NULL,
	`person_id` text NOT NULL,
	`start_date` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_position_assignments_position_person` ON `position_assignments` (`position_id`,`person_id`);--> statement-breakpoint
CREATE TABLE `positions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`site` text DEFAULT 'VT' NOT NULL,
	`department` text DEFAULT '' NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`grade` text DEFAULT '' NOT NULL,
	`reports_to` text DEFAULT '待確認' NOT NULL,
	`status` text DEFAULT '待建立' NOT NULL,
	`version` text DEFAULT '0.1' NOT NULL,
	`effective_date` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`confidentiality` text DEFAULT '人事機密' NOT NULL,
	`headcount` integer DEFAULT 1 NOT NULL,
	`document_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `section_confirmations` (
	`id` text PRIMARY KEY NOT NULL,
	`position_id` text NOT NULL,
	`section_key` text NOT NULL,
	`status` text DEFAULT '待確認' NOT NULL,
	`confirmed_by` text DEFAULT '' NOT NULL,
	`confirmed_at` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_section_confirmations_position_section` ON `section_confirmations` (`position_id`,`section_key`);