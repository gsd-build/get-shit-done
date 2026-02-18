const MarkdownIt = require('markdown-it');
const grayMatter = require('gray-matter');

/**
 * HeaderExtractor - Extracts headers and previews from markdown documents
 *
 * Purpose: Create compact summaries by capturing section structure and first few lines
 * Usage: Both Task Context Skill and GSD Doc Compression modules
 */
class HeaderExtractor {
  constructor() {
    this.md = new MarkdownIt();
  }

  /**
   * Extract summary from markdown content
   * @param {string} markdownContent - Full markdown document
   * @param {string} absolutePath - Absolute file path for reference link
   * @returns {Object} { summary, sections, frontmatter }
   */
  extractSummary(markdownContent, absolutePath) {
    // Handle empty content edge case
    if (!markdownContent || markdownContent.trim().length === 0) {
      return {
        summary: `**Full documentation:** [View complete file](file://${absolutePath})`,
        sections: 0,
        frontmatter: {}
      };
    }

    // Parse frontmatter and content separately
    const { data: frontmatter, content } = grayMatter(markdownContent);

    // Tokenize markdown content
    const tokens = this.md.parse(content, {});

    // Build summary
    let summaryParts = [];
    let sectionCount = 0;

    // Add frontmatter if present
    if (frontmatter && Object.keys(frontmatter).length > 0) {
      summaryParts.push('---');
      for (const [key, value] of Object.entries(frontmatter)) {
        if (Array.isArray(value)) {
          summaryParts.push(`${key}: [${value.join(', ')}]`);
        } else if (typeof value === 'object') {
          summaryParts.push(`${key}: ${JSON.stringify(value)}`);
        } else {
          summaryParts.push(`${key}: ${value}`);
        }
      }
      summaryParts.push('---');
      summaryParts.push('');
    }

    // Handle case where there are no headers
    if (!tokens.some(t => t.type === 'heading_open')) {
      if (content.length < 500) {
        // Short content without headers - return as-is
        summaryParts.push(content);
      } else {
        // Long content without headers - truncate
        summaryParts.push(content.substring(0, 500) + '...');
      }
      summaryParts.push('');
      summaryParts.push(`**Full documentation:** [View complete file](file://${absolutePath})`);

      return {
        summary: summaryParts.join('\n'),
        sections: 0,
        frontmatter
      };
    }

    // Process tokens to extract headers and previews
    let currentHeader = null;
    let currentLevel = 0;
    let captureContent = false;
    let capturedChars = 0;
    let inCodeBlock = false;
    let previewLines = [];
    let bulletCount = 0;
    const MAX_PREVIEW_CHARS = 300;
    const MAX_BULLETS = 3;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // Track code blocks to skip inline content
      if (token.type === 'fence') {
        inCodeBlock = !inCodeBlock;
        continue;
      }

      // Process headers
      if (token.type === 'heading_open') {
        // Save previous section if any
        if (currentHeader) {
          this._addSection(summaryParts, currentHeader, currentLevel, previewLines);
          sectionCount++;
        }

        // Start new section
        currentLevel = parseInt(token.tag.substring(1)); // h1 -> 1, h2 -> 2, etc.
        const nextToken = tokens[i + 1];
        if (nextToken && nextToken.type === 'inline') {
          currentHeader = nextToken.content;
        }
        captureContent = true;
        capturedChars = 0;
        previewLines = [];
        bulletCount = 0;
        continue;
      }

      // Capture content after header (until we hit max chars or next header)
      if (captureContent && !inCodeBlock && capturedChars < MAX_PREVIEW_CHARS) {
        if (token.type === 'paragraph_open') {
          // Next token should be inline content
          const nextToken = tokens[i + 1];
          if (nextToken && nextToken.type === 'inline') {
            const text = nextToken.content;
            previewLines.push(text);
            capturedChars += text.length;
          }
        } else if (token.type === 'bullet_list_open') {
          // Capture bullets after header
          for (let j = i + 1; j < tokens.length && bulletCount < MAX_BULLETS; j++) {
            const bulletToken = tokens[j];
            if (bulletToken.type === 'bullet_list_close') break;
            if (bulletToken.type === 'inline' && bulletToken.content) {
              previewLines.push(`- ${bulletToken.content}`);
              bulletCount++;
              capturedChars += bulletToken.content.length;
            }
          }
        }
      }
    }

    // Add final section
    if (currentHeader) {
      this._addSection(summaryParts, currentHeader, currentLevel, previewLines);
      sectionCount++;
    }

    // Add file link footer
    summaryParts.push('');
    summaryParts.push(`**Full documentation:** [View complete file](file://${absolutePath})`);

    return {
      summary: summaryParts.join('\n'),
      sections: sectionCount,
      frontmatter
    };
  }

  /**
   * Add a section to summary parts
   * @private
   */
  _addSection(summaryParts, headerText, level, previewLines) {
    const headerMarker = '#'.repeat(level);
    summaryParts.push(`${headerMarker} ${headerText}`);
    summaryParts.push('');

    if (previewLines.length > 0) {
      // For H1, include full preview; for others add "..." if we have content
      if (level === 1) {
        summaryParts.push(previewLines.join('\n\n'));
      } else {
        // Trim preview and add ellipsis
        const preview = previewLines.join(' ').substring(0, 300);
        summaryParts.push(preview + (previewLines.join(' ').length > 300 ? '...' : ''));
      }
      summaryParts.push('');
    }
  }

  /**
   * Extract table of contents from markdown content
   * @param {string} markdownContent - Full markdown document
   * @returns {Array} Hierarchical array of headers
   */
  extractTableOfContents(markdownContent) {
    const { content } = grayMatter(markdownContent);
    const tokens = this.md.parse(content, {});

    const toc = [];
    const stack = [{ level: 0, children: toc }];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.type === 'heading_open') {
        const level = parseInt(token.tag.substring(1));
        const nextToken = tokens[i + 1];
        const title = nextToken && nextToken.type === 'inline' ? nextToken.content : '';

        const node = { level, title, children: [] };

        // Find appropriate parent
        while (stack[stack.length - 1].level >= level) {
          stack.pop();
        }

        // Add to parent's children
        stack[stack.length - 1].children.push(node);

        // Push to stack for potential children
        stack.push(node);
      }
    }

    return toc;
  }
}

module.exports = { HeaderExtractor };
