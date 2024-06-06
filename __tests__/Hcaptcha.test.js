import React from 'react';
import renderer from 'react-test-renderer';
import Hcaptcha from '../Hcaptcha';

describe('Hcaptcha snapshot tests', () => {
  it('renders Hcaptcha with minimum props', () => {
    const component = renderer.create(<Hcaptcha url="https://hcaptcha.com" />);
    expect(component).toMatchSnapshot();
  });

  it('renders Hcaptcha with all props', () => {
    const component = renderer.create(
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
        host="all-props-host" />);
    expect(component).toMatchSnapshot();
  });
  it('test debug', () => {
    const component = renderer.create(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        languageCode="en"
        debug={{a: 1}}
      />
    );
    expect(component).toMatchSnapshot();
  });
});

