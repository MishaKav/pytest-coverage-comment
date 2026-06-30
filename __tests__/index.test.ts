import { expect, test, describe, vi } from 'vitest';

// Mock @actions/github before importing index to avoid ESM/CJS issues
vi.mock('@actions/github', () => ({
  context: {
    repo: { repo: 'test', owner: 'owner' },
    eventName: 'push',
    payload: {},
    job: 'test-job',
    ref: 'refs/heads/main',
    sha: 'abc123',
    serverUrl: 'https://github.com',
  },
  getOctokit: vi.fn(),
}));

import { truncateSummary, getCommentWatermarks } from '../src/index';

describe('truncateSummary', () => {
  test('should return content as-is when under limit', () => {
    const content = 'Short content';
    expect(truncateSummary(content, 1000)).toBe(content);
  });

  test('should truncate content that exceeds limit', () => {
    const content = 'A'.repeat(2000);
    const result = truncateSummary(content, 1000);
    expect(result.length).toBeLessThanOrEqual(1000);
    expect(result).toContain('**Warning: Summary truncated');
  });

  test('should try to break at newline', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i}`).join(
      '\n',
    );
    const result = truncateSummary(lines, 500);
    expect(result).toContain('**Warning: Summary truncated');
  });

  test('should handle exact limit', () => {
    const content = 'Exact';
    expect(truncateSummary(content, 5)).toBe('Exact');
  });
});

describe('getCommentWatermarks', () => {
  test('should include workflow and keep legacy fallback for compatibility', () => {
    const watermarks = getCommentWatermarks(
      { workflow: 'workflow_A', job: 'coverage' },
      '',
    );
    expect(watermarks).toEqual([
      '<!-- Pytest Coverage Comment: workflow_A coverage -->\n',
      '<!-- Pytest Coverage Comment: coverage -->\n',
    ]);
  });

  test('should include unique id in both workflow and legacy watermarks', () => {
    const watermarks = getCommentWatermarks(
      { workflow: 'workflow_A', job: 'coverage' },
      '3.12-linux',
    );
    expect(watermarks).toEqual([
      '<!-- Pytest Coverage Comment: workflow_A coverage | 3.12-linux -->\n',
      '<!-- Pytest Coverage Comment: coverage | 3.12-linux -->\n',
    ]);
  });

  test('should return single watermark when workflow is unavailable', () => {
    const watermarks = getCommentWatermarks({ job: 'coverage' }, '');
    expect(watermarks).toEqual(['<!-- Pytest Coverage Comment: coverage -->\n']);
  });
});
