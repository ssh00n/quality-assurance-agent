/**
 * Session Manager
 * Manages agent session lifecycle and state
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import {
  AgentSession,
  AgentContext,
  SessionStatus,
  SessionError,
  WorkflowPhase,
  NotionQAItem,
} from '../types/index.js';

/**
 * Session Manager class
 */
export class SessionManager extends EventEmitter {
  private sessions: Map<string, AgentSession> = new Map();
  private timeoutHandlers: Map<string, NodeJS.Timeout> = new Map();
  private defaultTimeout: number;

  constructor(defaultTimeout: number = 3600000) {
    // 1 hour default
    super();
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * Create a new session
   */
  public async create(
    qaItem: NotionQAItem,
    additionalContext?: Partial<AgentContext>
  ): Promise<AgentSession> {
    const sessionId = this.generateSessionId();

    const context: AgentContext = {
      sessionId,
      qaItem,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...additionalContext,
    };

    const session: AgentSession = {
      id: sessionId,
      qaItemId: qaItem.id,
      projectId: additionalContext?.projectId,
      status: SessionStatus.CREATED,
      context,
      startedAt: new Date(),
      completedPhases: [],
    };

    this.sessions.set(sessionId, session);

    // Setup timeout
    this.setupTimeout(sessionId);

    logger.session(sessionId, 'Session created', {
      qaItemId: qaItem.id,
      qaTitle: qaItem.title,
      projectId: session.projectId,
    });

    this.emit('session:created', session);

    return session;
  }

  /**
   * Get session by ID
   */
  public get(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Update session status
   */
  public updateStatus(sessionId: string, status: SessionStatus, error?: SessionError): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Session not found for status update', { sessionId });
      return;
    }

    session.status = status;
    session.context.updatedAt = new Date();

    if (error) {
      session.error = error;
    }

    if (status === SessionStatus.COMPLETED || status === SessionStatus.FAILED) {
      session.completedAt = new Date();
      this.clearTimeout(sessionId);
    }

    logger.session(sessionId, `Status updated: ${status}`, {
      previousStatus: session.status,
      error: error?.message,
    });

    this.emit('session:updated', session);
  }

  /**
   * Update session phase
   */
  public updatePhase(sessionId: string, phase: WorkflowPhase): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Session not found for phase update', { sessionId });
      return;
    }

    session.currentPhase = phase;
    session.context.updatedAt = new Date();

    if (!session.completedPhases.includes(phase)) {
      session.completedPhases.push(phase);
    }

    logger.session(sessionId, `Phase updated: ${phase}`, {
      completedPhases: session.completedPhases.length,
    });

    this.emit('session:phase', session, phase);
  }

  /**
   * Update session context
   */
  public updateContext(sessionId: string, updates: Partial<AgentContext>): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Session not found for context update', { sessionId });
      return;
    }

    session.context = {
      ...session.context,
      ...updates,
      updatedAt: new Date(),
    };

    logger.session(sessionId, 'Context updated', {
      updates: Object.keys(updates),
    });

    this.emit('session:context', session);
  }

  /**
   * Close session
   */
  public async close(sessionId: string, status?: SessionStatus): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Session not found for close', { sessionId });
      return;
    }

    const finalStatus = status || SessionStatus.COMPLETED;
    this.updateStatus(sessionId, finalStatus);

    this.clearTimeout(sessionId);

    logger.session(sessionId, 'Session closed', {
      status: finalStatus,
      duration: Date.now() - session.startedAt.getTime(),
      completedPhases: session.completedPhases.length,
    });

    this.emit('session:closed', session);

    // Keep session for history, don't delete
    // this.sessions.delete(sessionId);
  }

  /**
   * Get all active sessions
   */
  public getActiveSessions(): AgentSession[] {
    return Array.from(this.sessions.values()).filter(
      (session) => session.status === SessionStatus.RUNNING || session.status === SessionStatus.CREATED
    );
  }

  /**
   * Get sessions by project
   */
  public getSessionsByProject(projectId: string): AgentSession[] {
    return Array.from(this.sessions.values()).filter((session) => session.projectId === projectId);
  }

  /**
   * Get session count
   */
  public getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get active session count
   */
  public getActiveSessionCount(): number {
    return this.getActiveSessions().length;
  }

  /**
   * Clean up old sessions
   */
  public cleanup(olderThan: number = 86400000): void {
    // 24 hours default
    const cutoff = Date.now() - olderThan;

    for (const [sessionId, session] of this.sessions) {
      if (
        session.completedAt &&
        session.completedAt.getTime() < cutoff &&
        (session.status === SessionStatus.COMPLETED || session.status === SessionStatus.FAILED)
      ) {
        this.sessions.delete(sessionId);
        logger.session(sessionId, 'Session cleaned up', {
          age: Date.now() - session.startedAt.getTime(),
        });
      }
    }
  }

  /**
   * Setup session timeout
   */
  private setupTimeout(sessionId: string): void {
    const timeout = setTimeout(() => {
      const session = this.sessions.get(sessionId);
      if (session && session.status === SessionStatus.RUNNING) {
        logger.warn('Session timeout', { sessionId });

        this.updateStatus(sessionId, SessionStatus.TIMEOUT, {
          message: 'Session timed out',
          code: 'SESSION_TIMEOUT',
          retryable: false,
        });

        this.emit('session:timeout', session);
      }
    }, this.defaultTimeout);

    this.timeoutHandlers.set(sessionId, timeout);
  }

  /**
   * Clear session timeout
   */
  private clearTimeout(sessionId: string): void {
    const timeout = this.timeoutHandlers.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeoutHandlers.delete(sessionId);
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get session statistics
   */
  public getStats() {
    const sessions = Array.from(this.sessions.values());

    return {
      total: sessions.length,
      active: sessions.filter((s) => s.status === SessionStatus.RUNNING).length,
      completed: sessions.filter((s) => s.status === SessionStatus.COMPLETED).length,
      failed: sessions.filter((s) => s.status === SessionStatus.FAILED).length,
      timeout: sessions.filter((s) => s.status === SessionStatus.TIMEOUT).length,
    };
  }
}
