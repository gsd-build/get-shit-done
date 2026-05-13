const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  parseAdrMarkdown,
  shouldRejectAdrStatus,
} = require('../get-shit-done/bin/lib/adr-parser.cjs');

describe('adr-parser', () => {
  test('maps common ADR header synonyms into canonical fields', () => {
    const markdown = [
      '# ADR-0010: Deepening Roadmap',
      '',
      '## Status',
      'Accepted',
      '',
      '## Background',
      'We need a safer ingest path.',
      '',
      '## Decision',
      '- Add `--ingest` flag.',
      '',
      '## Considered Options',
      '- Keep only `--prd`.',
      '',
      '## Out of Scope',
      '- Remote URL ingest.',
      '',
      '## Future Work',
      '- Add URL ingestion later.',
      '',
      '## Dependencies',
      '- ADR-0002',
      '',
      '## Consequences',
      '- Positive: fewer manual transforms.',
      '- Negative: parser maintenance overhead.',
    ].join('\n');

    const out = parseAdrMarkdown(markdown, { sourcePath: 'docs/adr/0010.md' });

    assert.equal(out.title, 'ADR-0010: Deepening Roadmap');
    assert.equal(out.status, 'accepted');
    assert.equal(out.source_path, 'docs/adr/0010.md');
    assert.ok(out.context.includes('safer ingest path'));
    assert.deepEqual(out.decisions, ['Add `--ingest` flag.']);
    assert.deepEqual(out.options_considered, ['Keep only `--prd`.']);
    assert.deepEqual(out.out_of_scope, ['Remote URL ingest.']);
    assert.deepEqual(out.deferred, ['Add URL ingestion later.']);
    assert.deepEqual(out.dependencies, ['ADR-0002']);
  });

  test('splits umbrella consequences into positive and negative streams', () => {
    const markdown = [
      '# ADR',
      '',
      '## Consequences',
      '- Positive: rollout is faster.',
      '- Negative: complexity increases.',
      '- Success: clear metrics.',
      '- Drawback: migration toil.',
    ].join('\n');

    const out = parseAdrMarkdown(markdown, { sourcePath: 'docs/adr/0001.md' });

    assert.deepEqual(out.consequences_positive, [
      'Positive: rollout is faster.',
      'Success: clear metrics.',
    ]);
    assert.deepEqual(out.consequences_negative, [
      'Negative: complexity increases.',
      'Drawback: migration toil.',
    ]);
  });

  test('tracks update/amendment sections as overrides', () => {
    const markdown = [
      '# ADR',
      '',
      '## Decision',
      '- First decision.',
      '',
      '## Update — locked design',
      '- Supersede with second decision.',
    ].join('\n');

    const out = parseAdrMarkdown(markdown, { sourcePath: 'docs/adr/0002.md' });
    assert.ok(out.updates.length >= 1);
    assert.ok(out.updates[0].heading.toLowerCase().includes('update'));
    assert.ok(out.updates[0].entries.includes('Supersede with second decision.'));
  });

  test('reject-status helper blocks superseded/rejected/deprecated', () => {
    assert.equal(shouldRejectAdrStatus('superseded'), true);
    assert.equal(shouldRejectAdrStatus('rejected'), true);
    assert.equal(shouldRejectAdrStatus('deprecated'), true);
    assert.equal(shouldRejectAdrStatus('accepted'), false);
    assert.equal(shouldRejectAdrStatus('proposed'), false);
    assert.equal(shouldRejectAdrStatus(''), false);
  });
});
