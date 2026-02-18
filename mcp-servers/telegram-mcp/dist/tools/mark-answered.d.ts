/**
 * Input schema for mark_question_answered tool
 */
export interface MarkAnsweredInput {
    question_id: string;
}
/**
 * Output schema for mark_question_answered tool
 */
export interface MarkAnsweredOutput {
    success: boolean;
    archived_to: string;
}
/**
 * MCP tool definition for mark_question_answered
 */
export declare const MARK_ANSWERED_TOOL_DEF: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            question_id: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
/**
 * Handler for mark_question_answered tool
 *
 * Confirms Claude has received an answered question.
 * Note: The question must already have status="answered" and answer populated
 * (typically set by the Telegram bot when user responds).
 * The answer stays in the session file (no separate archiving).
 *
 * @param args Input arguments conforming to MarkAnsweredInput
 * @returns Output conforming to MarkAnsweredOutput
 * @throws Error if question not found or validation fails
 */
export declare function markQuestionAnsweredHandler(args: unknown): Promise<MarkAnsweredOutput>;
