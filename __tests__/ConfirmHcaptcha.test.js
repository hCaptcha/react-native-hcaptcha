import React from 'react';
import renderer from 'react-test-renderer';
import ConfirmHcaptcha from '../index';

describe('ConfirmHcaptcha snapshot tests', () => {
  it('renders ConfirmHcaptcha with minimum props', () => {
    const component = renderer.create(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
      />
    );
    expect(component).toMatchSnapshot();
  });
});
