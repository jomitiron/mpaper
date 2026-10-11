import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import Home from '../src/pages/index.astro';
import Privacy from '../src/pages/privacy.astro';
import Terms from '../src/pages/terms.astro';
import { GET as robots } from '../src/pages/robots.txt';
import { GET as sitemap } from '../src/pages/sitemap.xml';
import { SECTIONS } from '../src/config';

const SITE = 'https://motopapers.example';
let container: AstroContainer;

const render = (page: Parameters<AstroContainer['renderToString']>[0], path: string) =>
  container.renderToString(page, { request: new Request(new URL(path, SITE)) });

const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);

beforeAll(async () => {
  container = await AstroContainer.create({ astroConfig: { site: SITE } });
});

describe('home page', () => {
  let html: string;
  beforeAll(async () => {
    html = await render(Home, '/');
  });

  it('sends every sign-up and sign-in CTA to the app', () => {
    const app = hrefs(html).filter((href) => href.startsWith('https://app.example.ng'));
    expect(new Set(app)).toEqual(
      new Set(['https://app.example.ng/sign-up', 'https://app.example.ng/sign-in']),
    );
    // Nav, hero, reminders, wallet and closing band: five sign-ups, two sign-ins.
    expect(app.filter((href) => href.endsWith('/sign-up'))).toHaveLength(5);
    expect(app.filter((href) => href.endsWith('/sign-in'))).toHaveLength(2);
  });

  it('has a target for every in-page link', () => {
    for (const section of SECTIONS) expect(html).toContain(`id="${section.id}"`);
    const anchors = hrefs(html).filter((href) => href.startsWith('#'));
    for (const anchor of anchors) expect(html).toContain(`id="${anchor.slice(1)}"`);
  });

  it('has one h1 and the design copy', () => {
    const text = html.replace(/<[^>]+>/g, '');
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toMatch(/<span class="hl"[^>]*>expired papers<\/span>/);
    expect(text).toContain('Never drive with expired papers again.');
    expect(text).toContain('When does your car insurance expire?');
    expect(html).toContain('8 Sunday Gbajobi Street, Millennium Estate, Gbagada, Lagos');
    expect(html).toContain('href="tel:+2348029595069"');
  });

  it('uses native details for the FAQ, first one open', () => {
    const details = html.match(/<details[^>]*>/g) ?? [];
    expect(details).toHaveLength(5);
    expect(details[0]).toContain('open');
    expect(details.slice(1).some((tag) => tag.includes('open'))).toBe(false);
  });

  it('has the SEO tags and Organization JSON-LD', () => {
    expect(html).toContain(`<link rel="canonical" href="${SITE}/">`);
    expect(html).toContain(`<meta property="og:image" content="${SITE}/og.png">`);
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    const json = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1];
    expect(JSON.parse(json ?? '{}')).toMatchObject({
      '@type': 'Organization',
      name: 'MotoPapers',
      telephone: '+2348029595069',
      address: { addressLocality: 'Gbagada', addressCountry: 'NG' },
    });
  });

  it('ships no scripts besides JSON-LD while analytics are off', () => {
    const scripts = html.match(/<script[^>]*>/g) ?? [];
    expect(scripts).toEqual(['<script type="application/ld+json">']);
  });
});

describe('legal pages', () => {
  it.each([
    ['privacy', Privacy],
    ['terms', Terms],
  ] as const)('%s is marked as placeholder and kept out of search', async (name, page) => {
    const html = await render(page, `/${name}/`);
    expect(html).toContain('Placeholder text.');
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).not.toContain('rel="canonical"');
  });
});

describe('robots.txt and sitemap.xml', () => {
  const context = { site: new URL(SITE) } as Parameters<typeof robots>[0];

  it('allows crawling and points at the sitemap', async () => {
    const text = await (await robots(context)).text();
    expect(text).toContain('Allow: /');
    expect(text).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });

  it('lists the home page and leaves out placeholder legal pages', async () => {
    const xml = await (await sitemap(context)).text();
    expect(xml).toContain(`<loc>${SITE}/</loc>`);
    expect(xml).not.toContain('/privacy/');
  });
});
