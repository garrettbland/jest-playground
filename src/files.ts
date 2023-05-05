export const files = {
    'index.js': {
        file: {
            contents: `
export const sum = (a, b) => {
  return a + b;
}`,
        },
    },
    'index.test.js': {
        file: {
            contents: `
      import { sum } from './index'
      test('adds 1 + 2 to equal 3', () => {
        expect(sum(1,2)).toBe(3)
      })
      `,
        },
    },
    '.babelrc': {
        file: {
            contents: `
      {
        presets: [
          ['@babel/preset-env', {
            targets: {
              node: 'current'
            }
          }]
        ]
      }
      `,
        },
    },
    'package.json': {
        file: {
            contents: `
{
  "name": "example-app",
  "type": "module",
  "dependencies": {
    "jest": "latest",
    "babel-jest": "latest",
    "@babel/core": "latest",
    "@babel/preset-env": "latest"
  },
  "scripts": {
    "test": "jest --watchAll"
  }
}`,
        },
    },
}
