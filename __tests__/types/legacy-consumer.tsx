import React, { useRef } from 'react';

import ConfirmHcaptcha, { Hcaptcha } from '../..';
import InlineHcaptcha from '../../Hcaptcha';

const onMessage = () => {};

export function LegacyModalConsumer() {
  const captchaRef = useRef<ConfirmHcaptcha | null>(null);

  return (
    <ConfirmHcaptcha
      ref={captchaRef}
      baseUrl="https://hcaptcha.com"
      onMessage={onMessage}
      siteKey="10000000-ffff-ffff-ffff-000000000001"
      size="invisible"
    />
  );
}

export function LegacyInlineConsumer() {
  const captchaRef = useRef<InlineHcaptcha | null>(null);

  return (
    <Hcaptcha
      ref={captchaRef}
      onMessage={onMessage}
      siteKey="10000000-ffff-ffff-ffff-000000000001"
      size="invisible"
      url="https://hcaptcha.com"
    />
  );
}
