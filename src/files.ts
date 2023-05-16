export const files = {
    src: {
        directory: {
            'app.js': {
                file: {
                    contents: `export const sum = (a, b) => {
  return a + b;
}

export const promiseTest = (animal) => {
  return new Promise((resolve) => resolve(animal))
}`,
                },
            },
            'app.test.js': {
                file: {
                    contents: `import { sum, promiseTest } from './app'

test('adds 1 + 2 to equal 3', () => {
  expect(sum(1,2)).toBe(3)
})

test('Returns my cat', async () => {
  const myPet = await promiseTest('cat')
  expect(myPet).toEqual('cat')
})`,
                },
            },
        },
    },
    '.babelrc': {
        file: {
            contents: `{
  "presets": [["@babel/preset-env", { "targets": { "node": "current" } }]]
}
`,
        },
    },
    //     'jest.config.js': {
    //         file: {
    //             contents: `/** @type {import('jest').Config} */
    // const config = {
    //   verbose: true,
    //   testEnvironment: "jsdom",
    //   roots: [
    //     "<rootDir>"
    //   ],
    // };

    // export default config;`,
    //         },
    //     },
    'package.json': {
        file: {
            contents: `
{
  "name": "example-app",
  "type": "module",
  "dependencies": {
    "babel-jest": "^29.5.0",
    "jest": "^29.5.0",
    "jest-environment-jsdom": "^29.5.0",
    "@babel/core": "^7.21.8",
    "@babel/preset-env": "^7.21.5",
    "@jest/globals": "^29.5.0",
    "@types/jest": "^29.5.1"
  },
  "scripts": {
    "test": "jest --watchAll"
  },
  "jest": {
    "verbose": true,
    "testEnvironment": "jsdom",
    "rootDir": "./src",
    "moduleFileExtensions": ["js", "jsx"],
    "moduleDirectories": ["node_modules", "src", "<rootDir>"],
    "modulePaths": [
      "<rootDir>"
    ]
  }
}`,
        },
    },
    'types.d.ts': {
        file: {
            contents: `
        declare const garrett: () => boolean;
        `,
        },
    },
}
