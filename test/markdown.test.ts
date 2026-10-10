import { describe, it, expect } from 'vitest'

import { escapeHtml, MAX_RENDERED_MARKDOWN, renderMarkdown } from '../playground/utils/markdown'

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x" & 'y'>`)).toBe('&lt;a href=&quot;x&quot; &amp; &#39;y&#39;&gt;')
  })
})

describe('renderMarkdown', () => {
  it('returns empty for blank input', () => {
    expect(renderMarkdown('   \n\n  ')).toBe('')
  })

  it('escapes raw HTML before rendering, so v-html can never run it', () => {
    const html = renderMarkdown('<script>alert("x")</script>\n\n**bold**')

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('<strong>bold</strong>')
  })

  it('renders bold, italic and inline code', () => {
    const html = renderMarkdown('Use **git** or *svn* and `npm install` case-wide.')

    expect(html).toContain('<strong>git</strong>')
    expect(html).toContain('<em>svn</em>')
    expect(html).toContain('<code>npm install</code>')
  })

  it('lowercases nothing but keeps the label of a link, stripping only the href', () => {
    const html = renderMarkdown('[docs](https://example.com/page?x=1&y=2)')

    expect(html).toContain('<a href="https://example.com/page?x=1&amp;y=2" target="_blank" rel="noreferrer noopener">docs</a>')
  })

  it('drops links to unsafe schemes', () => {
    const html = renderMarkdown('[click me](javascript:alert(1))')

    expect(html).not.toContain('<a ')
    expect(html).toContain('click me')
  })

  it('maps headings down to h2/h3/h4', () => {
    const html = renderMarkdown('# One\n\n## Two\n\n### Three')

    expect(html).toContain('<h2>One</h2>')
    expect(html).toContain('<h3>Two</h3>')
    expect(html).toContain('<h4>Three</h4>')
  })

  it('renders unordered and ordered lists', () => {
    const html = renderMarkdown('- first\n- second\n\n1. one\n2. two')

    expect(html).toContain('<ul><li>first</li><li>second</li></ul>')
    expect(html).toContain('<ol><li>one</li><li>two</li></ol>')
  })

  it('joins adjacent lines in one paragraph and splits on blank lines', () => {
    const html = renderMarkdown('line one\nline two\n\nnext paragraph')

    expect(html).toContain('<p>line one<br>line two</p>')
    expect(html).toContain('<p>next paragraph</p>')
  })

  it('renders fenced code blocks without touching the content', () => {
    const html = renderMarkdown('```\nconst x = 1 < 2\n```')

    expect(html).toContain('<pre><code>const x = 1 &lt; 2</code></pre>')
  })

  it('renders blockquotes', () => {
    const html = renderMarkdown('> a quoted line')

    expect(html).toContain('<blockquote>a quoted line</blockquote>')
  })

  it('caps the rendered output so a runaway reply cannot blow up the DOM', () => {
    const long = `# Headline\n\n${'plain words with text and more words '.repeat(2_000)}`

    const html = renderMarkdown(long)

    expect(html.length).toBeLessThan(MAX_RENDERED_MARKDOWN + 200)
  })
})
