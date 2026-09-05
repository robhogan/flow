/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

'use strict';

import type {FunctionDeclaration, Identifier, Program} from 'flow-estree';

import {parse} from '../__test_utils__/parse';

// `Program['body']` and `FunctionDeclaration['params']` are both unions, so
// refine down to the nodes these tests are about.
function firstFunction(ast: Program): FunctionDeclaration {
  const node = ast.body[0];
  if (node.type !== 'FunctionDeclaration') {
    throw new Error(`Expected a FunctionDeclaration, got ${node.type}`);
  }
  return node;
}

function firstParam(ast: Program): Identifier {
  const param = firstFunction(ast).params[0];
  if (param.type !== 'Identifier') {
    throw new Error(`Expected an Identifier parameter, got ${param.type}`);
  }
  return param;
}

// Flow's legacy comment syntax lets a file carry type annotations while
// remaining valid JavaScript, so it can run untransformed. `hermes-parser`
// never supported it, and this package defaults to that behaviour;
// `enableTypesInComments` opts in.
describe('Flow types in comments', () => {
  const source = [
    'function f(a /*: string */) /*: number */ {',
    '  return 1;',
    '}',
    '/*:: type T = string; */',
    '/*:: import type {U} from "./u"; */',
  ].join('\n');

  describe('disabled by default', () => {
    test('annotations are plain comments', () => {
      const ast = parse(source);

      expect(firstParam(ast).typeAnnotation).toBe(null);
      expect(firstFunction(ast).returnType).toBe(null);
      expect(ast.comments.map(comment => comment.type)).toEqual([
        'Block',
        'Block',
        'Block',
        'Block',
      ]);
    });

    test('`/*:: */` blocks do not produce statements', () => {
      expect(parse(source).body.map(node => node.type)).toEqual([
        'FunctionDeclaration',
      ]);
    });
  });

  describe('enableTypesInComments: true', () => {
    const options = {enableTypesInComments: true};

    test('parses parameter and return annotations', () => {
      const ast = parse(source, options);

      expect(firstParam(ast).typeAnnotation).toMatchObject({
        type: 'TypeAnnotation',
        typeAnnotation: {type: 'StringTypeAnnotation'},
      });
      expect(firstFunction(ast).returnType).toMatchObject({
        type: 'TypeAnnotation',
        typeAnnotation: {type: 'NumberTypeAnnotation'},
      });
    });

    test('annotation ranges start at the comment opener', () => {
      const typeAnnotation = firstParam(parse(source, options)).typeAnnotation;
      if (typeAnnotation == null) {
        throw new Error('Expected the parameter to carry a type annotation');
      }
      const {range} = typeAnnotation;

      // The closing `*/` terminates the annotation rather than forming part
      // of it, so the range stops after the type.
      expect(source.slice(range[0], range[1])).toBe('/*: string');
    });

    test('`/*:: */` blocks become statements', () => {
      expect(parse(source, options).body.map(node => node.type)).toEqual([
        'FunctionDeclaration',
        'TypeAlias',
        'ImportDeclaration',
      ]);
    });

    test('consumed annotations are not also reported as comments', () => {
      expect(parse(source, options).comments).toEqual([]);
    });

    test('leaves non-type comments alone', () => {
      const ast = parse('/* a normal comment */\nlet x = 1;', options);

      expect(ast.comments.map(comment => comment.value)).toEqual([
        ' a normal comment ',
      ]);
    });
  });
});
