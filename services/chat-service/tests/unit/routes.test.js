jest.mock('fs', () => ({
  readFileSync: jest.fn(() => 'mock-public-key'),
}));

describe('routes', () => {
  test('message routes load', () => {
    const routes = require('../../src/routes/messageRoutes');
    expect(routes).toBeDefined();
  });

  test('room routes load', () => {
    const routes = require('../../src/routes/roomRoutes');
    expect(routes).toBeDefined();
  });
});