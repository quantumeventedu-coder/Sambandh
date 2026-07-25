// @ts-check
// services/trust/detectors/index.js — registers the in-house detectors into the AAV
// provider registry, so the Trust Engine DECIDES with no third party.
//
// Registration is a BOOT-TIME call (registerBuiltins), not a module-load side effect:
// the registry's fail-secure default (an unregistered capability → 'unknown' → cannot
// auto-approve) stays the ground truth, and unit tests can exercise both the
// registered and the unconfigured behaviour deterministically.

const providers = require('../providers');
const { detectGenerativeImage } = require('./image-forensics');
const { scanMalware } = require('./malware-scan');
const { assessIp } = require('./ip-intel');

let _registered = false;

/** Register the built-in detectors (idempotent). Call once at server boot. */
function registerBuiltins() {
  if (_registered) return;
  // input from the orchestrator is { buf, ctx } (see services/trust/index.js).
  providers.register('ai-image', async (/** @type {any} */ input) => detectGenerativeImage(input && input.buf));
  providers.register('malware', async (/** @type {any} */ input) => scanMalware(input && input.buf));
  providers.register('ip-intel', async (/** @type {any} */ input) => assessIp(input && input.ctx && input.ctx.ip));
  _registered = true;
}

/** Test helper — allow re-registration after providers._reset(). */
function _resetRegistered() { _registered = false; }

module.exports = { registerBuiltins, _resetRegistered };
