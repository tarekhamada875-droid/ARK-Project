const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./src', function(filePath) {
  if (filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let newContent = content
      .replace(/rounded-\[2\.5rem\]/g, 'rounded-2xl')
      .replace(/rounded-3xl/g, 'rounded-xl');
    
    if (content !== newContent) {
      console.log('Modified:', filePath);
      fs.writeFileSync(filePath, newContent, 'utf8');
    }
  }
});
