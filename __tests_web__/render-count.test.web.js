import React from 'react';
import { act, cleanup, render } from '@testing-library/react';

import Hcaptcha from '../Hcaptcha';
import ConfirmHcaptcha from '../index';

/**
 * Render-count guard for the web build.
 *
 * Uses React's own `<Profiler>` rather than reassure: these are absolute assertions on
 * the number of commits, so there is no baseline to compare against and no need for a
 * second `perf:compare` pipeline. Running reassure's `measureRenders` outside its CLI
 * also prints a "incorrect Node.js configuration" banner on every `npm run test:web`.
 *
 * What this catches: a dropped `useMemo`/`useCallback` in Hcaptcha.web.js turning a
 * mount into a mount-plus-rerender.
 */

const SITE_KEY = '00000000-0000-0000-0000-000000000000';

/** Renders `element` and returns how many times React committed it. */
const countCommits = async (element) => {
  let commits = 0;
  const result = render(
    <React.Profiler id="subject" onRender={() => { commits += 1; }}>
      {element}
    </React.Profiler>
  );
  // Let the loader promise settle, so a post-load state update would be counted.
  await act(async () => {});
  return { commits: () => commits, ...result };
};

beforeEach(() => {
  global.__resetHcaptchaMock();
});

afterEach(() => {
  cleanup();
});

describe('web render counts', () => {
  it('commits Hcaptcha once on mount', async () => {
    const { commits } = await countCommits(
      <Hcaptcha siteKey={SITE_KEY} onMessage={() => {}} />
    );

    // Loading the widget does not clear `isLoading` — that only happens in `emit`,
    // on the first message. So a successful load costs no extra commit.
    expect(commits()).toBe(1);
  });

  it('costs exactly one extra commit when the first message clears the loading state', async () => {
    const { commits } = await countCommits(
      <Hcaptcha siteKey={SITE_KEY} onMessage={() => {}} />
    );
    expect(commits()).toBe(1);

    await act(async () => {
      global.__hcaptcha.fire('open-callback');
    });

    // One commit for setIsLoading(false).
    expect(commits()).toBe(2);

    await act(async () => {
      global.__hcaptcha.fire('close-callback');
    });

    // Known redundancy, not a regression: `emit` calls `setIsLoading(false)` on every
    // message, so React renders once more before bailing out on the unchanged value —
    // even though `isLoadingRef` already tracks that loading is done. Guarding the
    // setState behind `isLoadingRef.current` would make this 2. Native Hcaptcha.js has
    // the same shape, so changing it should be done on both at once.
    expect(commits()).toBe(3);
  });

  it('commits Hcaptcha once when the loading overlay is disabled', async () => {
    const { commits } = await countCommits(
      <Hcaptcha siteKey={SITE_KEY} onMessage={() => {}} showLoading={false} />
    );

    expect(commits()).toBe(1);
  });

  it('commits ConfirmHcaptcha once before show() is called', async () => {
    const { commits } = await countCommits(
      <ConfirmHcaptcha siteKey={SITE_KEY} languageCode="en" onMessage={() => {}} />
    );

    expect(commits()).toBe(1);
  });
});
