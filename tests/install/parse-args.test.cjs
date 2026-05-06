const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs, USAGE } = require('../../bin/lib/gsd-ic/parse-args.cjs');

describe('parseArgs', () => {
  it('parses install --customer=nga', () => {
    const opts = parseArgs(['install', '--customer=nga']);
    assert.equal(opts.subcommand, 'install');
    assert.equal(opts.customer, 'nga');
    assert.equal(opts.target, process.cwd());
  });

  it('parses --customer=<name> in any position', () => {
    const a = parseArgs(['--customer=nsa', 'install']);
    assert.equal(a.customer, 'nsa');
  });

  it('parses --target=<path>', () => {
    const opts = parseArgs(['install', '--customer=nga', '--target=/tmp/foo']);
    assert.equal(opts.target, '/tmp/foo');
  });

  it('rejects unknown subcommand', () => {
    assert.throws(() => parseArgs(['blammo']), /unknown subcommand/i);
  });

  it('requires --customer for install', () => {
    assert.throws(() => parseArgs(['install']), /--customer/);
  });

  it('rejects unknown customer', () => {
    assert.throws(() => parseArgs(['install', '--customer=mars']), /unknown customer/i);
  });

  it('accepts each known customer name', () => {
    for (const c of ['nga', 'nsa', 'nro', 'cia', 'dia']) {
      assert.equal(parseArgs(['install', `--customer=${c}`]).customer, c);
    }
  });

  it('exports a USAGE string', () => {
    assert.match(USAGE, /npx @adelphi\/gsd-ic install/);
  });

  it('treats --help as a request to print usage and exit cleanly', () => {
    const opts = parseArgs(['--help']);
    assert.equal(opts.subcommand, 'help');
  });
});
