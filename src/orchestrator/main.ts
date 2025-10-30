/**
 * Main Orchestrator Agent
 * Coordinates all sub-agents and manages workflow
 */

import { EventEmitter } from 'events';
import { SessionManager } from './session-manager.js';
import { NotionMCPClient } from '../services/notion-mcp.js';
import { SlackNotifier } from '../services/slack-notifier.js';
import { QAAnalyzerAgent } from '../agents/qa-analyzer.js';
import { ActionClassifierAgent } from '../agents/action-classifier.js';
import { CodeAgent } from '../agents/code-agent.js';
import { PRManagerAgent } from '../agents/pr-manager.js';
import { logger } from '../utils/logger.js';
import {
  NotionQAItem,
  QAStatus,
  SessionStatus,
  WorkflowPhase,
  ProjectConfig,
} from '../types/index.js';

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  databaseId?: string;
  slackChannel?: string;
  projectConfig?: ProjectConfig;
}

/**
 * Main Orchestrator class
 */
export class OrchestratorAgent extends EventEmitter {
  private sessionManager: SessionManager;
  private notionClient: NotionMCPClient;
  private slackNotifier: SlackNotifier;
  private config: OrchestratorConfig;
  private isRunning: boolean = false;
  private pollingInterval?: NodeJS.Timeout;

  constructor(config: OrchestratorConfig = {}) {
    super();

    this.config = config;
    this.sessionManager = new SessionManager();
    this.notionClient = new NotionMCPClient(config.databaseId);
    this.slackNotifier = new SlackNotifier(config.slackChannel);

    // Setup event handlers
    this.setupEventHandlers();
  }

  /**
   * Initialize orchestrator
   */
  public async initialize(): Promise<void> {
    logger.info('🚀 Initializing Orchestrator Agent');

    try {
      // Connect to Notion MCP
      await this.notionClient.connect();

      logger.info('✅ Orchestrator initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize orchestrator', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Start orchestrator
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Orchestrator already running');
      return;
    }

    this.isRunning = true;

    logger.info('▶️  Starting Orchestrator Agent');

    try {
      // Subscribe to Notion database changes (real-time)
      await this.notionClient.subscribeToDatabase(async (qaItem) => {
        await this.handleNewQA(qaItem);
      });

      // Setup polling fallback
      this.setupPolling();

      logger.info('✅ Orchestrator started successfully');

      this.emit('started');
    } catch (error) {
      logger.error('Failed to start orchestrator', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Stop orchestrator
   */
  public async stop(): Promise<void> {
    logger.info('⏹️  Stopping Orchestrator Agent');

    this.isRunning = false;

    // Clear polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // Disconnect from Notion
    await this.notionClient.disconnect();

    logger.info('✅ Orchestrator stopped');

    this.emit('stopped');
  }

  /**
   * Handle new QA item
   */
  private async handleNewQA(qaItem: NotionQAItem): Promise<void> {
    logger.info('📥 New QA detected', {
      qaId: qaItem.id,
      qaTitle: qaItem.title,
      status: qaItem.status,
    });

    // Only process "Not Started" items
    if (qaItem.status !== QAStatus.NOT_STARTED) {
      logger.debug('Skipping QA (not in Not Started status)', {
        qaId: qaItem.id,
        status: qaItem.status,
      });
      return;
    }

    try {
      // Process QA item
      await this.processQA(qaItem);
    } catch (error) {
      logger.error('Error processing QA', {
        qaId: qaItem.id,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      // Update Notion with error
      await this.handleError(qaItem, error as Error);
    }
  }

  /**
   * Process QA item through full workflow
   */
  private async processQA(qaItem: NotionQAItem): Promise<void> {
    // Create session
    const session = await this.sessionManager.create(qaItem, {
      projectConfig: this.config.projectConfig,
    });

    this.sessionManager.updateStatus(session.id, SessionStatus.RUNNING);

    try {
      // Update Notion status
      await this.notionClient.updatePageStatus(qaItem.id, QAStatus.IN_PROGRESS);

      // Send Slack notification
      await this.slackNotifier.notifyStart(qaItem);

      logger.session(session.id, 'Starting QA processing workflow');

      // === Phase 1: QA Analysis ===
      this.sessionManager.updatePhase(session.id, WorkflowPhase.ANALYSIS);

      const qaAnalyzer = new QAAnalyzerAgent(
        { agentType: 'qa-analyzer' },
        this.sessionManager.get(session.id)!.context
      );

      const analysisResult = await qaAnalyzer.execute();

      if (!analysisResult.success) {
        throw new Error(`QA Analysis failed: ${analysisResult.error?.message}`);
      }

      // Update context with analysis
      this.sessionManager.updateContext(session.id, {
        analysis: analysisResult.data,
      });

      // === Phase 2: Action Classification ===
      this.sessionManager.updatePhase(session.id, WorkflowPhase.CLASSIFICATION);

      const actionClassifier = new ActionClassifierAgent(
        { agentType: 'action-classifier' },
        this.sessionManager.get(session.id)!.context
      );

      const classificationResult = await actionClassifier.execute({
        analysis: analysisResult.data!,
      });

      if (!classificationResult.success) {
        throw new Error(`Classification failed: ${classificationResult.error?.message}`);
      }

      // Update context with decision
      this.sessionManager.updateContext(session.id, {
        decision: classificationResult.data,
      });

      // Check if actionable
      if (!classificationResult.data?.shouldAct) {
        logger.session(session.id, 'QA classified as not actionable', {
          reason: classificationResult.data?.reason,
        });

        await this.handleNotActionable(qaItem, classificationResult.data!.reason);
        await this.sessionManager.close(session.id, SessionStatus.COMPLETED);
        return;
      }

      // === Phase 3: Code Implementation ===
      this.sessionManager.updatePhase(session.id, WorkflowPhase.IMPLEMENTATION);

      const codeAgent = new CodeAgent(
        { agentType: 'code-agent' },
        this.sessionManager.get(session.id)!.context
      );

      const codeResult = await codeAgent.execute({
        analysis: analysisResult.data!,
        decision: classificationResult.data!,
      });

      if (!codeResult.success) {
        throw new Error(`Code implementation failed: ${codeResult.error?.message}`);
      }

      // Update context with code changes
      this.sessionManager.updateContext(session.id, {
        codeChanges: codeResult.data,
      });

      // === Phase 4: PR Creation ===
      this.sessionManager.updatePhase(session.id, WorkflowPhase.PR_CREATION);

      const prManager = new PRManagerAgent(
        { agentType: 'pr-manager' },
        this.sessionManager.get(session.id)!.context
      );

      const prResult = await prManager.execute({
        codeChanges: codeResult.data!,
      });

      if (!prResult.success) {
        throw new Error(`PR creation failed: ${prResult.error?.message}`);
      }

      // Update context with PR
      this.sessionManager.updateContext(session.id, {
        pullRequest: prResult.data,
      });

      // === Phase 5: Completion ===
      this.sessionManager.updatePhase(session.id, WorkflowPhase.COMPLETION);

      await this.completeQA(qaItem, prResult.data!);
      await this.sessionManager.close(session.id, SessionStatus.COMPLETED);

      logger.session(session.id, '✅ QA processing completed successfully');

      this.emit('qa:completed', qaItem, prResult.data);
    } catch (error) {
      logger.session(session.id, '❌ QA processing failed', {
        error: (error as Error).message,
      });

      this.sessionManager.updateStatus(session.id, SessionStatus.FAILED, {
        message: (error as Error).message,
        code: 'PROCESSING_ERROR',
        retryable: false,
      });

      throw error;
    }
  }

  /**
   * Handle not actionable QA
   */
  private async handleNotActionable(qaItem: NotionQAItem, reason: string): Promise<void> {
    // Update Notion
    await this.notionClient.updatePageStatus(qaItem.id, QAStatus.NOT_ACTIONABLE);
    await this.notionClient.addComment(
      qaItem.id,
      `🤖 Automation Analysis\n\nThis QA is not actionable for automation.\n\nReason: ${reason}\n\nPlease review and update if needed.`
    );

    // Send Slack notification
    await this.slackNotifier.notifyNotActionable(qaItem, reason);

    logger.info('QA marked as not actionable', {
      qaId: qaItem.id,
      reason,
    });
  }

  /**
   * Complete QA processing
   */
  private async completeQA(qaItem: NotionQAItem, pr: any): Promise<void> {
    // Update Notion
    await this.notionClient.updatePageStatus(qaItem.id, QAStatus.DONE);
    await this.notionClient.addComment(
      qaItem.id,
      `✅ Automated Fix Completed\n\nPull Request: ${pr.url}\n\nPlease review the changes.`
    );

    // Update PR URL property if exists
    try {
      await this.notionClient.updatePageProperties(qaItem.id, {
        'PR URL': {
          url: pr.url,
        },
      });
    } catch (error) {
      logger.warn('Could not update PR URL property', {
        qaId: qaItem.id,
        error: (error as Error).message,
      });
    }

    // Send Slack notification
    await this.slackNotifier.notifySuccess(qaItem, pr);

    logger.info('✅ QA completed successfully', {
      qaId: qaItem.id,
      prUrl: pr.url,
    });
  }

  /**
   * Handle errors
   */
  private async handleError(qaItem: NotionQAItem, error: Error): Promise<void> {
    // Update Notion
    await this.notionClient.updatePageStatus(qaItem.id, QAStatus.IN_REVIEW);
    await this.notionClient.addComment(
      qaItem.id,
      `❌ Automation Failed\n\nError: ${error.message}\n\nPlease review manually.`
    );

    // Send Slack notification
    await this.slackNotifier.notifyError(qaItem, error);
  }

  /**
   * Setup polling fallback
   */
  private setupPolling(): void {
    const interval = parseInt(process.env.FALLBACK_POLLING_INTERVAL || '120', 10) * 1000; // seconds to ms

    this.pollingInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const qaItems = await this.notionClient.queryDatabase(QAStatus.NOT_STARTED);

        for (const qaItem of qaItems) {
          await this.handleNewQA(qaItem);
        }
      } catch (error) {
        logger.error('Polling error', {
          error: (error as Error).message,
        });
      }
    }, interval);

    logger.info('✅ Polling fallback setup', {
      interval: `${interval / 1000}s`,
    });
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.sessionManager.on('session:timeout', (session) => {
      logger.warn('Session timeout', {
        sessionId: session.id,
        qaId: session.qaItemId,
      });
      this.emit('session:timeout', session);
    });
  }

  /**
   * Get orchestrator statistics
   */
  public getStats() {
    return {
      isRunning: this.isRunning,
      sessions: this.sessionManager.getStats(),
      activeSessions: this.sessionManager.getActiveSessionCount(),
    };
  }
}
