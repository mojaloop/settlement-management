// const request = require('supertest');
const server = require('../index');

afterAll(() => {
    server.close(); // tear down
});

jest.genMockFromModule('node-fetch');
jest.mock('node-fetch', () => jest.fn().mockImplementation(() => Promise.resolve({ staus: 200, statusText: 'OK', ok: true })));

test('sample test', () => {
    expect(2 + 2).toEqual(4);
});
