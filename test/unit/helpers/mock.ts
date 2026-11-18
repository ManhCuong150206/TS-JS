import { jest } from '@jest/globals';

type LooseFunction = (...args: any[]) => any;

export function mockFn(implementation?: LooseFunction) {
  return jest.fn<LooseFunction>(implementation);
}
