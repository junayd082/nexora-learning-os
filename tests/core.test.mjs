import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePages, prepareLesson } from '../src/lib/engine/core.ts';

test('parsePages accepts ranges and individual pages', () => {
  assert.deepEqual([...parsePages('2-4, 7')], [2, 3, 4, 7]);
});

test('parsePages returns null for empty or invalid input', () => {
  assert.equal(parsePages(''), null);
  assert.equal(parsePages('not pages'), null);
});

test('parsePages handles reversed ranges and deduplicates', () => {
  assert.deepEqual([...parsePages('4-2, 3')], [2, 3, 4]);
});

test('prepareLesson identifies teaching content', () => {
  const result = prepareLesson('Force is a push or pull that changes motion because it accelerates objects.');
  assert.ok(result.passages.length > 0);
  assert.ok(result.cleanText.includes('Force is a push or pull'));
});

test('prepareLesson respects selected pages', () => {
  const input = 'Force is a push or pull that changes motion because it accelerates objects.\fEnergy is the ability to do work because it allows change.';
  const result = prepareLesson(input, { pages: new Set([2]) });
  assert.ok(result.passages.every(p => p.page === 2));
});
