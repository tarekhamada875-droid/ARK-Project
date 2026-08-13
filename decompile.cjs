const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;
const t = require('@babel/types');

const fs = require('fs');

const code = fs.readFileSync('extract.js', 'utf8');

const ast = parser.parse(code, {
  sourceType: 'module',
  plugins: ['jsx']
});

traverse(ast, {
  CallExpression(path) {
    if (
      path.node.callee.type === 'MemberExpression' &&
      path.node.callee.object.name === 'r' &&
      (path.node.callee.property.name === 'jsx' || path.node.callee.property.name === 'jsxs')
    ) {
      const args = path.node.arguments;
      const typeArg = args[0];
      const propsArg = args[1];

      let elementName;
      if (t.isStringLiteral(typeArg)) {
        elementName = t.jsxIdentifier(typeArg.value);
      } else if (t.isIdentifier(typeArg)) {
        elementName = t.jsxIdentifier(typeArg.name);
      } else if (t.isMemberExpression(typeArg)) {
        elementName = t.jsxMemberExpression(
          t.jsxIdentifier(typeArg.object.name),
          t.jsxIdentifier(typeArg.property.name)
        );
      } else {
        elementName = t.jsxIdentifier('Unknown');
      }

      const attributes = [];
      let children = [];

      if (t.isObjectExpression(propsArg)) {
        propsArg.properties.forEach(prop => {
          if (t.isObjectProperty(prop)) {
            const keyName = t.isIdentifier(prop.key) ? prop.key.name : prop.key.value;
            if (keyName === 'children') {
              const processChild = (el) => {
                if (t.isJSXElement(el) || t.isJSXFragment(el)) return el;
                if (t.isStringLiteral(el)) return t.jsxText(el.value);
                return t.jsxExpressionContainer(el);
              };

              if (t.isArrayExpression(prop.value)) {
                children = prop.value.elements.map(processChild);
              } else {
                children = [processChild(prop.value)];
              }
            } else {
              let attrValue;
              if (t.isStringLiteral(prop.value)) {
                attrValue = prop.value;
              } else {
                attrValue = t.jsxExpressionContainer(prop.value);
              }
              attributes.push(t.jsxAttribute(t.jsxIdentifier(keyName), attrValue));
            }
          }
        });
      }

      const openingElement = t.jsxOpeningElement(elementName, attributes, children.length === 0);
      let closingElement = null;
      if (children.length > 0) {
        closingElement = t.jsxClosingElement(elementName);
      }

      const jsxElement = t.jsxElement(openingElement, closingElement, children);
      path.replaceWith(jsxElement);
    }
  }
});

const output = generator(ast).code;
fs.writeFileSync('decompiled.tsx', output);
