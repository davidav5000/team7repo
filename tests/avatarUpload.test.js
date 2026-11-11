const request = require('supertest');
const express = require('express');
jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  unlink: jest.fn(),
}));
jest.mock('../models/user', () => ({
  findPublicById: jest.fn(),
  updateAvatar: jest.fn(),
}));
const fs = require('node:fs/promises');
const User = require('../models/user');
const users = require('../routes/users');
const image = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]);
function app(userId = 42) {
  const server = express();
  server.use((req, _res, next) => {
    req.session = { userId };
    next();
  });
  server.use('/users', users);
  server.use((err, _req, res, _next) =>
    res.status(err.status || 500).json({ error: err.message }),
  );
  return server;
}
beforeEach(() => {
  jest.resetAllMocks();
  fs.mkdir.mockResolvedValue();
  fs.writeFile.mockResolvedValue();
  fs.unlink.mockResolvedValue();
  User.findPublicById.mockResolvedValue({ id: 42 });
  User.updateAvatar.mockImplementation(async (_id, avatarUrl) => ({ avatarUrl }));
});
test('stores the uploaded photo for the session user with a generated filename', async () => {
  const res = await request(app())
    .post('/users/me/avatar/upload')
    .type('image/jpeg')
    .send(image);
  expect(res.status).toBe(200);
  expect(res.body.avatarUrl).toMatch(/^\/uploads\/avatars\/[a-f0-9-]+\.jpg$/);
  expect(User.updateAvatar).toHaveBeenCalledWith(42, res.body.avatarUrl);
  expect(fs.writeFile).toHaveBeenCalledWith(
    expect.stringMatching(/\.jpg$/),
    image,
    expect.objectContaining({ flag: 'wx' }),
  );
});
test('requires login before processing uploads', async () => {
  const res = await request(app(null))
    .post('/users/me/avatar/upload')
    .type('image/jpeg')
    .send(image);
  expect(res.status).toBe(401);
  expect(fs.writeFile).not.toHaveBeenCalled();
});
test('rejects non-image content', async () => {
  const res = await request(app())
    .post('/users/me/avatar/upload')
    .type('image/jpeg')
    .send(Buffer.from('<svg/>'));
  expect(res.status).toBe(400);
  expect(fs.writeFile).not.toHaveBeenCalled();
});
test('rejects uploads above the server limit', async () => {
  const res = await request(app())
    .post('/users/me/avatar/upload')
    .type('image/jpeg')
    .send(Buffer.alloc(1024 * 1024 + 1));
  expect(res.status).toBe(413);
  expect(fs.writeFile).not.toHaveBeenCalled();
});
test('cleans up a new file if the database save fails', async () => {
  User.updateAvatar.mockRejectedValue(new Error('Database unavailable'));
  const res = await request(app())
    .post('/users/me/avatar/upload')
    .type('image/jpeg')
    .send(image);
  expect(res.status).toBe(500);
  expect(fs.unlink).toHaveBeenCalledTimes(1);
});
