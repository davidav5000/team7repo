const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const User = require('../models/user');
const uploadDirectory = path.join(__dirname, '../public/uploads/avatars');

async function uploadAvatar(req, res, next) {
  const image = req.body;
  if (
    !req.is('image/jpeg') ||
    !Buffer.isBuffer(image) ||
    image.length < 4 ||
    image[0] !== 0xff ||
    image[1] !== 0xd8 ||
    image[2] !== 0xff ||
    image[image.length - 2] !== 0xff ||
    image[image.length - 1] !== 0xd9
  ) {
    return res
      .status(400)
      .json({ error: 'Please choose a valid photo using the photo picker.' });
  }
  let filePath;
  try {
    const user = await User.findPublicById(req.session.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await fs.mkdir(uploadDirectory, { recursive: true });
    const filename = `${randomUUID()}.jpg`;
    filePath = path.join(uploadDirectory, filename);
    await fs.writeFile(filePath, image, { flag: 'wx', mode: 0o644 });
    const avatarUrl = `/uploads/avatars/${filename}`;
    const saved = await User.updateAvatar(req.session.userId, avatarUrl);
    if (!saved) {
      await fs.unlink(filePath);
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ avatarUrl: saved.avatarUrl });
  } catch (error) {
    if (filePath) await fs.unlink(filePath).catch(() => {});
    return next(error);
  }
}
module.exports = { uploadAvatar };
