import React from 'react';
import renderer from 'react-test-renderer';
import Hcaptcha from '../Hcaptcha';

describe('Hcaptcha snapshot tests', () => {
  let snapshot;
  it('renders Hcaptcha with minimum props', () => {
    snapshot = renderer.create(<Hcaptcha url="https://hcaptcha.com" />);
    expect(snapshot).toMatchSnapshot();
  });
});
