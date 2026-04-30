jest.mock('fs', () => ({
  readFileSync: jest.fn(() => 'mock-public-key'),
}));

describe('app', () => {
  test('loads app without crashing', () => {
    const app = require('../../src/app');
    expect(app).toBeDefined();
  });
});