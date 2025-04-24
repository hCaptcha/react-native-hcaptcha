import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import Hcaptcha from '../Hcaptcha';
import { setWebViewMessageData } from 'react-native-webview';

describe('Hcaptcha snapshot tests', () => {
  it('renders Hcaptcha with minimum props', () => {
    const component = render(<Hcaptcha url="https://hcaptcha.com" />);
    expect(component).toMatchSnapshot();
  });

  it('renders Hcaptcha with all props', () => {
    const component = render(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        size="normal"
        languageCode="fr"
        showLoading={true}
        loadingIndicatorColor="#123456"
        backgroundColor="rgba(0.1, 0.1, 0.1, 0.4)"
        theme="contrast"
        rqdata="{}"
        sentry={false}
        jsSrc="https://all.props/api-endpoint"
        endpoint="https://all.props/endpoint"
        reportapi="https://all.props/reportapi"
        assethost="https://all.props/assethost"
        imghost="https://all.props/imghost"
        host="all-props-host"
      />
    );
    expect(component).toMatchSnapshot();
  });

  it('renders Hcaptcha with debug', () => {
    const component = render(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        languageCode="en"
        debug={{a: 1}}
      />
    );
    expect(component).toMatchSnapshot();
  });

  [
    {
      data: 'open',
      expectedSuccess: true,
    },
    {
      data: '10000000-aaaa-bbbb-cccc-000000000001',
      expectedSuccess: true,
    },
    {
      data: 'webview-error',
      expectedSuccess: false,
    },
  ].forEach(({ data, expectedSuccess }) => {
    it(`test ${data} forwarding`, async () => {
      jest.useFakeTimers();
      let setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      setWebViewMessageData(data);
      const onMessageMock = jest.fn();

      render(
        <Hcaptcha
          siteKey="00000000-0000-0000-0000-000000000000"
          url="https://hcaptcha.com"
          languageCode="en"
          onMessage={onMessageMock}
        />
      );

      await waitFor(() => {
        expect(onMessageMock).toHaveBeenCalledTimes(1);
        expect(onMessageMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: expectedSuccess,
            nativeEvent: expect.objectContaining({ data }),
          })
        );

        if (data === 'token') {
          expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
        }
      });
    });
  });
});

