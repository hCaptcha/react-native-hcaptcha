import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';

import ConfirmHcaptcha from '../index';
import {
  __unsafeResetJourneyRuntime,
  emitJourneyEvent,
  initJourneyTracking,
  isJourneyCapturing,
  peekJourneyEvents,
} from '../journey';

/**
 * Journey coverage for the web build.
 *
 * The native suite covers this through `ConfirmHcaptcha.test.js`, but nothing on the
 * web side ever passed `userJourney`, so the consumer lifecycle in `Hcaptcha.web.js`
 * and the `syncJourneyConsumer` / `stopEvents` paths in `index.js` were never executed
 * under react-native-web. The runtime itself is shared and unmocked, so these assert
 * the same contract the native tests do.
 */

const SITE_KEY = '00000000-0000-0000-0000-000000000000';

const renderConfirm = (props = {}) => {
  const ref = React.createRef();
  const result = render(
    <ConfirmHcaptcha
      ref={ref}
      siteKey={SITE_KEY}
      onMessage={props.onMessage || (() => {})}
      {...props}
    />
  );
  return { ...result, ref };
};

const show = async (ref) => {
  await act(async () => {
    ref.current.show();
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  global.__resetHcaptchaMock();
  __unsafeResetJourneyRuntime();
});

afterEach(() => {
  cleanup();
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('journey on web', () => {
  it('does not capture while no journey-enabled widget is mounted', async () => {
    initJourneyTracking();
    const { ref } = renderConfirm();

    await show(ref);

    expect(screen.getByTestId('hcaptcha-container')).toBeTruthy();
    expect(isJourneyCapturing()).toBe(false);
  });

  it('registers a consumer while the widget is mounted with userJourney', async () => {
    initJourneyTracking();
    const { ref } = renderConfirm({ userJourney: true });

    await show(ref);

    expect(isJourneyCapturing()).toBe(true);

    emitJourneyEvent('click', 'View', { id: 'while-open', ac: 'tap' });
    expect(peekJourneyEvents()).toHaveLength(1);
  });

  it('releases the consumer when the widget unmounts', async () => {
    initJourneyTracking();
    const { ref, unmount } = renderConfirm({ userJourney: true });

    await show(ref);
    expect(isJourneyCapturing()).toBe(true);

    await act(async () => {
      unmount();
    });

    expect(isJourneyCapturing()).toBe(false);
  });

  it('stopEvents() clears the buffer and drops this consumer', async () => {
    initJourneyTracking();
    const { ref } = renderConfirm({ userJourney: true });

    await show(ref);

    emitJourneyEvent('click', 'View', { id: 'before-stop', ac: 'tap' });
    expect(peekJourneyEvents()).toHaveLength(1);

    await act(async () => {
      ref.current.stopEvents();
    });

    expect(peekJourneyEvents()).toEqual([]);
    expect(isJourneyCapturing()).toBe(false);
  });

  it('re-enables the consumer when userJourney is reconfigured after stopEvents()', async () => {
    initJourneyTracking();
    const { ref, rerender } = renderConfirm({ userJourney: true });

    await show(ref);
    await act(async () => {
      ref.current.stopEvents();
    });
    expect(isJourneyCapturing()).toBe(false);

    // Toggling the prop is what clears `journeyStopped`, per `componentDidUpdate`.
    await act(async () => {
      rerender(
        <ConfirmHcaptcha ref={ref} siteKey={SITE_KEY} onMessage={() => {}} userJourney={false} />
      );
    });
    await act(async () => {
      rerender(
        <ConfirmHcaptcha ref={ref} siteKey={SITE_KEY} onMessage={() => {}} userJourney={true} />
      );
    });

    expect(isJourneyCapturing()).toBe(true);
  });

  it('keeps capturing while a second journey consumer is still mounted', async () => {
    initJourneyTracking();

    const firstRef = React.createRef();
    const secondRef = React.createRef();
    const first = render(
      <ConfirmHcaptcha ref={firstRef} siteKey={SITE_KEY} onMessage={() => {}} userJourney={true} />
    );
    render(
      <ConfirmHcaptcha ref={secondRef} siteKey={SITE_KEY} onMessage={() => {}} userJourney={true} />
    );

    await show(firstRef);
    await show(secondRef);
    expect(isJourneyCapturing()).toBe(true);

    await act(async () => {
      first.unmount();
    });

    // The second consumer still holds capture open.
    expect(isJourneyCapturing()).toBe(true);
  });

  it('forwards buffered journey events into the verify payload', async () => {
    initJourneyTracking();
    const { ref } = renderConfirm({ userJourney: true });

    // Buffered before the widget mounts, mirroring the native
    // 'injects fresh verify data only after the widget signals readiness' test:
    // `applyVerifyData` runs when the widget renders, and drains whatever is buffered.
    emitJourneyEvent('click', 'View', { id: 'sent-with-verify', ac: 'tap' });

    await show(ref);

    const setDataCalls = global.__hcaptcha.setDataCalls;
    expect(setDataCalls.length).toBeGreaterThan(0);
    expect(JSON.stringify(setDataCalls[setDataCalls.length - 1].data)).toContain(
      'sent-with-verify'
    );
  });
});
