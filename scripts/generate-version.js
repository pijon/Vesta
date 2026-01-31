import fs from 'fs';

const version = {
  buildTime: new Date().toISOString(),
  hash: Math.random().toString(36).substring(7)
};

fs.writeFileSync('public/version.json', JSON.stringify(version, null, 2));
console.log('Generated public/version.json:', version);
