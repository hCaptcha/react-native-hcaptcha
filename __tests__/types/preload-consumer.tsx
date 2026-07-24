import React, { useRef } from 'react';

import {
  Hcaptcha,
  type HCaptchaHandle,
} from '../..';

const onMessage = () => {};

export function PreloadConsumer() {
  const captchaRef = useRef<HCaptchaHandle | null>(null);

  return (
    <Hcaptcha
      ref={captchaRef}
      autoExecute={false}
      onMessage={onMessage}
      onReady={() => {
        captchaRef.current?.execute({
          mfaEmail: 'user@example.com',
          rqdata: 'fresh-rqdata',
        });
      }}
      siteKey="10000000-ffff-ffff-ffff-000000000001"
      size="invisible"
      url="https://hcaptcha.com"
    />
  );
}

export function usePreloadActions(ref: React.RefObject<HCaptchaHandle | null>) {
  return {
    close: () => ref.current?.close(),
    execute: () => ref.current?.execute(),
    reset: () => ref.current?.reset(),
  };
}
