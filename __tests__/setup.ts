import * as core from '@actions/core';
import { vi } from 'vitest';

// Mock functions from '@actions/core'
// to make sure the console doesn't get polluted
// and the output won't be interpreted in CI.
// '@actions/core' is pure ESM, so its exports can't be spied on with
// vi.spyOn — they are replaced with vi.fn() via vi.mock instead.
vi.mock('@actions/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@actions/core')>()),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  startGroup: vi.fn(),
  endGroup: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
}));

export const spyCore = {
  info: vi.mocked(core.info),
  warning: vi.mocked(core.warning),
  error: vi.mocked(core.error),
  startGroup: vi.mocked(core.startGroup),
  endGroup: vi.mocked(core.endGroup),
  setOutput: vi.mocked(core.setOutput),
  setFailed: vi.mocked(core.setFailed),
};
