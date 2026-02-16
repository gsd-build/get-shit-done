#!/usr/bin/env node

/**
 * Telegram Requirement Gatherer
 *
 * Haiku-powered subagent for gathering requirements via conversation.
 * Asks clarifying questions until requirements are clear, then decides:
 * - Add as new phase (/gsd:add-phase or /gsd:insert-phase)
 * - Add to .planning/todo/ideas.md (future ideas)
 * - Add to .planning/todo/next-milestone.md (next milestone features)
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { logDecision, logBotResponse } = require('./telegram-session-logger.js');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Gather requirements from user via multi-turn conversation
 * @param {function} sendMessage - Function to send message to user
 * @param {function} waitForResponse - Function to wait for user response (returns promise)
 * @param {string} initialMessage - User's initial requirement message
 * @returns {object} - { destination, content, reasoning }
 */
async function gatherRequirements(sendMessage, waitForResponse, initialMessage) {
  const conversationHistory = [
    {
      role: 'user',
      content: initialMessage
    }
  ];

  // Load current project context
  const projectContext = loadProjectContext();

  const systemPrompt = `You are a requirement gathering assistant for GSD (Get Shit Done) autonomous development system.

Your job: Clarify user requirements through conversation, then decide where to route them.

Current Project Context:
${projectContext}

Conversation Protocol:
1. Ask clarifying questions ONE AT A TIME until requirements are clear
2. Focus on: What, Why, Priority, Dependencies, Scope
3. Keep questions short and specific
4. When requirements are clear, respond with DECISION format (see below)

DECISION Format (use when ready):
<decision>
<destination>add_phase|insert_phase|todo_ideas|todo_next_milestone</destination>
<position>end|after:3|before:5</position>
<title>Short phase/feature title</title>
<reasoning>Why this destination and position</reasoning>
<content>
Full requirement description
</content>
</decision>

Destination Rules:
- add_phase: New phase at END of current milestone (use when: fits current milestone scope, logical next step)
- insert_phase: New phase at SPECIFIC position (use when: urgent, must happen before existing phase)
- todo_ideas: Future ideas (use when: interesting but not for current milestone, needs more research)
- todo_next_milestone: Next milestone feature (use when: clear value but beyond current milestone scope)

Continue asking questions until you're confident about destination.`;

  let turn = 0;
  const maxTurns = 10;

  while (turn < maxTurns) {
    turn++;

    // Call Haiku
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4',
      max_tokens: 1000,
      system: systemPrompt,
      messages: conversationHistory
    });

    const assistantMessage = response.content[0].text;

    // Check if decision made
    if (assistantMessage.includes('<decision>')) {
      const decision = parseDecision(assistantMessage);
      logDecision(decision.destination, decision.reasoning, decision.title);
      return decision;
    }

    // Send question to user
    await sendMessage(assistantMessage);
    logBotResponse(assistantMessage);

    // Wait for user response
    const userResponse = await waitForResponse();

    // Check if user wants to end
    if (/^(done|finish|end|stop|cancel)$/i.test(userResponse.trim())) {
      await sendMessage("Requirements gathering cancelled. No changes made.");
      return null;
    }

    // Add to conversation history
    conversationHistory.push({
      role: 'assistant',
      content: assistantMessage
    });
    conversationHistory.push({
      role: 'user',
      content: userResponse
    });
  }

  // Max turns reached
  await sendMessage("Reached conversation limit. Please try again with more specific requirements.");
  return null;
}

/**
 * Load project context for Haiku
 */
function loadProjectContext() {
  const parts = [];

  // Load current milestone info
  try {
    const roadmap = fs.readFileSync('.planning/ROADMAP.md', 'utf8');
    const milestoneMatch = roadmap.match(/## Overview\n\n([\s\S]*?)\n\n##/);
    if (milestoneMatch) {
      parts.push(`Milestone Overview:\n${milestoneMatch[1]}`);
    }

    // Extract current phases
    const phasesMatch = roadmap.match(/## Phases\n\n([\s\S]*?)\n\n## Phase Details/);
    if (phasesMatch) {
      parts.push(`Current Phases:\n${phasesMatch[1]}`);
    }
  } catch (err) {
    parts.push('ROADMAP.md not found');
  }

  // Load STATE.md position
  try {
    const state = fs.readFileSync('.planning/STATE.md', 'utf8');
    const positionMatch = state.match(/## Current Position\n\n([\s\S]*?)\n\n##/);
    if (positionMatch) {
      parts.push(`Current Position:\n${positionMatch[1]}`);
    }
  } catch (err) {
    parts.push('STATE.md not found');
  }

  return parts.join('\n\n');
}

/**
 * Parse decision from Haiku response
 */
function parseDecision(text) {
  const destinationMatch = text.match(/<destination>(.*?)<\/destination>/);
  const positionMatch = text.match(/<position>(.*?)<\/position>/);
  const titleMatch = text.match(/<title>(.*?)<\/title>/);
  const reasoningMatch = text.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
  const contentMatch = text.match(/<content>([\s\S]*?)<\/content>/);

  return {
    destination: destinationMatch?.[1] || 'todo_ideas',
    position: positionMatch?.[1] || 'end',
    title: titleMatch?.[1] || 'New Feature',
    reasoning: reasoningMatch?.[1]?.trim() || 'No reasoning provided',
    content: contentMatch?.[1]?.trim() || 'No content provided'
  };
}

/**
 * Execute decision by calling appropriate GSD command
 */
async function executeDecision(decision, sendMessage) {
  const { destination, position, title, content } = decision;

  try {
    switch (destination) {
      case 'add_phase':
        // Call /gsd:add-phase
        execSync(`node get-shit-done/bin/gsd-tools.js add-phase "${title}" "${content}"`);
        await sendMessage(`✅ Added as new phase: "${title}"\n\nRun /gsd:plan-phase <phase> to create execution plan.`);
        break;

      case 'insert_phase':
        // Parse position (e.g., "after:3" or "before:5")
        const posMatch = position.match(/(after|before):(\d+)/);
        if (posMatch) {
          const [, placement, phaseNum] = posMatch;
          // Call /gsd:insert-phase
          execSync(`node get-shit-done/bin/gsd-tools.js insert-phase ${phaseNum} "${title}" "${content}"`);
          await sendMessage(`✅ Inserted as phase ${placement} ${phaseNum}: "${title}"\n\nRun /gsd:plan-phase <phase> to create execution plan.`);
        } else {
          throw new Error('Invalid position format');
        }
        break;

      case 'todo_ideas':
        // Append to .planning/todo/ideas.md
        appendToFile('.planning/todo/ideas.md', `## ${title}\n\n${content}\n\n*Added: ${new Date().toISOString().split('T')[0]}*\n\n---\n\n`);
        await sendMessage(`💡 Added to future ideas: "${title}"\n\nSee .planning/todo/ideas.md`);
        break;

      case 'todo_next_milestone':
        // Append to .planning/todo/next-milestone.md
        appendToFile('.planning/todo/next-milestone.md', `## ${title}\n\n${content}\n\n*Added: ${new Date().toISOString().split('T')[0]}*\n\n---\n\n`);
        await sendMessage(`📋 Added to next milestone: "${title}"\n\nSee .planning/todo/next-milestone.md`);
        break;

      default:
        await sendMessage(`❌ Unknown destination: ${destination}`);
    }
  } catch (error) {
    await sendMessage(`❌ Error executing decision: ${error.message}`);
    throw error;
  }
}

/**
 * Append content to file
 */
function appendToFile(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `# ${path.basename(filePath, '.md').replace(/-/g, ' ').toUpperCase()}\n\n`);
  }

  fs.appendFileSync(filePath, content);
}

module.exports = {
  gatherRequirements,
  executeDecision,
  loadProjectContext
};
