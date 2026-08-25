import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import ConfirmHcaptcha from '../index';

const SITE_KEY = '00000000-0000-0000-0000-000000000000';

const renderConfirm = (props = {}) => {
  const ref = React.createRef();
  const result = render(
    <ConfirmHcaptcha ref={ref} siteKey={SITE_KEY} onMessage={props.onMessage || (() => {})} {...props} />
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
});

afterEach(() => {
  cleanup();
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('ConfirmHcaptcha on web', () => {
  it('renders nothing until show() is called', () => {
    const { container } = renderConfirm();
    expect(container.firstChild).toBeNull();
  });

  it('renders the modal and mounts the widget after show()', async () => {
    const { ref } = renderConfirm();

    await show(ref);

    // The regression this guards: the previous react-native-web spike snapshotted
    // `null` here, i.e. the modal never rendered on web at all.
    const widget = screen.getByTestId('hcaptcha-container');
    expect(widget).toBeTruthy();
    expect(global.__hcaptcha.renderCount).toBe(1);
    expect(global.__hcaptcha.renderTarget).toBe(widget);
  });

  it('matches the rendered DOM snapshot', async () => {
    const { ref, baseElement } = renderConfirm();

    await show(ref);

    expect(baseElement).toMatchSnapshot();
  });

  it('emits cancel when the backdrop is pressed', async () => {
    const onMessage = jest.fn();
    const { ref } = renderConfirm({ onMessage });

    await show(ref);
    fireEvent.click(screen.getByTestId('confirm-hcaptcha-backdrop'));

    expect(onMessage).toHaveBeenCalledWith({ nativeEvent: { data: 'cancel' } });
    expect(screen.queryByTestId('hcaptcha-container')).toBeNull();
  });

  it('does not emit cancel when hide() is called by the consumer', async () => {
    const onMessage = jest.fn();
    const { ref } = renderConfirm({ onMessage });

    await show(ref);
    await act(async () => {
      ref.current.hide();
    });

    expect(onMessage).not.toHaveBeenCalled();
    expect(screen.queryByTestId('hcaptcha-container')).toBeNull();
  });

  it('omits the backdrop when hasBackdrop is false', async () => {
    const { ref } = renderConfirm({ hasBackdrop: false });

    await show(ref);

    expect(screen.queryByTestId('confirm-hcaptcha-backdrop')).toBeNull();
    expect(screen.getByTestId('hcaptcha-container')).toBeTruthy();
  });

  it('mounts the widget without a modal in passive mode', async () => {
    const { ref } = renderConfirm({ passiveSiteKey: true });

    await show(ref);

    expect(screen.getByTestId('hcaptcha-container')).toBeTruthy();
    expect(screen.queryByTestId('confirm-hcaptcha-backdrop')).toBeNull();
  });

  it('forwards a token from the widget through to onMessage', async () => {
    const onMessage = jest.fn();
    const { ref } = renderConfirm({ onMessage });

    await show(ref);

    const token = 'P0_eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.a-token-longer-than-thirty-five-chars';
    act(() => {
      global.__hcaptcha.fire('callback', token);
    });

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage.mock.calls[0][0].nativeEvent.data).toBe(token);
    expect(onMessage.mock.calls[0][0].success).toBe(true);
  });
});
