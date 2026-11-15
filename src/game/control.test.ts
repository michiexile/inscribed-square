import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTROL } from './control';

describe('DEFAULT_CONTROL', () => {
  it('is drag the centre, which works with one finger', () => {
    expect(DEFAULT_CONTROL).toBe('centre');
  });
});
