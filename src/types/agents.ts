/**
 * Agent-related type definitions
 */

import {
  NotionQAItem,
  QAAnalysis,
  ClassificationDecision,
  CodeChanges,
  PullRequest,
} from './qa.js';

/**
 * Base Agent configuration
 */
export interface AgentConfig {
  agentType: string;
  timeout?: number;
  retries?: number;
  model?: string;
}

/**
 * Agent execution context
 */
export interface AgentContext {
  sessionId: string;
  qaItem: NotionQAItem;
  projectId?: string;
  projectConfig?: ProjectConfig;

  // Progressive context built through workflow
  analysis?: QAAnalysis;
  decision?: ClassificationDecision;
  codeChanges?: CodeChanges;
  pullRequest?: PullRequest;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Agent session information
 */
export interface AgentSession {
  id: string;
  qaItemId: string;
  projectId?: string;
  status: SessionStatus;
  context: AgentContext;

  // Lifecycle
  startedAt: Date;
  completedAt?: Date;
  error?: SessionError;

  // Progress tracking
  currentPhase?: WorkflowPhase;
  completedPhases: WorkflowPhase[];
}

/**
 * Session status
 */
export enum SessionStatus {
  CREATED = 'created',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
}

/**
 * Session error information
 */
export interface SessionError {
  message: string;
  code: string;
  stack?: string;
  phase?: WorkflowPhase;
  retryable: boolean;
}

/**
 * Workflow phases
 */
export enum WorkflowPhase {
  DETECTION = 'detection',
  ANALYSIS = 'analysis',
  CLASSIFICATION = 'classification',
  IMPLEMENTATION = 'implementation',
  PR_CREATION = 'pr_creation',
  COMPLETION = 'completion',
}

/**
 * Project configuration for multi-project support
 */
export interface ProjectConfig {
  id: string;
  name: string;
  enabled: boolean;

  notion: {
    databaseId: string;
    statusProperty: string;
    titleProperty: string;
  };

  github: {
    owner: string;
    repo: string;
    branch: string;
    baseBranch: string;
  };

  slack?: {
    channelId: string;
    channelName: string;
    mentionOnError?: string[];
    mentionOnCritical?: string[];
  };

  agents: {
    [agentType: string]: {
      enabled: boolean;
      timeout?: number;
      permissions?: AgentPermissions;
    };
  };

  rules: {
    autoMerge: boolean;
    requireApproval: boolean;
    minTestCoverage?: number;
    maxComplexity?: string;
  };
}

/**
 * Agent permissions (for Code Agent)
 */
export interface AgentPermissions {
  read?: string[];
  write?: string[];
  execute?: string[];
}

/**
 * Agent execution result
 */
export interface AgentResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    retryable: boolean;
  };
  metadata: {
    executionTime: number; // milliseconds
    retryCount: number;
    agentType: string;
  };
}

/**
 * Progress update callback
 */
export type ProgressCallback = (update: ProgressUpdate) => void;

/**
 * Progress update information
 */
export interface ProgressUpdate {
  sessionId: string;
  phase: WorkflowPhase;
  message: string;
  progress?: number; // 0-100
  timestamp: Date;
}
