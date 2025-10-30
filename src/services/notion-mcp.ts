/**
 * Notion MCP Client
 * Handles Notion database integration via MCP
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { logger } from '../utils/logger.js';
import { NotionQAItem, QAStatus } from '../types/index.js';

/**
 * Notion MCP Client class
 */
export class NotionMCPClient {
  private client: Client;
  private transport: StdioClientTransport;
  private databaseId: string;
  private isConnected: boolean = false;

  constructor(databaseId?: string) {
    if (!databaseId && !process.env.NOTION_DATABASE_ID) {
      throw new Error('NOTION_DATABASE_ID is required');
    }
    const dbId = databaseId || process.env.NOTION_DATABASE_ID;
    if (!dbId) {
      throw new Error('NOTION_DATABASE_ID is required');
    }
    this.databaseId = dbId;

    // Create MCP transport
    const notionToken = process.env.NOTION_TOKEN;
    if (!notionToken) {
      throw new Error('NOTION_TOKEN is required');
    }

    this.transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', '@notionhq/notion-mcp-server'],
      env: {
        ...process.env,
        NOTION_API_KEY: notionToken,
      },
    });

    // Create MCP client
    this.client = new Client(
      {
        name: 'qa-automation-agent',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );
  }

  /**
   * Connect to Notion MCP server
   */
  public async connect(): Promise<void> {
    try {
      await this.client.connect(this.transport);
      this.isConnected = true;

      logger.info('✅ Connected to Notion MCP server');
    } catch (error) {
      logger.error('Failed to connect to Notion MCP', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Disconnect from Notion MCP server
   */
  public async disconnect(): Promise<void> {
    try {
      await this.client.close();
      this.isConnected = false;

      logger.info('Disconnected from Notion MCP server');
    } catch (error) {
      logger.error('Error disconnecting from Notion MCP', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Subscribe to database changes (real-time)
   */
  public async subscribeToDatabase(_callback: (qaItem: NotionQAItem) => void): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to Notion MCP');
    }

    try {
      // For MCP, we'll use polling instead of subscriptions for now
      // Real-time subscriptions will be implemented in a future version
      logger.warn('MCP subscription not fully implemented yet, using polling fallback');

      logger.info('✅ Subscribed to Notion database', { databaseId: this.databaseId });
    } catch (error) {
      logger.error('Failed to subscribe to database', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Query database for QA items (polling fallback)
   */
  public async queryDatabase(status?: QAStatus): Promise<NotionQAItem[]> {
    if (!this.isConnected) {
      throw new Error('Not connected to Notion MCP');
    }

    try {
      const result = await this.client.callTool(
        {
          name: 'query_database',
          arguments: {
            database_id: this.databaseId,
            filter: status
              ? {
                  property: 'Status',
                  select: {
                    equals: status,
                  },
                }
              : undefined,
          },
        },
        {} as any
      );

      const pages = (result as any).content || [];

      return Promise.all(pages.map((page: any) => this.parseNotionPage(page)));
    } catch (error) {
      logger.error('Failed to query database', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Update page status
   */
  public async updatePageStatus(pageId: string, status: QAStatus): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to Notion MCP');
    }

    try {
      await this.client.callTool(
        {
          name: 'update_page',
          arguments: {
            page_id: pageId,
            properties: {
              Status: {
                select: {
                  name: status,
                },
              },
            },
          },
        },
        {} as any
      );

      logger.debug('Page status updated', { pageId, status });
    } catch (error) {
      logger.error('Failed to update page status', {
        error: (error as Error).message,
        pageId,
        status,
      });
      throw error;
    }
  }

  /**
   * Add comment to page
   */
  public async addComment(pageId: string, comment: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to Notion MCP');
    }

    try {
      await this.client.callTool(
        {
          name: 'append_block',
          arguments: {
            parent_id: pageId,
            children: [
              {
                type: 'paragraph',
                paragraph: {
                  rich_text: [
                    {
                      type: 'text',
                      text: {
                        content: comment,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        {} as any
      );

      logger.debug('Comment added to page', { pageId });
    } catch (error) {
      logger.error('Failed to add comment', {
        error: (error as Error).message,
        pageId,
      });
      throw error;
    }
  }

  /**
   * Update page properties (e.g., add PR URL)
   */
  public async updatePageProperties(pageId: string, properties: Record<string, any>): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to Notion MCP');
    }

    try {
      await this.client.callTool(
        {
          name: 'update_page',
          arguments: {
            page_id: pageId,
            properties,
          },
        },
        {} as any
      );

      logger.debug('Page properties updated', { pageId, properties: Object.keys(properties) });
    } catch (error) {
      logger.error('Failed to update page properties', {
        error: (error as Error).message,
        pageId,
      });
      throw error;
    }
  }

  /**
   * Parse Notion page to QA item
   */
  private async parseNotionPage(page: any): Promise<NotionQAItem> {
    const properties = page.properties || {};

    // Extract title
    const titleProp = properties[process.env.NOTION_TITLE_PROPERTY || 'Title'];
    const title = titleProp?.title?.[0]?.plain_text || 'Untitled';

    // Extract description (from page content)
    const description = await this.getPageContent(page.id);

    // Extract status
    const statusProp = properties[process.env.NOTION_STATUS_PROPERTY || 'Status'];
    const status = statusProp?.select?.name || QAStatus.NOT_STARTED;

    // Extract other properties
    const reporter = properties.Reporter?.people?.[0]?.name || 'Unknown';
    const priority = properties.Priority?.select?.name;

    return {
      id: page.id,
      url: page.url,
      title,
      description,
      status: status as QAStatus,
      priority,
      metadata: {
        reporter,
        createdAt: new Date(page.created_time),
        updatedAt: new Date(page.last_edited_time),
        databaseId: this.databaseId,
      },
    };
  }

  /**
   * Get page content (blocks)
   */
  private async getPageContent(pageId: string): Promise<string> {
    try {
      const result = await this.client.callTool(
        {
          name: 'get_blocks',
          arguments: {
            block_id: pageId,
          },
        },
        {} as any
      );

      const blocks = (result as any).content || [];

      // Extract text from blocks
      const textBlocks = blocks
        .map((block: any) => {
          if (block.type === 'paragraph') {
            return block.paragraph?.rich_text?.map((rt: any) => rt.plain_text).join('') || '';
          }
          return '';
        })
        .filter((text: string) => text.length > 0);

      return textBlocks.join('\n\n');
    } catch (error) {
      logger.warn('Failed to get page content', {
        error: (error as Error).message,
        pageId,
      });
      return '';
    }
  }

  /**
   * Check connection status
   */
  public isConnectedToNotion(): boolean {
    return this.isConnected;
  }
}
