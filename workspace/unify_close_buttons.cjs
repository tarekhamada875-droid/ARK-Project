const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function processContent(content) {
  // Use a simple split approach to iterate over all <button tags
  let result = '';
  let parts = content.split(/<button/g);
  result += parts[0];
  
  let modified = false;
  
  for (let i = 1; i < parts.length; i++) {
    let part = parts[i];
    let endIdx = part.indexOf('</button>');
    if (endIdx !== -1) {
      let buttonInner = part.substring(0, endIdx);
      let afterButton = part.substring(endIdx + '</button>'.length);
      
      // Check if this button represents a close modal button containing an <X
      // Close buttons usually have onClick related to closing AND contain strictly <X ... /> or <XCircle ... />
      // Or they have an X and maybe a span with text.
      // But we just check if it contains <X or <XCircle as its main visual.
      if (buttonInner.match(/<(X|XCircle)\b/)) {
        // We found an X button. 
        // Let's check if it has other meaningful content, like text, but wait, the AdminDashboard 'رفض' button has <X stroke-[4]> and <span>رفض</span>. We shouldn't change the shape of 'رفض' button (reject request). Rejections usually have 'رفض' text. The user wants the close buttons "ازرار قفل النوافذ". Close windows/modals.
        // Let's safely replace if the button contains EXACTLY <X ... /> and no text, OR if it's the AdminDashboard overview close button.
        
        // Remove whitespace and see if only `<...>` exists inside the button body.
        let closingBracket = buttonInner.indexOf('>');
        let buttonAttrs = buttonInner.substring(0, closingBracket);
        let buttonBody = buttonInner.substring(closingBracket + 1);
        
        let bodyTextContent = buttonBody.replace(/<[^>]*>/g, '').trim();
        
        // If it contains only the X icon and no text (or only whitespace):
        if (bodyTextContent === '') {
           let newAttrs = buttonAttrs;
           
           // Replace className if exists
           if (newAttrs.includes('className=')) {
              newAttrs = newAttrs.replace(/className=(["'{][^"'}]+["'}])/, 'className="w-10 h-10 bg-red-500 text-white rounded-xl flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm outline-none"');
           } else {
              newAttrs += ' className="w-10 h-10 bg-red-500 text-white rounded-xl flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm outline-none"';
           }
           
           // Replace 'w-...' and 'h-...' in the X tag to be standard size and color
           let newBody = buttonBody.replace(/className=(["'{][^"'}]+["'}])/, 'className="w-6 h-6"');
           
           result += '<button' + newAttrs + '>' + newBody + '</button>' + afterButton;
           modified = true;
           continue;
        }
      }
    }
    result += '<button' + part;
  }
  
  return { modified, result };
}

walkDir('./src', (filePath) => {
  if (filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let { modified, result } = processContent(content);
    if (modified) {
      console.log('Modified close buttons in:', filePath);
      fs.writeFileSync(filePath, result, 'utf8');
    }
  }
});
