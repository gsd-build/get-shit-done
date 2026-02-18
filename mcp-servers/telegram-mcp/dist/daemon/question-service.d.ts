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
import type { Question } from '../shared/types.js';
import type { SessionService } from './session-service.js';
type CreateForumTopicFn = (title: string) => Promise<number>;
type SendToThreadFn = (threadId: number, text: string) => Promise<void>;
type SendToGroupFn = (text: string) => Promise<void>;
export declare class QuestionService extends EventEmitter {
    private readonly createForumTopic;
    private readonly sendToThread;
    private readonly sendToGroup;
    private readonly sessionService;
    /** All questions ever created (pending + answered) keyed by question ID */
    private questions;
    /** Maps Telegram threadId to questionId for routing incoming replies */
    private threadToQuestion;
    /** Maps sessionId to list of questionIds in creation order */
    private sessionQuestions;
    constructor(createForumTopic: CreateForumTopicFn, sendToThread: SendToThreadFn, sendToGroup: SendToGroupFn, sessionService: SessionService);
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
    ask(sessionId: string, question: string, context?: string, timeoutMinutes?: number): Promise<string>;
    /**
     * Route an incoming Telegram thread reply to the waiting question promise.
     *
     * @param threadId  Telegram message_thread_id of the thread the reply arrived in
     * @param text      The reply text (already transcribed for voice messages)
     * @returns         true if the reply was matched to a pending question; false otherwise
     */
    deliverAnswer(threadId: number, text: string): boolean;
    /**
     * Return all questions that do not yet have an answer.
     */
    getPendingQuestions(): Question[];
    /**
     * Return all questions associated with a specific session.
     *
     * @param sessionId The session whose questions to retrieve
     */
    getSessionQuestions(sessionId: string): Question[];
    /**
     * Look up a question by the Telegram thread ID it was posted in.
     *
     * @param threadId Telegram message_thread_id
     */
    getQuestionByThread(threadId: number): Question | undefined;
    /**
     * Check if the given session has a recently answered question whose thread
     * can be reused for a follow-up. Returns the threadId to reuse, or null.
     *
     * We look at all answered questions for this session and pick the most recent
     * one whose answeredAt timestamp is within FOLLOW_UP_WINDOW_MS.
     * We exclude the current questionId being created (not yet answered).
     */
    private findFollowUpThread;
    /**
     * Clean up tracking maps for a question that has timed out.
     */
    private cleanUpQuestion;
    /**
     * Format the question body for display in a Telegram thread.
     */
    private formatQuestionBody;
}
export {};
