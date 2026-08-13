const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;
const fs = require('fs');

const code = fs.readFileSync('formatted.js', 'utf8');

const ast = parser.parse(code, {
  sourceType: 'module',
  plugins: ['jsx']
});

let koNode = null;

traverse(ast, {
  AssignmentExpression(path) {
    if (path.node.left.type === 'Identifier' && path.node.left.name === 'KO') {
      koNode = path.node;
      path.stop();
    }
  },
  VariableDeclarator(path) {
    if (path.node.id.type === 'Identifier' && path.node.id.name === 'KO') {
      koNode = path.node;
      path.stop();
    }
  }
});

if (koNode) {
  const output = generator(koNode).code;
  fs.writeFileSync('extract.js', output);
  console.log('Successfully extracted KO component');
} else {
  console.log('KO not found');
}
