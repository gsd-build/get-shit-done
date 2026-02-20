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
 *   `anyAnswer` () — broadcast when any answer arrives (for long-poll wakeup)
 */
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { createLogger } from '../shared/logger.js';
const log = createLogger('question-service');
/** Maximum age (ms) of a recently answered question to allow thread reuse */
const FOLLOW_UP_WINDOW_MS = 5 * 60 * 1000;
// ─── QuestionService ──────────────────────────────────────────────────────────
export class QuestionService extends EventEmitter {
    createForumTopic;
    sendToThread;
    sendToGroup;
    sessionService;
    /** All questions ever created (pending + answered) keyed by question ID */
    questions = new Map();
    /** Maps Telegram threadId to questionId for routing incoming replies */
    threadToQuestion = new Map();
    /** Maps sessionId to list of questionIds in creation order */
    sessionQuestions = new Map();
    /** Path to the JSONL file used for question state persistence */
    stateFilePath = path.join(os.homedir(), '.claude', 'knowledge', 'question-state.jsonl');
    constructor(createForumTopic, sendToThread, sendToGroup, sessionService) {
        super();
        this.createForumTopic = createForumTopic;
        this.sendToThread = sendToThread;
        this.sendToGroup = sendToGroup;
        this.sessionService = sessionService;
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
    async ask(sessionId, question, context, timeoutMinutes) {
        const questionId = randomUUID();
        const timeout = (timeoutMinutes ?? 30) * 60 * 1000;
        // Derive a short title from the first 50 chars of the question (or first line)
        const firstLine = question.split('\n')[0] ?? question;
        const title = firstLine.slice(0, 50).trimEnd();
        const createdAt = new Date().toISOString();
        const questionRecord = {
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
        // Persist state immediately after question creation (before blocking await)
        this.saveState();
        // ─── Follow-up: reuse existing thread if session recently answered ───────
        const reuseThreadId = this.findFollowUpThread(sessionId, questionId);
        if (reuseThreadId !== null) {
            questionRecord.threadId = reuseThreadId;
            this.threadToQuestion.set(reuseThreadId, questionId);
            log.info({ questionId, sessionId, threadId: reuseThreadId }, 'Reusing existing thread for follow-up');
        }
        else {
            // ─── Create new forum thread ─────────────────────────────────────────
            try {
                const threadId = await this.createForumTopic(title);
                questionRecord.threadId = threadId;
                this.threadToQuestion.set(threadId, questionId);
                log.info({ questionId, sessionId, threadId, title }, 'Forum topic created for question');
                // Save again now that threadId is set
                this.saveState();
            }
            catch (err) {
                // Fallback: DM mode — no thread tracking possible
                log.warn({ questionId, sessionId, err: err.message }, 'createForumTopic failed — falling back to DM mode');
            }
        }
        // ─── Post question body ───────────────────────────────────────────────
        const formattedBody = this.formatQuestionBody(question, context);
        try {
            if (questionRecord.threadId !== undefined) {
                await this.sendToThread(questionRecord.threadId, formattedBody);
            }
            else {
                // DM fallback — owner only
                await this.sendToGroup(formattedBody);
            }
        }
        catch (err) {
            // Log but don't fail the ask() — the promise still blocks for an answer
            log.error({ questionId, err: err.message }, 'Failed to send question body — still waiting for answer');
        }
        // ─── Update session status to 'waiting' ──────────────────────────────
        try {
            this.sessionService.updateStatus(sessionId, 'waiting', title);
        }
        catch (err) {
            log.warn({ sessionId, err: err.message }, 'Could not update session status to waiting');
        }
        // ─── Block until answer arrives or timeout ────────────────────────────
        log.info({ questionId, sessionId, timeout }, 'Waiting for answer');
        const answer = await new Promise((resolve, reject) => {
            const onAny = (answerText) => {
                clearTimeout(timer);
                resolve(answerText);
            };
            const timer = setTimeout(() => {
                this.removeAllListeners(`answer:${questionId}`);
                // ─── Notify user in the Telegram thread before cleanup ───────────
                const timeoutMsg = `Question timed out after ${timeoutMinutes ?? 30} minutes: "${title}"`;
                const sendNotification = questionRecord.threadId !== undefined
                    ? this.sendToThread(questionRecord.threadId, timeoutMsg)
                    : this.sendToGroup(timeoutMsg);
                sendNotification.catch((err) => {
                    log.warn({ questionId, err: err.message }, 'Failed to send timeout notification to Telegram');
                });
                // Clean up question from tracking maps on timeout
                this.cleanUpQuestion(questionId);
                reject(new Error(timeoutMsg));
            }, timeout);
            this.once(`answer:${questionId}`, onAny);
        });
        // ─── Post-answer bookkeeping ──────────────────────────────────────────
        questionRecord.answer = answer;
        questionRecord.answeredAt = new Date().toISOString();
        // Persist state after answer recorded
        this.saveState();
        // Confirm receipt in the thread
        try {
            if (questionRecord.threadId !== undefined) {
                await this.sendToThread(questionRecord.threadId, 'Answer received.');
            }
        }
        catch (err) {
            log.warn({ questionId, err: err.message }, 'Failed to send answer confirmation');
        }
        // Update session status back to 'busy'
        try {
            this.sessionService.updateStatus(sessionId, 'busy');
        }
        catch (err) {
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
    deliverAnswer(threadId, text) {
        const questionId = this.threadToQuestion.get(threadId);
        if (questionId === undefined) {
            log.debug({ threadId }, 'Thread reply received but no pending question for this thread');
            return false;
        }
        log.info({ questionId, threadId }, 'Delivering answer to pending question');
        this.emit(`answer:${questionId}`, text);
        // Broadcast for check_question_answers long-poll wakeup
        this.emit('anyAnswer');
        return true;
    }
    /**
     * Return all questions that do not yet have an answer.
     */
    getPendingQuestions() {
        return Array.from(this.questions.values()).filter((q) => q.answer === undefined);
    }
    /**
     * Return all questions associated with a specific session.
     *
     * @param sessionId The session whose questions to retrieve
     */
    getSessionQuestions(sessionId) {
        const ids = this.sessionQuestions.get(sessionId) ?? [];
        return ids
            .map((id) => this.questions.get(id))
            .filter((q) => q !== undefined);
    }
    /**
     * Look up a question by the Telegram thread ID it was posted in.
     *
     * @param threadId Telegram message_thread_id
     */
    getQuestionByThread(threadId) {
        const questionId = this.threadToQuestion.get(threadId);
        if (questionId === undefined)
            return undefined;
        return this.questions.get(questionId);
    }
    /**
     * Restore question state from a previously persisted JSONL file.
     * Repopulates questions, threadToQuestion, and sessionQuestions maps.
     *
     * @param savedQuestions Array of Question objects loaded from the state file
     */
    restoreState(savedQuestions) {
        const now = Date.now();
        let staleCount = 0;
        for (const q of savedQuestions) {
            // Filter out pending questions that expired while the daemon was down
            if (q.answer === undefined) {
                const expiresAt = new Date(q.createdAt).getTime() + q.timeoutMinutes * 60 * 1000;
                if (expiresAt < now) {
                    staleCount++;
                    // Notify the user in the original thread (reusing timeout notification pattern)
                    const timeoutMsg = `Question timed out after ${q.timeoutMinutes} minutes (daemon was restarted): "${q.title}"`;
                    const notification = q.threadId !== undefined
                        ? this.sendToThread(q.threadId, timeoutMsg)
                        : this.sendToGroup(timeoutMsg);
                    notification.catch((err) => {
                        log.warn({ questionId: q.id, err: err.message }, 'Failed to send stale-question timeout notification');
                    });
                    log.info({ questionId: q.id, expiresAt: new Date(expiresAt).toISOString() }, 'Dropped stale question — expired while daemon was down');
                    continue; // Do not restore to live maps
                }
            }
            this.questions.set(q.id, q);
            if (q.threadId !== undefined && q.answer === undefined) {
                // Only restore active thread routing for unanswered questions
                this.threadToQuestion.set(q.threadId, q.id);
            }
            const sessionList = this.sessionQuestions.get(q.sessionId) ?? [];
            if (!sessionList.includes(q.id)) {
                sessionList.push(q.id);
            }
            this.sessionQuestions.set(q.sessionId, sessionList);
        }
        const restored = savedQuestions.length - staleCount;
        if (staleCount > 0) {
            log.info({ restored, stale: staleCount }, `Question state restored — dropped ${staleCount} stale question(s) expired while daemon was down`);
        }
        else {
            log.info({ count: savedQuestions.length }, 'Question state restored from file');
        }
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
    findFollowUpThread(sessionId, currentQuestionId) {
        const ids = this.sessionQuestions.get(sessionId) ?? [];
        const now = Date.now();
        let bestThreadId = null;
        let bestTime = 0;
        for (const id of ids) {
            if (id === currentQuestionId)
                continue;
            const q = this.questions.get(id);
            if (!q || q.answer === undefined || q.threadId === undefined)
                continue;
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
     * Removes the question entirely so it does not resurface as pending after restore.
     */
    cleanUpQuestion(questionId) {
        const q = this.questions.get(questionId);
        if (!q)
            return;
        if (q.threadId !== undefined) {
            this.threadToQuestion.delete(q.threadId);
        }
        // Remove from questions map so timed-out questions don't persist across restarts
        this.questions.delete(questionId);
        // Remove from session question list
        const sessionList = this.sessionQuestions.get(q.sessionId);
        if (sessionList) {
            const idx = sessionList.indexOf(questionId);
            if (idx !== -1)
                sessionList.splice(idx, 1);
        }
        // Persist the removal
        this.saveState();
        log.info({ questionId }, 'Cleaned up timed-out question from tracking maps');
    }
    /**
     * Persist current question state to the JSONL state file.
     * Writes all questions (pending and recently answered) for daemon restart recovery.
     * Errors are logged as warnings and do not propagate.
     */
    saveState() {
        try {
            const allQuestions = Array.from(this.questions.values());
            const lines = allQuestions.map((q) => JSON.stringify(q));
            const content = lines.length > 0 ? lines.join('\n') + '\n' : '';
            fs.writeFileSync(this.stateFilePath, content, 'utf8');
            log.debug({ count: allQuestions.length, path: this.stateFilePath }, 'Question state saved');
        }
        catch (err) {
            log.warn({ err: err.message }, 'Failed to save question state — state persistence skipped');
        }
    }
    /**
     * Format the question body for display in a Telegram thread.
     */
    formatQuestionBody(question, context) {
        if (context) {
            return `${question}\n\n---\nContext:\n${context}`;
        }
        return question;
    }
}
