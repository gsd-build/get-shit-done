const { HeaderExtractor } = require('./header-extractor');

/**
 * SummaryGenerator - Flexible markdown summarization with multiple strategies
 *
 * Purpose: 60-70% token reduction for documentation compression
 * Strategies:
 *   - header-extraction: Structure-based (default, best for technical docs)
 *   - first-n-paragraphs: Content-based (good for narrative docs)
 *   - bullets-only: Action-focused (good for checklists/guides)
 */
class SummaryGenerator {
  constructor(options = {}) {
    this.strategy = options.strategy || 'header-extraction';
    this.maxPreviewChars = options.maxPreviewChars || 300;
    this.maxBullets = options.maxBullets || 3;
    this.includeCodeBlocks = options.includeCodeBlocks || false;
    this.extractor = new HeaderExtractor();
  }

  /**
   * Generate summary from markdown content
   * @param {string} markdownContent - Full markdown document
   * @param {string} absolutePath - Absolute file path for reference link
   * @returns {Object} { summary, originalLength, summaryLength, reductionPercent }
   */
  generate(markdownContent, absolutePath) {
    const originalLength = markdownContent.length;

    let summary;
    let metadata = {};

    switch (this.strategy) {
      case 'header-extraction':
        const result = this.extractor.extractSummary(markdownContent, absolutePath);
        summary = result.summary;
        metadata = { sections: result.sections, frontmatter: result.frontmatter };
        break;

      case 'first-n-paragraphs':
        summary = this._extractFirstParagraphs(markdownContent, absolutePath);
        break;

      case 'bullets-only':
        summary = this._extractBullets(markdownContent, absolutePath);
        break;

      default:
        throw new Error(`Unknown strategy: ${this.strategy}`);
    }

    const summaryLength = summary.length;
    const reductionPercent = this._calculateReduction(originalLength, summaryLength);

    return {
      summary,
      originalLength,
      summaryLength,
      reductionPercent,
      metadata
    };
  }

  /**
   * Extract first N paragraphs strategy
   * @private
   */
  _extractFirstParagraphs(markdownContent, absolutePath) {
    const grayMatter = require('gray-matter');
    const { data: frontmatter, content } = grayMatter(markdownContent);

    const lines = content.split('\n');
    const paragraphs = [];
    let currentParagraph = [];
    let capturedChars = 0;
    const MAX_CHARS = this.maxPreviewChars * 3; // Allow ~3 sections worth

    for (const line of lines) {
      if (line.trim() === '') {
        if (currentParagraph.length > 0) {
          const para = currentParagraph.join('\n');
          paragraphs.push(para);
          capturedChars += para.length;
          currentParagraph = [];

          if (capturedChars >= MAX_CHARS) break;
        }
      } else {
        currentParagraph.push(line);
      }
    }

    // Add remaining paragraph if any
    if (currentParagraph.length > 0 && capturedChars < MAX_CHARS) {
      paragraphs.push(currentParagraph.join('\n'));
    }

    const summaryParts = [];

    // Add frontmatter if present
    if (frontmatter && Object.keys(frontmatter).length > 0) {
      summaryParts.push('---');
      for (const [key, value] of Object.entries(frontmatter)) {
        summaryParts.push(`${key}: ${JSON.stringify(value)}`);
      }
      summaryParts.push('---');
      summaryParts.push('');
    }

    summaryParts.push(...paragraphs.slice(0, 5)); // First 5 paragraphs
    summaryParts.push('');
    summaryParts.push(`**Full documentation:** [View complete file](file://${absolutePath})`);

    return summaryParts.join('\n');
  }

  /**
   * Extract bullets only strategy
   * @private
   */
  _extractBullets(markdownContent, absolutePath) {
    const grayMatter = require('gray-matter');
    const { data: frontmatter, content } = grayMatter(markdownContent);

    const lines = content.split('\n');
    const bullets = [];
    let inList = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) {
        bullets.push(line);
        inList = true;
      } else if (trimmed === '') {
        if (inList) {
          bullets.push(''); // Preserve list breaks
        }
        inList = false;
      }
    }

    const summaryParts = [];

    // Add frontmatter if present
    if (frontmatter && Object.keys(frontmatter).length > 0) {
      summaryParts.push('---');
      for (const [key, value] of Object.entries(frontmatter)) {
        summaryParts.push(`${key}: ${JSON.stringify(value)}`);
      }
      summaryParts.push('---');
      summaryParts.push('');
    }

    if (bullets.length > 0) {
      summaryParts.push(...bullets);
    } else {
      summaryParts.push('(No bullet points found in document)');
    }

    summaryParts.push('');
    summaryParts.push(`**Full documentation:** [View complete file](file://${absolutePath})`);

    return summaryParts.join('\n');
  }

  /**
   * Calculate reduction percentage
   * @private
   */
  _calculateReduction(originalLength, summaryLength) {
    if (originalLength === 0) return 0;
    return parseFloat(((1 - summaryLength / originalLength) * 100).toFixed(1));
  }

  /**
   * Estimate tokens from text (rough approximation)
   * @static
   */
  static estimateTokens(text) {
    if (!text) return 0;
    // Rough estimate: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate reduction percentage between two texts
   * @static
   */
  static calculateReduction(originalText, summaryText) {
    const originalTokens = SummaryGenerator.estimateTokens(originalText);
    const summaryTokens = SummaryGenerator.estimateTokens(summaryText);

    if (originalTokens === 0) return 0;
    return parseFloat(((1 - summaryTokens / originalTokens) * 100).toFixed(1));
  }
}

module.exports = { SummaryGenerator, HeaderExtractor };
