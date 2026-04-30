process.env.NODE_ENV = 'test';

describe('jwtMiddleware basic load', () => {
  test('module loads without crashing', () => {
    expect(() => require('../../src/middleware/jwtMiddleware')).not.toThrow();
  });
});