import { describe, it, expect } from 'vitest';
import { el } from '../src/utils/dom';

describe('DOM utils', () => {
  it('should create an element with text content', () => {
    const div = el('div', { className: 'test' }, 'Hello World');
    expect(div.tagName).toBe('DIV');
    expect(div.className).toBe('test');
    expect(div.textContent).toBe('Hello World');
  });

  it('should create an element with children', () => {
    const span = el('span', {}, 'Inner');
    const div = el('div', {}, span);
    expect(div.children.length).toBe(1);
    expect(div.firstChild).toBe(span);
  });
});
