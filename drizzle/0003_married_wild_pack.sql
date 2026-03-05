CREATE TABLE `activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('note_added','experience_learned','pattern_detected','project_updated','learning_run','push_sent','ai_call','export_created','health_check','procedure_updated') NOT NULL,
	`title` varchar(256) NOT NULL,
	`description` text,
	`entityType` varchar(64),
	`entityId` varchar(128),
	`metadata` json,
	`importance` int DEFAULT 5,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `data_exports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`format` enum('json','csv','markdown') NOT NULL,
	`scope` enum('all','experiences','notes','projects','patterns','analytics') NOT NULL,
	`fileName` varchar(256) NOT NULL,
	`recordCount` int NOT NULL DEFAULT 0,
	`fileSizeBytes` int NOT NULL DEFAULT 0,
	`downloadUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `data_exports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `search_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`queryHash` varchar(64) NOT NULL,
	`query` text NOT NULL,
	`results` json NOT NULL,
	`resultCount` int NOT NULL DEFAULT 0,
	`hitCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `search_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `search_cache_queryHash_unique` UNIQUE(`queryHash`)
);
--> statement-breakpoint
CREATE TABLE `system_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(128) NOT NULL,
	`value` text,
	`description` text,
	`isSecret` boolean NOT NULL DEFAULT false,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_config_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`color` varchar(16) DEFAULT '#10b981',
	`category` varchar(64) DEFAULT 'general',
	`usageCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `type` enum('learning_complete','action_required','health_alert','budget_alert','project_update','procedure_update','weekly_report','test') NOT NULL DEFAULT 'test';