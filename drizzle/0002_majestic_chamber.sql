CREATE TABLE `ai_usage_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`provider` varchar(32) NOT NULL,
	`modelId` varchar(128) NOT NULL,
	`taskType` varchar(64) DEFAULT 'general',
	`inputTokens` int DEFAULT 0,
	`outputTokens` int DEFAULT 0,
	`costUsd` varchar(20) DEFAULT '0',
	`latencyMs` int DEFAULT 0,
	`success` boolean NOT NULL DEFAULT true,
	`errorMsg` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_usage_logs_id` PRIMARY KEY(`id`)
);
