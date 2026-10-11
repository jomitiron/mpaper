/** The web app's address. Every "Sign in" and "Get started" goes there. */
export const APP_URL = (import.meta.env.PUBLIC_APP_URL || 'http://localhost:5170').replace(
  /\/+$/,
  '',
);

export const appLink = (path: string) => `${APP_URL}${path.startsWith('/') ? path : `/${path}`}`;

/** Plausible analytics domain, e.g. motopapers.ng. Analytics are off when it's unset. */
export const ANALYTICS_DOMAIN = (import.meta.env.PUBLIC_ANALYTICS_DOMAIN || '').trim();

/** Set PUBLIC_NOINDEX=true on staging and previews so search engines skip them. */
export const NOINDEX = import.meta.env.PUBLIC_NOINDEX === 'true';

/** Company details, shown in the footer and in the Organization JSON-LD. */
export const COMPANY = {
  name: 'MotoPapers',
  tagline: 'Vehicle licence, insurance and roadworthiness, tracked and renewed.',
  address: {
    street: '8 Sunday Gbajobi Street, Millennium Estate',
    locality: 'Gbagada',
    region: 'Lagos',
    country: 'NG',
  },
  phone: { display: '+234 802 959 5069', tel: '+2348029595069' },
} as const;

export const COMPANY_ADDRESS = `${COMPANY.address.street}, ${COMPANY.address.locality}, ${COMPANY.address.region}`;

export const DEFAULT_DESCRIPTION =
  'MotoPapers keeps your vehicle licence, insurance and roadworthiness in one place, reminds you weeks before each one runs out, and renews them for you.';

/** Landing page sections, in page order. The hero nav links to all of them. */
export const SECTIONS = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'what-we-track', label: 'What we track' },
  { id: 'why-motopapers', label: 'Why MotoPapers' },
  { id: 'faq', label: 'FAQ' },
] as const;

/**
 * The privacy and terms pages hold placeholder text until the owner replaces it. While this is
 * true they carry noindex and stay out of the sitemap. Set it to false once the real text is in.
 */
export const LEGAL_IS_PLACEHOLDER = true;

/** Pages listed in sitemap.xml. The legal pages join once their real text is in. */
export const SITEMAP_PATHS = ['/', ...(LEGAL_IS_PLACEHOLDER ? [] : ['/privacy/', '/terms/'])];
