/**
 * Parsing for the `sms:` URLs emitted by the MFA inbound-SMS challenge.
 *
 * Covers the RFC 5724 grammar - `sms:recipients[;subscriber-params][?query]` - as well as the
 * legacy `;body=` form.
 *
 * The body carries a one-time code that the backend validates against the message it actually
 * receives, so it is passed through byte-exact: percent-decoded and nothing else. It must never
 * be trimmed, reformatted or logged.
 */

const SMS_SCHEME = 'sms:';
const SMSTO_SCHEME = 'smsto:';
const BODY_KEY = 'body';
const QUERY_SEPARATORS = '&';
const HEAD_SEPARATORS = ';&';

const isHexDigit = (char) => /^[0-9a-fA-F]$/.test(char);

/**
 * Percent-decodes as UTF-8, leaving anything that is not a well-formed `%XX` escape as literal
 * text.
 *
 * `+` is deliberately left alone: it means a literal plus in a URI query (RFC 3986), and only
 * means a space in form encoding, which `sms:` links do not use. This rules out `URLSearchParams`
 * and `querystring.parse`, both of which apply form decoding.
 */
const percentDecode = (value) => {
  if (value.indexOf('%') < 0) {
    return value;
  }

  let decoded = '';
  let index = 0;
  while (index < value.length) {
    if (
      value[index] !== '%' ||
      index + 3 > value.length ||
      !isHexDigit(value[index + 1]) ||
      !isHexDigit(value[index + 2])
    ) {
      decoded += value[index];
      index++;
      continue;
    }

    // Consume the whole run of escapes at once so a multi-byte UTF-8 character split across
    // several of them decodes as one character.
    let end = index;
    while (
      end + 3 <= value.length &&
      value[end] === '%' &&
      isHexDigit(value[end + 1]) &&
      isHexDigit(value[end + 2])
    ) {
      end += 3;
    }

    const run = value.slice(index, end);
    try {
      decoded += decodeURIComponent(run);
    } catch (e) {
      // Escapes that are individually well-formed but not valid UTF-8 together.
      decoded += run;
    }
    index = end;
  }

  return decoded;
};

const indexOfAny = (value, characters, from) => {
  for (let index = from; index < value.length; index++) {
    if (characters.indexOf(value[index]) >= 0) {
      return index;
    }
  }
  return -1;
};

/**
 * Reads a single parameter out of a `separators`-delimited list.
 *
 * Decoding happens after splitting so an encoded separator inside a value survives. Empty pairs
 * are skipped rather than treated as the end of the list: the challenge is reported to emit
 * `?&body=`, so the first pair is empty.
 */
const readValue = (key, parameters, separators) => {
  let cursor = 0;
  while (cursor < parameters.length) {
    const next = indexOfAny(parameters, separators, cursor);
    const end = next < 0 ? parameters.length : next;
    const item = parameters.slice(cursor, end);
    cursor = end + 1;

    const equals = item.indexOf('=');
    const name = equals < 0 ? item : item.slice(0, equals);
    if (name.toLowerCase() === key) {
      const decoded = percentDecode(equals < 0 ? '' : item.slice(equals + 1));
      return decoded === '' ? null : decoded;
    }
  }

  return null;
};

/**
 * The challenge only ever targets a single hCaptcha number, so any extra recipients are dropped.
 *
 * The surviving characters are an allowlist rather than a denylist: formatting can arrive as
 * spaces, dashes, parens or dots, and anything left in that the messaging app rejects makes it
 * silently drop the recipient.
 */
const firstRecipient = (list) => {
  const comma = list.indexOf(',');
  const decoded = percentDecode(comma < 0 ? list : list.slice(0, comma));

  let normalized = '';
  for (let index = 0; index < decoded.length; index++) {
    const current = decoded[index];
    if (current === '+' || (current >= '0' && current <= '9')) {
      normalized += current;
    }
  }

  return normalized === '' ? null : normalized;
};

/**
 * Parses an `sms:` or `smsto:` URL.
 *
 * @param {string} [url] the URL the WebView tried to navigate to
 * @returns {{recipient: ?string, body: ?string}|null} the parsed link, or null for any URL that
 *   is not an SMS link
 */
export const parseSmsLink = (url) => {
  if (typeof url !== 'string') {
    return null;
  }

  const lowercased = url.toLowerCase();
  let start;
  if (lowercased.startsWith(SMS_SCHEME)) {
    start = SMS_SCHEME.length;
  } else if (lowercased.startsWith(SMSTO_SCHEME)) {
    start = SMSTO_SCHEME.length;
  } else {
    return null;
  }

  // Tolerate the authority-style `sms://` spelling seen in the wild.
  while (start < url.length && url[start] === '/') {
    start++;
  }
  const payload = url.slice(start);

  // The query and the `;` subscriber parameters are separate grammars, so `?` has to be split off
  // first. Folding them together loses the body of a link such as
  // `sms:+15551234567;phone-context=+1?body=code`.
  const mark = payload.indexOf('?');
  const head = mark < 0 ? payload : payload.slice(0, mark);
  const query = mark < 0 ? '' : payload.slice(mark + 1);

  const headParamsStart = indexOfAny(head, HEAD_SEPARATORS, 0);
  const recipients = headParamsStart < 0 ? head : head.slice(0, headParamsStart);
  const headParams = headParamsStart < 0 ? '' : head.slice(headParamsStart + 1);

  // A `;` inside a query is body text, not a separator (RFC 3986 lists it as a sub-delim), so the
  // query is split on `&` alone. The legacy `;body=` form is read from the head.
  const body =
    readValue(BODY_KEY, query, QUERY_SEPARATORS) ||
    readValue(BODY_KEY, headParams, HEAD_SEPARATORS);

  return { recipient: firstRecipient(recipients), body };
};
