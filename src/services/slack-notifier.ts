/**
 * Slack Notifier Service
 */

import { WebClient } from '@slack/web-api';
import { logger } from '../utils/logger.js';
import { NotionQAItem, PullRequest, SessionError } from '../types/index.js';

/**
 * Slack Notifier class
 */
export class SlackNotifier {
  private client: WebClient;
  private channel: string;
  private enabled: boolean;

  constructor(channel?: string) {
    this.enabled = !!process.env.SLACK_BOT_TOKEN;
    this.channel = channel || process.env.SLACK_CHANNEL_QA || '#qa-automation';

    if (this.enabled) {
      this.client = new WebClient(process.env.SLACK_BOT_TOKEN);
    } else {
      logger.warn('Slack notifications disabled: SLACK_BOT_TOKEN not set');
      this.client = null as any; // Will not be used when disabled
    }
  }

  /**
   * Notify start of QA processing
   */
  public async notifyStart(qaItem: NotionQAItem): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.client.chat.postMessage({
        channel: this.channel,
        text: `🤖 Starting QA: ${qaItem.title}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*🤖 QA Processing Started*\n\n*QA:* <${qaItem.url}|${qaItem.title}>\n*Status:* In Progress\n*Reporter:* ${qaItem.metadata.reporter}`,
            },
          },
        ],
      });

      logger.debug('Slack notification sent: start', { qaId: qaItem.id });
    } catch (error) {
      logger.error('Failed to send Slack notification', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Notify successful PR creation
   */
  public async notifySuccess(qaItem: NotionQAItem, pr: PullRequest): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.client.chat.postMessage({
        channel: this.channel,
        text: `✅ QA completed: ${qaItem.title}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*✅ QA Completed Successfully*\n\n*QA:* <${qaItem.url}|${qaItem.title}>\n*PR:* <${pr.url}|#${pr.number}>\n*Branch:* \`${pr.branch}\`\n*Files Changed:* ${pr.labels.length} files`,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Review PR' },
                url: pr.url,
                style: 'primary',
              },
              {
                type: 'button',
                text: { type: 'plain_text', text: 'View QA' },
                url: qaItem.url,
              },
            ],
          },
        ],
      });

      logger.debug('Slack notification sent: success', {
        qaId: qaItem.id,
        prNumber: pr.number,
      });
    } catch (error) {
      logger.error('Failed to send Slack notification', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Notify error
   */
  public async notifyError(qaItem: NotionQAItem, error: SessionError | Error): Promise<void> {
    if (!this.enabled) return;

    const errorMessage = error instanceof Error ? error.message : error.message;
    const errorCode = 'code' in error ? error.code : 'UNKNOWN_ERROR';

    try {
      await this.client.chat.postMessage({
        channel: this.channel,
        text: `❌ QA processing failed: ${qaItem.title}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*❌ QA Processing Failed*\n\n*QA:* <${qaItem.url}|${qaItem.title}>\n*Error:* ${errorMessage}\n*Code:* \`${errorCode}\``,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'View QA' },
                url: qaItem.url,
              },
            ],
          },
        ],
      });

      logger.debug('Slack notification sent: error', { qaId: qaItem.id });
    } catch (slackError) {
      logger.error('Failed to send Slack notification', {
        error: (slackError as Error).message,
      });
    }
  }

  /**
   * Notify not actionable QA
   */
  public async notifyNotActionable(qaItem: NotionQAItem, reason: string): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.client.chat.postMessage({
        channel: this.channel,
        text: `ℹ️ QA not actionable: ${qaItem.title}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*ℹ️ QA Not Actionable*\n\n*QA:* <${qaItem.url}|${qaItem.title}>\n*Reason:* ${reason}\n\n_This QA requires manual review._`,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'View QA' },
                url: qaItem.url,
              },
            ],
          },
        ],
      });

      logger.debug('Slack notification sent: not actionable', { qaId: qaItem.id });
    } catch (error) {
      logger.error('Failed to send Slack notification', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Send custom message
   */
  public async sendMessage(text: string, markdown?: string): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.client.chat.postMessage({
        channel: this.channel,
        text,
        ...(markdown && {
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: markdown,
              },
            },
          ],
        }),
      });

      logger.debug('Slack message sent', { text });
    } catch (error) {
      logger.error('Failed to send Slack message', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Check if Slack is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }
}
