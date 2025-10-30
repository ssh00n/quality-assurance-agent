/**
 * Base Agent abstract class
 * All sub-agents inherit from this class
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger.js';
import { retry } from '../utils/retry.js';
import {
  AgentConfig,
  AgentContext,
  AgentResult,
  ProgressCallback,
  ProgressUpdate,
  WorkflowPhase,
} from '../types/index.js';

/**
 * Base Agent abstract class
 */
export abstract class BaseAgent<TInput = any, TOutput = any> {
  protected anthropic: Anthropic;
  protected config: AgentConfig;
  protected context: AgentContext;
  protected progressCallback?: ProgressCallback;

  constructor(config: AgentConfig, context: AgentContext) {
    this.config = {
      timeout: 300000, // 5 minutes default
      retries: 3,
      model: 'claude-sonnet-4-5-20250929',
      ...config,
    };

    this.context = context;

    // Initialize Anthropic client
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Set progress callback
   */
  public setProgressCallback(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * Execute the agent
   */
  public async execute(input?: TInput): Promise<AgentResult<TOutput>> {
    const startTime = Date.now();
    let retryCount = 0;

    logger.agent(this.config.agentType, 'Starting execution', {
      sessionId: this.context.sessionId,
      timeout: this.config.timeout,
    });

    try {
      // Execute with retry logic
      const result = await retry(
        async () => {
          // Execute with timeout
          return await this.executeWithTimeout(input);
        },
        {
          maxAttempts: this.config.retries || 3,
          onRetry: (error, attempt) => {
            retryCount = attempt;
            logger.warn(`Agent retry attempt ${attempt}`, {
              agentType: this.config.agentType,
              error: error.message,
            });
          },
        }
      );

      const executionTime = Date.now() - startTime;

      logger.agent(this.config.agentType, 'Execution completed', {
        sessionId: this.context.sessionId,
        executionTime,
        retryCount,
      });

      return {
        success: true,
        data: result,
        metadata: {
          executionTime,
          retryCount,
          agentType: this.config.agentType,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error(`Agent execution failed: ${this.config.agentType}`, {
        sessionId: this.context.sessionId,
        error: (error as Error).message,
        stack: (error as Error).stack,
        executionTime,
        retryCount,
      });

      return {
        success: false,
        error: {
          message: (error as Error).message,
          code: (error as any).code || 'AGENT_ERROR',
          retryable: this.isRetryableError(error as Error),
        },
        metadata: {
          executionTime,
          retryCount,
          agentType: this.config.agentType,
        },
      };
    }
  }

  /**
   * Execute with timeout wrapper
   */
  private async executeWithTimeout(input?: TInput): Promise<TOutput> {
    const timeout = this.config.timeout || 300000;

    return Promise.race([
      this.run(input),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Agent timeout after ${timeout}ms`)), timeout)
      ),
    ]);
  }

  /**
   * Abstract run method - must be implemented by subclasses
   */
  protected abstract run(input?: TInput): Promise<TOutput>;

  /**
   * Call Claude Messages API
   */
  protected async callClaude(
    prompt: string,
    systemPrompt?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    logger.debug('Calling Claude API', {
      agentType: this.config.agentType,
      model: this.config.model,
      promptLength: prompt.length,
    });

    const response = await this.anthropic.messages.create({
      model: this.config.model || 'claude-sonnet-4-5-20250929',
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature ?? 1,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    return content.text;
  }

  /**
   * Call Claude Vision API
   */
  protected async callClaudeVision(
    prompt: string,
    imageBase64: string,
    mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/png'
  ): Promise<string> {
    logger.debug('Calling Claude Vision API', {
      agentType: this.config.agentType,
      model: this.config.model,
    });

    const response = await this.anthropic.messages.create({
      model: this.config.model || 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude Vision API');
    }

    return content.text;
  }

  /**
   * Update progress
   */
  protected updateProgress(message: string, phase: WorkflowPhase, progress?: number): void {
    if (this.progressCallback) {
      const update: ProgressUpdate = {
        sessionId: this.context.sessionId,
        phase,
        message,
        progress,
        timestamp: new Date(),
      };

      this.progressCallback(update);
    }

    logger.agent(this.config.agentType, message, {
      sessionId: this.context.sessionId,
      phase,
      progress,
    });
  }

  /**
   * Check if error is retryable
   */
  protected isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      /rate limit/i,
      /timeout/i,
      /network/i,
      /ECONNRESET/,
      /ETIMEDOUT/,
      /429/,
      /502/,
      /503/,
      /504/,
    ];

    const errorMessage = error.message || '';
    return retryablePatterns.some((pattern) => pattern.test(errorMessage));
  }

  /**
   * Parse JSON from Claude response
   */
  protected parseJSON<T>(text: string): T {
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      // Try direct parse
      return JSON.parse(text);
    } catch (error) {
      logger.error('Failed to parse JSON from Claude response', {
        agentType: this.config.agentType,
        error: (error as Error).message,
        text: text.substring(0, 500), // Log first 500 chars
      });
      throw new Error('Failed to parse JSON response from Claude');
    }
  }

  /**
   * Get agent type
   */
  public getType(): string {
    return this.config.agentType;
  }

  /**
   * Get current context
   */
  public getContext(): AgentContext {
    return this.context;
  }
}
