import { expect, test, describe, beforeEach } from 'vitest';
import * as path from 'path';
import {
  getPathToFile,
  getContentFile,
  getContent,
  getCoverageColor,
  escapeHtml,
  escapeHtmlAttr,
  encodePath,
  hasParentSegment,
} from '../src/utils';
import { spyCore } from './setup';

describe('getPathToFile', () => {
  test('should return null for empty input', () => {
    expect(getPathToFile('')).toBeNull();
  });

  test('should return absolute path as-is', () => {
    expect(getPathToFile('/tmp/coverage.txt')).toBe('/tmp/coverage.txt');
  });

  test('should prepend GITHUB_WORKSPACE for relative path', () => {
    const original = process.env.GITHUB_WORKSPACE;
    try {
      process.env.GITHUB_WORKSPACE = '/home/runner/work/repo';
      expect(getPathToFile('coverage.txt')).toBe(
        '/home/runner/work/repo/coverage.txt',
      );
    } finally {
      if (original === undefined) {
        delete process.env.GITHUB_WORKSPACE;
      } else {
        process.env.GITHUB_WORKSPACE = original;
      }
    }
  });
});

describe('getContentFile', () => {
  beforeEach(() => {
    spyCore.warning.mockClear();
    spyCore.info.mockClear();
  });

  test('should return null for null input', () => {
    expect(getContentFile(null)).toBeNull();
  });

  test('should return null for empty string', () => {
    expect(getContentFile('')).toBeNull();
  });

  test('should warn and return null for non-existent file', () => {
    expect(getContentFile('/nonexistent/file.txt')).toBeNull();
    expect(spyCore.warning).toHaveBeenCalledTimes(1);
    expect(spyCore.warning).toHaveBeenCalledWith(
      expect.stringContaining("doesn't exist"),
    );
  });

  test('should read existing file successfully', () => {
    const fixturePath = path.resolve(
      __dirname,
      '..',
      'data',
      'pytest-coverage_4.txt',
    );
    const content = getContentFile(fixturePath);
    expect(content).not.toBeNull();
    expect(content).toContain('TOTAL');
    expect(spyCore.info).toHaveBeenCalledWith(
      expect.stringContaining('File read successfully'),
    );
  });
});

describe('getContent', () => {
  beforeEach(() => {
    spyCore.error.mockClear();
  });

  test('should return null for empty path', () => {
    expect(getContent('')).toBeNull();
  });

  test('should return content for valid absolute path', () => {
    const fixturePath = path.resolve(
      __dirname,
      '..',
      'data',
      'pytest-coverage_4.txt',
    );
    const content = getContent(fixturePath);
    expect(content).not.toBeNull();
    expect(content).toContain('TOTAL');
  });
});

describe('getCoverageColor', () => {
  test('should return red for 0%', () => {
    expect(getCoverageColor('0')).toBe('red');
  });

  test('should return red for 39%', () => {
    expect(getCoverageColor('39')).toBe('red');
  });

  test('should return orange for 40%', () => {
    expect(getCoverageColor('40')).toBe('orange');
  });

  test('should return orange for 59%', () => {
    expect(getCoverageColor('59')).toBe('orange');
  });

  test('should return yellow for 60%', () => {
    expect(getCoverageColor('60')).toBe('yellow');
  });

  test('should return yellow for 79%', () => {
    expect(getCoverageColor('79')).toBe('yellow');
  });

  test('should return green for 80%', () => {
    expect(getCoverageColor('80')).toBe('green');
  });

  test('should return green for 89%', () => {
    expect(getCoverageColor('89')).toBe('green');
  });

  test('should return brightgreen for 90%', () => {
    expect(getCoverageColor('90')).toBe('brightgreen');
  });

  test('should return brightgreen for 100%', () => {
    expect(getCoverageColor('100')).toBe('brightgreen');
  });

  test('should handle percentage string with % sign', () => {
    expect(getCoverageColor('85%')).toBe('green');
  });

  test('should handle numeric input', () => {
    expect(getCoverageColor(75)).toBe('yellow');
  });

  test('should default to red for NaN', () => {
    expect(getCoverageColor('abc')).toBe('red');
  });
});

describe('escapeHtml', () => {
  test('should escape &, < and >', () => {
    expect(escapeHtml('a & <b>"c"</b>')).toBe('a &amp; &lt;b&gt;"c"&lt;/b&gt;');
  });

  test('should leave plain text unchanged', () => {
    expect(escapeHtml('src/app.py')).toBe('src/app.py');
  });
});

describe('escapeHtmlAttr', () => {
  test('should also escape double quotes', () => {
    expect(escapeHtmlAttr('a"><b>')).toBe('a&quot;&gt;&lt;b&gt;');
  });
});

describe('encodePath', () => {
  test('should encode each segment and keep slashes', () => {
    expect(encodePath('tests/my file#1.py')).toBe('tests/my%20file%231.py');
  });

  test('should leave a plain path unchanged', () => {
    expect(encodePath('src/utils/helpers.py')).toBe('src/utils/helpers.py');
  });

  test('should not throw on a lone surrogate', () => {
    expect(encodePath('src/\ud800.py')).toBe('src/%EF%BF%BD.py');
  });
});

describe('hasParentSegment', () => {
  test('should detect a .. segment', () => {
    expect(hasParentSegment('../a/b.py')).toBe(true);
    expect(hasParentSegment('a/../b.py')).toBe(true);
  });

  test('should allow regular paths', () => {
    expect(hasParentSegment('src/..a/b..py')).toBe(false);
  });
});
