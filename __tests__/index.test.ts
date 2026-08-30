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

import {
  enforceCommentLength,
  tooLongNotice,
  truncateSummary,
} from '../src/index';

const MAX_COMMENT_LENGTH = 65536;

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

describe('tooLongNotice', () => {
  test('should mention the maximum length', () => {
    const result = tooLongNotice(null);
    expect(result).toContain('> [!WARNING]');
    // prettier-ignore
    expect(result).toContain('too long (maximum is 65536 characters)');
  });

  test('should link to the job log when a run url is given', () => {
    const runUrl = 'https://github.com/owner/test/actions/runs/42';
    const result = tooLongNotice(runUrl);
    expect(result).toContain(`[job log](${runUrl})`);
  });

  test('should omit the link when no run url is given', () => {
    const result = tooLongNotice(null);
    expect(result).not.toContain('job log');
    expect(result).not.toContain('](');
  });

  test('should keep every line inside the blockquote', () => {
    const result = tooLongNotice('https://example.com/run');
    expect(result.split('\n').every((line) => line.startsWith('>'))).toBe(true);
  });
});

describe('enforceCommentLength', () => {
  test('should return the body unchanged when within the limit', () => {
    const body = 'Short comment body';
    expect(enforceCommentLength(body)).toBe(body);
  });

  test('should return the body unchanged at exactly the limit', () => {
    const body = 'a'.repeat(MAX_COMMENT_LENGTH);
    expect(enforceCommentLength(body)).toBe(body);
  });

  test('should truncate an oversized body below the limit', () => {
    const body = 'line\n'.repeat(20000); // 100,000 characters
    const result = enforceCommentLength(body);
    expect(result.length).toBeLessThanOrEqual(MAX_COMMENT_LENGTH);
  });

  test('should append the truncation warning when cutting', () => {
    const body = 'line\n'.repeat(20000);
    const result = enforceCommentLength(body);
    // prettier-ignore
    expect(result).toContain("**Warning: Comment truncated due to GitHub's 65,536 character limit**");
  });

  test('should keep the beginning of the body so the watermark survives', () => {
    const watermark = '<!-- Pytest Coverage Comment: some-id -->\n';
    const body = watermark + 'line\n'.repeat(20000);
    const result = enforceCommentLength(body);
    expect(result.startsWith(watermark)).toBe(true);
  });
});
