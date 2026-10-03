import * as core from '@actions/core';
import { vi } from 'vitest';

// Spy and mock functions from '@actions/core'
// to make sure the console doesn't get polluted
// and the output won't be interpreted in CI.
export const spyCore = {
  info: vi.spyOn(core, 'info').mockImplementation(() => {}),
  warning: vi.spyOn(core, 'warning').mockImplementation(() => {}),
  error: vi.spyOn(core, 'error').mockImplementation(() => {}),
  startGroup: vi.spyOn(core, 'startGroup').mockImplementation(() => {}),
  endGroup: vi.spyOn(core, 'endGroup').mockImplementation(() => {}),
  setOutput: vi.spyOn(core, 'setOutput').mockImplementation(() => {}),
  setFailed: vi.spyOn(core, 'setFailed').mockImplementation(() => {}),
};
