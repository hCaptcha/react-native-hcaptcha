import { parseSmsLink } from '../hcaptchaSmsLink';

// The shape the MFA challenge emits: an hCaptcha number and a full sentence carrying a
// hyphenated one-time code. The numbers and codes here are dummies.
const POOL_NUMBER = '+15550001111';
const POOL_BODY =
  'Return to the app and press Confirm after sending this message. ' +
  'Do not edit or share the code: aaaa-bbbb-cccc';
const POOL_LINK =
  'sms:+15550001111?body=Return%20to%20the%20app%20and%20press%20Confirm%20after%20sending%20' +
  'this%20message.%20Do%20not%20edit%20or%20share%20the%20code%3A%20aaaa-bbbb-cccc';

// The same shape with the empty first query parameter the challenge is reported to emit:
// `?&body=`, not `?body=`.
const EMPTY_LEADING_PAIR_LINK =
  'sms:+15550002222?&body=Return%20to%20the%20app%20and%20press%20Confirm%20after%20sending%20' +
  'this%20message.%20Do%20not%20edit%20or%20share%20the%20code%3A%20dddd-eeee-ffff';

const NUMBER = '+15551234567';
const CODE = 'code';
const CODE_QUERY = '?body=code';

/** @param suffix everything after the hCaptcha number in the link */
const parseSuffix = (suffix) => parseSmsLink(`sms:${NUMBER}${suffix}`);

describe('parseSmsLink', () => {
  it('parses a full challenge-shaped link', () => {
    expect(parseSmsLink(POOL_LINK)).toEqual({ recipient: POOL_NUMBER, body: POOL_BODY });
  });

  it('parses a link with an empty leading query parameter', () => {
    expect(parseSmsLink(EMPTY_LEADING_PAIR_LINK)).toEqual({
      recipient: '+15550002222',
      body:
        'Return to the app and press Confirm after sending this message. ' +
        'Do not edit or share the code: dddd-eeee-ffff',
    });
  });

  it('skips empty query parameters', () => {
    expect(parseSuffix('?&body=code').body).toBe(CODE);
    expect(parseSuffix('?&&body=code').body).toBe(CODE);
    expect(parseSuffix('?x=1&body=code&').body).toBe(CODE);
  });

  it('keeps the body byte-exact', () => {
    // The code is hyphenated in the SMS body and unhyphenated in the challenge UI; the backend
    // normalises, so nothing here may trim, reformat or re-case the body.
    expect(parseSuffix('?body=%20%20spaced%20%20').body).toBe('  spaced  ');
    expect(parseSuffix('?body=aaaa-bbbb-cccc').body).toBe('aaaa-bbbb-cccc');
  });

  it('splits the query before the subscriber params', () => {
    // RFC 5724 allows `;` subscriber params before the query. Folding the two grammars together
    // loses the body.
    expect(parseSuffix(`;phone-context=+1${CODE_QUERY}`)).toEqual({
      recipient: NUMBER,
      body: CODE,
    });
  });

  it('treats a semicolon inside the query as body text', () => {
    expect(parseSuffix('?body=code;more').body).toBe('code;more');
  });

  it('reads the legacy body parameter from the head', () => {
    expect(parseSuffix(';body=hello').body).toBe('hello');
  });

  it('keeps a plus in the body', () => {
    // `+` is a literal plus in a URI query (RFC 3986); only form encoding reads it as a space.
    expect(parseSuffix('?body=a+b').body).toBe('a+b');
  });

  it('decodes utf-8 escapes', () => {
    expect(parseSuffix('?body=caf%C3%A9%20%E2%80%93%20ok').body).toBe('café – ok');
  });

  it('keeps malformed escapes as literal text', () => {
    expect(parseSuffix('?body=100%25').body).toBe('100%');
    expect(parseSuffix('?body=50%').body).toBe('50%');
    expect(parseSuffix('?body=%zz').body).toBe('%zz');
  });

  it('normalises recipient formatting', () => {
    expect(parseSmsLink('sms:+123-456-789?body=Hello%20World').recipient).toBe('+123456789');
    expect(parseSmsLink('sms:%2B1%20(555)%20123.4567').recipient).toBe(NUMBER);
  });

  it('keeps only the first recipient', () => {
    expect(parseSuffix(`,+15559999999${CODE_QUERY}`).recipient).toBe(NUMBER);
  });

  it('accepts the smsto and authority forms', () => {
    expect(parseSmsLink(`smsto:${NUMBER}${CODE_QUERY}`).recipient).toBe(NUMBER);
    expect(parseSmsLink(`sms://${NUMBER}${CODE_QUERY}`).body).toBe(CODE);
    expect(parseSmsLink(`SMS:${NUMBER}?BODY=code`).body).toBe(CODE);
  });

  it('reports missing parts as null', () => {
    expect(parseSuffix('').body).toBeNull();
    expect(parseSuffix('?body=').body).toBeNull();
    expect(parseSuffix('?subject=hi').body).toBeNull();
    expect(parseSmsLink(`sms:${CODE_QUERY}`).recipient).toBeNull();
    expect(parseSmsLink('sms:not-a-number?body=nope').recipient).toBeNull();
  });

  it('rejects non-sms urls', () => {
    expect(parseSmsLink(null)).toBeNull();
    expect(parseSmsLink(undefined)).toBeNull();
    expect(parseSmsLink(`https://example.com${CODE_QUERY}`)).toBeNull();
    expect(parseSmsLink(`tel:${NUMBER}`)).toBeNull();
    expect(parseSmsLink(`smsx:${NUMBER}`)).toBeNull();
  });
});
