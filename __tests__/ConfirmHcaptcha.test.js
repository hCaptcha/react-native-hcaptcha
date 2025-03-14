import React from 'react';
import { render } from '@testing-library/react-native';
import ConfirmHcaptcha from '../index';

describe('ConfirmHcaptcha snapshot tests', () => {
  it('renders ConfirmHcaptcha with minimum props', () => {
    const component = render(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
      />
    );
    expect(component).toMatchSnapshot();
  });

  it('renders ConfirmHcaptcha with all props', () => {
    const component = render(
      <ConfirmHcaptcha
        size="compact"
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        showLoading={false}
        loadingIndicatorColor="#999999"
        backgroundColor="rgba(0.1, 0.1, 0.1, 0.4)"
        theme="light"
        rqdata='{"some": "data"}'
        sentry={true}
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
});
