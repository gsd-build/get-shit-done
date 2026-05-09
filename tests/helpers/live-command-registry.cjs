'use strict';
// Stub for RED phase. Will be implemented in GREEN.
let _cache = null;
function getLiveCommandTokens() {
  if (_cache) return _cache;
  _cache = new Set();
  return _cache;
}
module.exports = { getLiveCommandTokens };
