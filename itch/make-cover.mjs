import sharp from 'sharp';
await sharp('docs/screenshots/battle.png')
  .resize(630, 500, { fit: 'cover', position: 'centre' })
  .jpeg({ quality: 88 })
  .toFile('itch/cover-630x500.jpg');
// versão widescreen também (itch aceita banners maiores)
await sharp('docs/screenshots/battle.png')
  .resize(1280, 720, { fit: 'cover' })
  .jpeg({ quality: 88 })
  .toFile('itch/cover-wide.jpg');
console.log('capas ok');
