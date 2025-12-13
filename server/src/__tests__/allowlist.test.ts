import { assertAllowlisted } from '../toolRunner.js';

describe('tool allowlist', () => {
  test('allows exact npm test', () => {
    expect(() => assertAllowlisted('npm test')).not.toThrow();
  });

  test('blocks chaining', () => {
    expect(() => assertAllowlisted('npm test && echo hi')).toThrow();
  });

  test('blocks non-allowlisted', () => {
    expect(() => assertAllowlisted('echo hi')).toThrow();
  });
});
