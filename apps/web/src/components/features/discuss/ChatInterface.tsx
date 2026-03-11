'use client';

import { useRef, useEffect, useCallback } from 'react';
import { ConnectionBanner } from './ConnectionBanner';
import { ProgressStepper, DEFAULT_TOPICS, type TopicStep } from './ProgressStepper';
import { WelcomeScreen } from './WelcomeScreen';
import { MessageBubble } from './MessageBubble';
import { StreamingMessage } from './StreamingMessage';
import { TypingIndicator } from './TypingIndicator';
import { QuestionCard } from './QuestionCard';
import { ChatInput } from './ChatInput';
import type { Message } from '@/stores/discussStore';

interface ChatInterfaceProps {
  /** List of messages to display */
  messages: Message[];
  /** Whether socket is connected */
  isConnected: boolean;
  /** Whether actively streaming */
  isStreaming: boolean;
  /** Current streaming text with typewriter effect */
  streamingText: string;
  /** Current topic index for progress stepper */
  topicIndex: number;
  /** Topic steps (defaults to DEFAULT_TOPICS) */
  topics?: TopicStep[];
  /** Phase number for welcome screen */
  phaseNumber?: string;
  /** Phase name for welcome screen */
  phaseName?: string;
  /** Called when user sends a message */
  onSendMessage: (message: string) => void;
  /** Called when question option is selected */
  onSelectOption: (messageId: string, optionId: string) => void;
  /** Called when topic step is clicked */
  onTopicClick?: (index: number) => void;
}

/**
 * Main chat interface container.
 *
 * Layout:
 * - ConnectionBanner at top (conditional)
 * - ProgressStepper below banner
 * - Message list with auto-scroll
 * - WelcomeScreen when no messages
 * - ChatInput at bottom (sticky)
 */
export function ChatInterface({
  messages,
  isConnected,
  isStreaming,
  streamingText,
  topicIndex,
  topics = DEFAULT_TOPICS,
  phaseNumber,
  phaseName,
  onSendMessage,
  onSelectOption,
  onTopicClick,
}: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming updates
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, streamingText, scrollToBottom]);

  const hasMessages = messages.length > 0;
  const showTypingIndicator = isStreaming && !streamingText;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Connection banner */}
      <ConnectionBanner isConnected={isConnected} />

      {/* Progress stepper */}
      <ProgressStepper
        steps={topics}
        currentIndex={topicIndex}
        {...(onTopicClick && { onStepClick: onTopicClick })}
      />

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {!hasMessages ? (
          <WelcomeScreen
            {...(phaseNumber && { phaseNumber })}
            {...(phaseName && { phaseName })}
          />
        ) : (
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.map((message) => (
              <div key={message.id}>
                {/* Regular message bubble */}
                <MessageBubble
                  role={message.role}
                  content={message.content}
                  timestamp={message.timestamp}
                />

                {/* Question card if present */}
                {message.questionCard && (
                  <div className="mt-2">
                    <QuestionCard
                      messageId={message.id}
                      options={message.questionCard.options}
                      multiSelect={message.questionCard.multiSelect}
                      selected={message.questionCard.selected}
                      onSelect={onSelectOption}
                    />
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator while waiting for first token */}
            {showTypingIndicator && <TypingIndicator />}

            {/* Streaming message with typewriter effect */}
            {isStreaming && streamingText && (
              <StreamingMessage
                displayedText={streamingText}
                isStreaming={isStreaming}
              />
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Chat input */}
      <ChatInput
        onSend={onSendMessage}
        disabled={isStreaming}
        placeholder={hasMessages ? 'Continue the conversation...' : 'Start discussing...'}
      />
    </div>
  );
}

export default ChatInterface;
