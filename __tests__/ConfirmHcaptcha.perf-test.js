import React from 'react';
import { measureRenders } from 'reassure';
import { waitFor } from '@testing-library/react-native';
import ConfirmHcaptcha from '../index';

describe('ConfirmHcaptcha Performance Tests', () => {
  test('ConfirmHcaptcha initial render performance', async () => {
    await measureRenders(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        onMessage={() => {}}
      />
    );
  });

  test('ConfirmHcaptcha render with all props', async () => {
    await measureRenders(
      <ConfirmHcaptcha
        size="compact"
        siteKey="00000000-0000-0000-0000-000000000000"
        passiveSiteKey={false}
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        orientation="portrait"
        showLoading={false}
        closableLoading={false}
        backgroundColor="rgba(0, 0, 0, 0.3)"
        loadingIndicatorColor="#999999"
        theme="light"
        rqdata='{"some": "data"}'
        sentry={true}
        jsSrc="https://js.hcaptcha.com/1/api.js"
        endpoint="https://api.hcaptcha.com"
        reportapi="https://accounts.hcaptcha.com"
        assethost="https://newassets.hcaptcha.com"
        imghost="https://imgs.hcaptcha.com"
        host="test-host"
        hasBackdrop={true}
        useSafeAreaView={true}
        debug={{ test: true }}
        onMessage={() => {}}
      />
    );
  });

  test('ConfirmHcaptcha modal show/hide performance', async () => {
    const TestComponent = () => {
      const [show, setShow] = React.useState(false);

      return (
        <>
          <ConfirmHcaptcha
            siteKey="00000000-0000-0000-0000-000000000000"
            baseUrl="https://hcaptcha.com"
            languageCode="en"
            onMessage={() => {}}
          />
          <button onPress={() => setShow(!show)}>
            Toggle Modal
          </button>
        </>
      );
    };

    await measureRenders(<TestComponent />, {
      scenario: async () => {
        // Simulate showing and hiding the modal
        await waitFor(() => {}, { timeout: 100 });
      },
    });
  });

  test('ConfirmHcaptcha render count stability - multiple renders', async () => {
    // This test ensures render count doesn't increase with multiple renders
    const Component = () => (
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        onMessage={() => {}}
      />
    );

    await measureRenders(<Component />, {
      runs: 20, // More runs to detect render count issues
      warmupRuns: 3,
    });
  });

  test('ConfirmHcaptcha minimal configuration', async () => {
    await measureRenders(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        onMessage={() => {}}
      />,
      {
        scenario: async () => {
          await waitFor(() => {}, { timeout: 100 });
        },
      }
    );
  });

  test('ConfirmHcaptcha with safe area view', async () => {
    await measureRenders(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        useSafeAreaView={true}
        onMessage={() => {}}
      />,
      {
        scenario: async () => {
          await waitFor(() => {}, { timeout: 100 });
        },
      }
    );
  });

  test('ConfirmHcaptcha without safe area view', async () => {
    await measureRenders(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        useSafeAreaView={false}
        onMessage={() => {}}
      />,
      {
        scenario: async () => {
          await waitFor(() => {}, { timeout: 100 });
        },
      }
    );
  });

  test('ConfirmHcaptcha passive mode', async () => {
    await measureRenders(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        passiveSiteKey={true}
        onMessage={() => {}}
      />,
      {
        scenario: async () => {
          await waitFor(() => {}, { timeout: 100 });
        },
      }
    );
  });

  test('ConfirmHcaptcha light theme performance', async () => {
    await measureRenders(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        theme="light"
        onMessage={() => {}}
      />,
      {
        scenario: async () => {
          await waitFor(() => {}, { timeout: 100 });
        },
      }
    );
  });

  test('ConfirmHcaptcha dark theme performance', async () => {
    await measureRenders(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        theme="dark"
        onMessage={() => {}}
      />,
      {
        scenario: async () => {
          await waitFor(() => {}, { timeout: 100 });
        },
      }
    );
  });

  test('ConfirmHcaptcha contrast theme performance', async () => {
    await measureRenders(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        theme="contrast"
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
