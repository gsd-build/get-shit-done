'use strict';

/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: sdk/src/query/state-document.ts
 * Regenerate: cd sdk && npm run gen:state-document
 *
 * STATE.md Document Module — pure transforms for STATE.md text.
 * This module does not read the filesystem and does not own persistence or locking.
 */

// Internal helpers
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toFiniteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function existingProgressExceedsDerived(existingProgress, derivedProgress, key) {
    const existing = toFiniteNumber(existingProgress[key]);
    const derived = toFiniteNumber(derivedProgress[key]);
    return existing !== null && derived !== null && existing > derived;
}

function stateExtractField(content, fieldName) {
    const escaped = escapeRegex(fieldName);
    const boldPattern = new RegExp(`\\*\\*${escaped}:\\*\\*[ \\t]*(.+)`, 'i');
    const boldMatch = content.match(boldPattern);
    if (boldMatch)
        return boldMatch[1].trim();
    const plainPattern = new RegExp(`^${escaped}:[ \\t]*(.+)`, 'im');
    const plainMatch = content.match(plainPattern);
    return plainMatch ? plainMatch[1].trim() : null;
}

function stateReplaceField(content, fieldName, newValue) {
    const escaped = escapeRegex(fieldName);
    const boldPattern = new RegExp(`(\\*\\*${escaped}:\\*\\*\\s*)(.*)`, 'i');
    if (boldPattern.test(content)) {
        return content.replace(boldPattern, (_match, prefix) => `${prefix}${newValue}`);
    }
    const plainPattern = new RegExp(`(^${escaped}:\\s*)(.*)`, 'im');
    if (plainPattern.test(content)) {
        return content.replace(plainPattern, (_match, prefix) => `${prefix}${newValue}`);
    }
    return null;
}

function stateReplaceFieldWithFallback(content, primary, fallback, value) {
    let result = stateReplaceField(content, primary, value);
    if (result)
        return result;
    if (fallback) {
        result = stateReplaceField(content, fallback, value);
        if (result)
            return result;
    }
    return content;
}

function normalizeStateStatus(status, pausedAt) {
    let normalizedStatus = status || 'unknown';
    const statusLower = (status || '').toLowerCase();
    if (statusLower.includes('paused') || statusLower.includes('stopped') || pausedAt) {
        normalizedStatus = 'paused';
    }
    else if (statusLower.includes('executing') || statusLower.includes('in progress')) {
        normalizedStatus = 'executing';
    }
    else if (statusLower.includes('planning') || statusLower.includes('ready to plan')) {
        normalizedStatus = 'planning';
    }
    else if (statusLower.includes('discussing')) {
        normalizedStatus = 'discussing';
    }
    else if (statusLower.includes('verif')) {
        normalizedStatus = 'verifying';
    }
    else if (statusLower.includes('complete') || statusLower.includes('done')) {
        normalizedStatus = 'completed';
    }
    else if (statusLower.includes('ready to execute')) {
        normalizedStatus = 'executing';
    }
    return normalizedStatus;
}

function computeProgressPercent(completedPlans, totalPlans, completedPhases, totalPhases) {
    const hasPlanData = totalPlans !== null && totalPlans > 0 && completedPlans !== null;
    const hasPhaseData = totalPhases !== null && totalPhases > 0 && completedPhases !== null;
    if (!hasPlanData && !hasPhaseData)
        return null;
    const planFraction = hasPlanData ? completedPlans / totalPlans : 1;
    const phaseFraction = hasPhaseData ? completedPhases / totalPhases : 1;
    return Math.min(100, Math.round(Math.min(planFraction, phaseFraction) * 100));
}

function shouldPreserveExistingProgress(existingProgress, derivedProgress) {
    if (!existingProgress || typeof existingProgress !== 'object')
        return false;
    if (!derivedProgress || typeof derivedProgress !== 'object')
        return false;
    const existing = existingProgress;
    const derived = derivedProgress;
    return (existingProgressExceedsDerived(existing, derived, 'total_phases') ||
        existingProgressExceedsDerived(existing, derived, 'completed_phases') ||
        existingProgressExceedsDerived(existing, derived, 'total_plans') ||
        existingProgressExceedsDerived(existing, derived, 'completed_plans'));
}

function normalizeProgressNumbers(progress) {
    if (!progress || typeof progress !== 'object')
        return progress;
    const normalized = { ...progress };
    for (const key of ['total_phases', 'completed_phases', 'total_plans', 'completed_plans', 'percent']) {
        const number = toFiniteNumber(normalized[key]);
        if (number !== null)
            normalized[key] = number;
    }
    return normalized;
}

module.exports = { stateExtractField, stateReplaceField, stateReplaceFieldWithFallback, normalizeStateStatus, computeProgressPercent, shouldPreserveExistingProgress, normalizeProgressNumbers };
