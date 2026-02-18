/**
 * Question lifecycle management for the Telegram MCP daemon.
 *
 * QuestionService manages the full lifecycle of blocking questions:
 *   1. Creates a Telegram forum thread for each new question
 *   2. Posts the question body to the thread
 *   3. Blocks the caller (via Promise + EventEmitter) until the user replies
 *   4. Routes incoming thread replies to the waiting promise via deliverAnswer()
 *
 * Follow-up questions: If a session has a recently answered question (within
 * the last 5 minutes), new questions reuse that thread instead of creating a
 * new topic — keeping conversations in one place per user decision.
 *
 * Fallback: If createForumTopic fails (group not configured, bot not admin),
 * the question falls back to DM mode — text sent to TELEGRAM_OWNER_ID with
 * no thread tracking.
 *
 * Events emitted:
 *   `answer:${questionId}` (answer: string) — when a user answer arrives
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { createLogger } from '../shared/logger.js';
import type { Question } from '../shared/types.js';
import type { SessionService } from './session-service.js';

const log = createLogger('question-service');

/** Maximum age (ms) of a recently answered question to allow thread reuse */
const FOLLOW_UP_WINDOW_MS = 5 * 60 * 1000;

// ─── Constructor injection types ──────────────────────────────────────────────

type CreateForumTopicFn = (title: string) => Promise<number>;
type SendToThreadFn = (threadId: number, text: string) => Promise<void>;
type SendToGroupFn = (text: string) => Promise<void>;

// ─── QuestionService ──────────────────────────────────────────────────────────

export class QuestionService extends EventEmitter {
  /** All questions ever created (pending + answered) keyed by question ID */
  private questions: Map<string, Question> = new Map();

  /** Maps Telegram threadId to questionId for routing incoming replies */
  private threadToQuestion: Map<number, string> = new Map();

  /** Maps sessionId to list of questionIds in creation order */
  private sessionQuestions: Map<string, string[]> = new Map();

  constructor(
    private readonly createForumTopic: CreateForumTopicFn,
    private readonly sendToThread: SendToThreadFn,
    private readonly sendToGroup: SendToGroupFn,
    private readonly sessionService: SessionService
  ) {
    super();
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Ask a blocking question.
   *
   * Creates a Telegram forum thread, posts the question body, marks the session
   * as 'waiting', then resolves when the user replies in the thread or rejects
   * after the timeout.
   *
   * @param sessionId       ID of the active Claude session asking the question
   * @param question        The full question text to display
   * @param context         Optional execution context appended below the question
   * @param timeoutMinutes  Minutes to wait before timing out (default: 30)
   * @returns               The user's answer text
   */
  async ask(
    sessionId: string,
    question: string,
    context?: string,
    timeoutMinutes?: number
  ): Promise<string> {
    const questionId = randomUUID();
    const timeout = (timeoutMinutes ?? 30) * 60 * 1000;

    // Derive a short title from the first 50 chars of the question (or first line)
    const firstLine = question.split('\n')[0] ?? question;
    const title = firstLine.slice(0, 50).trimEnd();

    const createdAt = new Date().toISOString();

    const questionRecord: Question = {
      id: questionId,
      sessionId,
      title,
      body: question,
      context,
      createdAt,
      timeoutMinutes: timeoutMinutes ?? 30,
    };

    this.questions.set(questionId, questionRecord);

    // Track per-session question list
    const sessionList = this.sessionQuestions.get(sessionId) ?? [];
    sessionList.push(questionId);
    this.sessionQuestions.set(sessionId, sessionList);

    // ─── Follow-up: reuse existing thread if session recently answered ───────

    const reuseThreadId = this.findFollowUpThread(sessionId, questionId);

    if (reuseThreadId !== null) {
      questionRecord.threadId = reuseThreadId;
      this.threadToQuestion.set(reuseThreadId, questionId);
      log.info({ questionId, sessionId, threadId: reuseThreadId }, 'Reusing existing thread for follow-up');
    } else {
      // ─── Create new forum thread ─────────────────────────────────────────
      try {
        const threadId = await this.createForumTopic(title);
        questionRecord.threadId = threadId;
        this.threadToQuestion.set(threadId, questionId);
        log.info({ questionId, sessionId, threadId, title }, 'Forum topic created for question');
      } catch (err: any) {
        // Fallback: DM mode — no thread tracking possible
        log.warn(
          { questionId, sessionId, err: err.message },
          'createForumTopic failed — falling back to DM mode'
        );
      }
    }

    // ─── Post question body ───────────────────────────────────────────────

    const formattedBody = this.formatQuestionBody(question, context);

    try {
      if (questionRecord.threadId !== undefined) {
        await this.sendToThread(questionRecord.threadId, formattedBody);
      } else {
        // DM fallback — owner only
        await this.sendToGroup(formattedBody);
      }
    } catch (err: any) {
      // Log but don't fail the ask() — the promise still blocks for an answer
      log.error({ questionId, err: err.message }, 'Failed to send question body — still waiting for answer');
    }

    // ─── Update session status to 'waiting' ──────────────────────────────

    try {
      this.sessionService.updateStatus(sessionId, 'waiting', title);
    } catch (err: any) {
      log.warn({ sessionId, err: err.message }, 'Could not update session status to waiting');
    }

    // ─── Block until answer arrives or timeout ────────────────────────────

    log.info({ questionId, sessionId, timeout }, 'Waiting for answer');

    const answer = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeAllListeners(`answer:${questionId}`);
        // Clean up question from tracking maps on timeout
        this.cleanUpQuestion(questionId);
        reject(new Error(`Question timed out after ${timeoutMinutes ?? 30} minutes: "${title}"`));
      }, timeout);

      const handler = (answerText: string): void => {
        clearTimeout(timer);
        resolve(answerText);
      };

      this.once(`answer:${questionId}`, handler);
    });

    // ─── Post-answer bookkeeping ──────────────────────────────────────────

    questionRecord.answer = answer;
    questionRecord.answeredAt = new Date().toISOString();

    // Confirm receipt in the thread
    try {
      if (questionRecord.threadId !== undefined) {
        await this.sendToThread(questionRecord.threadId, 'Answer received.');
      }
    } catch (err: any) {
      log.warn({ questionId, err: err.message }, 'Failed to send answer confirmation');
    }

    // Update session status back to 'busy'
    try {
      this.sessionService.updateStatus(sessionId, 'busy');
    } catch (err: any) {
      log.warn({ sessionId, err: err.message }, 'Could not update session status back to busy');
    }

    log.info({ questionId, sessionId }, 'Question answered');
    return answer;
  }

  /**
   * Route an incoming Telegram thread reply to the waiting question promise.
   *
   * @param threadId  Telegram message_thread_id of the thread the reply arrived in
   * @param text      The reply text (already transcribed for voice messages)
   * @returns         true if the reply was matched to a pending question; false otherwise
   */
  deliverAnswer(threadId: number, text: string): boolean {
    const questionId = this.threadToQuestion.get(threadId);
    if (questionId === undefined) {
      log.debug({ threadId }, 'Thread reply received but no pending question for this thread');
      return false;
    }

    log.info({ questionId, threadId }, 'Delivering answer to pending question');
    this.emit(`answer:${questionId}`, text);
    return true;
  }

  /**
   * Return all questions that do not yet have an answer.
   */
  getPendingQuestions(): Question[] {
    return Array.from(this.questions.values()).filter((q) => q.answer === undefined);
  }

  /**
   * Return all questions associated with a specific session.
   *
   * @param sessionId The session whose questions to retrieve
   */
  getSessionQuestions(sessionId: string): Question[] {
    const ids = this.sessionQuestions.get(sessionId) ?? [];
    return ids
      .map((id) => this.questions.get(id))
      .filter((q): q is Question => q !== undefined);
  }

  /**
   * Look up a question by the Telegram thread ID it was posted in.
   *
   * @param threadId Telegram message_thread_id
   */
  getQuestionByThread(threadId: number): Question | undefined {
    const questionId = this.threadToQuestion.get(threadId);
    if (questionId === undefined) return undefined;
    return this.questions.get(questionId);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Check if the given session has a recently answered question whose thread
   * can be reused for a follow-up. Returns the threadId to reuse, or null.
   *
   * We look at all answered questions for this session and pick the most recent
   * one whose answeredAt timestamp is within FOLLOW_UP_WINDOW_MS.
   * We exclude the current questionId being created (not yet answered).
   */
  private findFollowUpThread(sessionId: string, currentQuestionId: string): number | null {
    const ids = this.sessionQuestions.get(sessionId) ?? [];
    const now = Date.now();

    let bestThreadId: number | null = null;
    let bestTime = 0;

    for (const id of ids) {
      if (id === currentQuestionId) continue;
      const q = this.questions.get(id);
      if (!q || q.answer === undefined || q.threadId === undefined) continue;

      const answeredAt = q.answeredAt ? new Date(q.answeredAt).getTime() : 0;
      const age = now - answeredAt;

      if (age <= FOLLOW_UP_WINDOW_MS && answeredAt > bestTime) {
        bestTime = answeredAt;
        bestThreadId = q.threadId;
      }
    }

    return bestThreadId;
  }

  /**
   * Clean up tracking maps for a question that has timed out.
   */
  private cleanUpQuestion(questionId: string): void {
    const q = this.questions.get(questionId);
    if (!q) return;

    if (q.threadId !== undefined) {
      this.threadToQuestion.delete(q.threadId);
    }

    log.info({ questionId }, 'Cleaned up timed-out question from tracking maps');
  }

  /**
   * Format the question body for display in a Telegram thread.
   */
  private formatQuestionBody(question: string, context?: string): string {
    if (context) {
      return `${question}\n\n---\nContext:\n${context}`;
    }
    return question;
  }
}
