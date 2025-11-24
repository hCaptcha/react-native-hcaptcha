import React from 'react';
import { measureRenders } from 'reassure';
import { waitFor } from '@testing-library/react-native';
import Hcaptcha from '../Hcaptcha';

describe('Hcaptcha Performance Tests', () => {
  test('Hcaptcha initial render performance', async () => {
    await measureRenders(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        onMessage={() => {}}
      />
    );
  });

  test('Hcaptcha render with all props', async () => {
    await measureRenders(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        size="normal"
        languageCode="en"
        showLoading={true}
        loadingIndicatorColor="#123456"
        backgroundColor="rgba(0.1, 0.1, 0.1, 0.4)"
        theme="light"
        rqdata="{}"
        sentry={false}
        jsSrc="https://js.hcaptcha.com/1/api.js"
        endpoint="https://api.hcaptcha.com"
        reportapi="https://accounts.hcaptcha.com"
        assethost="https://newassets.hcaptcha.com"
        imghost="https://imgs.hcaptcha.com"
        host="test-host"
        debug={{ test: true }}
        orientation="portrait"
        phonePrefix="44"
        phoneNumber="+441234567890"
        onMessage={() => {}}
      />
    );
  });

  test('Hcaptcha render with theme object', async () => {
    const customTheme = {
      palette: {
        mode: 'dark',
        primary: { main: '#26C6DA' },
        warn: { main: '#FF8A80' },
        text: {
          heading: '#FAFAFA',
          body: '#E0E0E0',
        },
      },
    };

    await measureRenders(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        theme={customTheme}
        onMessage={() => {}}
      />
    );
  });

  test('Hcaptcha render count stability - multiple renders', async () => {
    // This test ensures render count doesn't increase with multiple renders
    const Component = () => (
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        onMessage={() => {}}
      />
    );

    await measureRenders(<Component />, {
      runs: 20, // More runs to detect render count issues
      warmupRuns: 3,
    });
  });

  test('Hcaptcha invisible size performance', async () => {
    await measureRenders(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        size="invisible"
        onMessage={() => {}}
      />,
      {
        scenario: async () => {
          await waitFor(() => {}, { timeout: 100 });
        },
      }
    );
  });

  test('Hcaptcha compact size performance', async () => {
    await measureRenders(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        size="compact"
        onMessage={() => {}}
      />,
      {
        scenario: async () => {
          await waitFor(() => {}, { timeout: 100 });
        },
      }
    );
  });

  test('Hcaptcha normal size performance', async () => {
    await measureRenders(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        size="normal"
        onMessage={() => {}}
      />,
      {
        scenario: async () => {
          await waitFor(() => {}, { timeout: 100 });
        },
      }
    );
  });
});
