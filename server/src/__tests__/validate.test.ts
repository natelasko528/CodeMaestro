import { validateInboundMessage } from '../validate.js';

describe('validateInboundMessage', () => {
  test('accepts USER_PROMPT with text', () => {
    const res = validateInboundMessage({ type: 'USER_PROMPT', sessionId: 'S-1', payload: { text: 'hi' } });
    expect(res.ok).toBe(true);
  });

  test('rejects unknown type', () => {
    const res = validateInboundMessage({ type: 'NOPE', sessionId: 'S-1' });
    expect(res.ok).toBe(false);
  });
});
