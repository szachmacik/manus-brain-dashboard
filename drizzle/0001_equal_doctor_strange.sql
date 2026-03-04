CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(256) NOT NULL,
	`body` text NOT NULL,
	`type` enum('learning_complete','action_required','health_alert','budget_alert','project_update','procedure_update','test') NOT NULL DEFAULT 'test',
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`url` text,
	`data` json,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`deliveredCount` int NOT NULL DEFAULT 0,
	`failedCount` int NOT NULL DEFAULT 0,
	`isRead` boolean NOT NULL DEFAULT false,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`userAgent` text,
	`label` varchar(128) DEFAULT 'Mój telefon',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastUsedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`)
);
