/**
 * Validation utilities using Zod
 */

import { z } from 'zod';
import { logger } from './logger.js';

/**
 * Environment variables schema
 */
const envSchema = z.object({
  // Anthropic
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),

  // Notion
  NOTION_TOKEN: z.string().min(1, 'NOTION_TOKEN is required'),
  NOTION_DATABASE_ID: z.string().min(1, 'NOTION_DATABASE_ID is required'),
  NOTION_STATUS_PROPERTY: z.string().default('Status'),
  NOTION_TITLE_PROPERTY: z.string().default('Title'),

  // GitHub
  GITHUB_TOKEN: z.string().min(1, 'GITHUB_TOKEN is required'),
  GITHUB_OWNER: z.string().min(1, 'GITHUB_OWNER is required'),
  GITHUB_REPO: z.string().min(1, 'GITHUB_REPO is required'),
  GITHUB_DEFAULT_BRANCH: z.string().default('main'),

  // Slack (optional)
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_CHANNEL_QA: z.string().optional(),

  // Agent configuration
  ENABLE_QA_ANALYZER: z.string().default('true'),
  ENABLE_ACTION_CLASSIFIER: z.string().default('true'),
  ENABLE_CODE_AGENT: z.string().default('true'),
  ENABLE_PR_MANAGER: z.string().default('true'),

  // MCP configuration
  MCP_SERVER_URL: z.string().default('stdio://npx'),
  MCP_SERVER_ARGS: z.string().default('-y,@notionhq/notion-mcp-server'),
  FALLBACK_POLLING_INTERVAL: z.string().default('120'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('logs/qa-automation.log'),

  // Advanced settings
  MAX_CONCURRENT_AGENTS: z.string().default('3'),
  SESSION_TIMEOUT: z.string().default('3600'),
  MAX_RETRIES: z.string().default('3'),
  RETRY_DELAY: z.string().default('5000'),

  // API rate limits
  ANTHROPIC_RATE_LIMIT: z.string().default('50'),
  GITHUB_RATE_LIMIT: z.string().default('5000'),
  NOTION_RATE_LIMIT: z.string().default('3'),
});

/**
 * Validated environment variables type
 */
export type ValidatedEnv = z.infer<typeof envSchema>;

/**
 * Validate environment variables
 */
export function validateEnv(): ValidatedEnv {
  try {
    const validated = envSchema.parse(process.env);
    logger.info('✅ Environment variables validated successfully');
    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('❌ Environment validation failed:', {
        errors: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
      throw new Error('Invalid environment configuration. Check logs for details.');
    }
    throw error;
  }
}

/**
 * Notion QA Item schema for validation
 */
export const notionQAItemSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string().min(1),
  description: z.string(),
  status: z.string(),
  priority: z.string().optional(),
  images: z.array(z.string()).optional(),
  metadata: z.object({
    reporter: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    databaseId: z.string(),
  }),
});

/**
 * QA Analysis schema
 */
export const qaAnalysisSchema = z.object({
  summary: z.string(),
  issueType: z.enum(['bug', 'feature', 'improvement', 'question', 'documentation']),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  stepsToReproduce: z.array(z.string()),
  expectedBehavior: z.string(),
  actualBehavior: z.string(),
  visualEvidence: z.array(
    z.object({
      description: z.string(),
      extractedText: z.string().optional(),
      relevantDetails: z.array(z.string()),
    })
  ),
  affectedComponents: z.array(z.string()),
  suspectedRootCause: z.string().optional(),
  relatedIssues: z.array(z.string()).optional(),
  analyzedAt: z.date(),
  confidence: z.number().min(0).max(1),
});

/**
 * Classification Decision schema
 */
export const classificationDecisionSchema = z.object({
  shouldAct: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  workType: z.enum(['bug_fix', 'feature_add', 'refactor', 'documentation', 'test_addition']).optional(),
  estimatedComplexity: z.enum(['simple', 'moderate', 'complex']).optional(),
  requiredSkills: z.array(z.string()).optional(),
  blockers: z.array(z.string()).optional(),
  prerequisites: z.array(z.string()).optional(),
  classifiedAt: z.date(),
});

/**
 * Generic validation helper
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Validation error:', {
        errors: error.errors,
      });
      throw new Error(`Validation failed: ${error.errors.map((e) => e.message).join(', ')}`);
    }
    throw error;
  }
}

/**
 * Type guard helpers
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidGitHubToken(token: string): boolean {
  // GitHub tokens start with ghp_, gho_, ghs_, or ghu_
  return /^gh[pousr]_[a-zA-Z0-9]{36,}$/.test(token);
}

export function isValidNotionToken(token: string): boolean {
  // Notion integration tokens start with secret_
  return /^secret_[a-zA-Z0-9]{43}$/.test(token);
}

export function isValidAnthropicKey(key: string): boolean {
  // Anthropic API keys start with sk-ant-
  return /^sk-ant-api\d{2}-[a-zA-Z0-9-_]{95}$/.test(key);
}
