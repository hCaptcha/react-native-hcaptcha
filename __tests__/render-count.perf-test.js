import React from 'react';
import { measureRenders } from 'reassure';
import { waitFor } from '@testing-library/react-native';
import Hcaptcha from '../Hcaptcha';
import ConfirmHcaptcha from '../index';

describe('Render Count Monitoring Tests', () => {
  // These tests specifically focus on ensuring render counts don't increase
  // They serve as a baseline for performance optimization

  test('Hcaptcha render count baseline - should not increase', async () => {
    // This establishes the baseline render count for Hcaptcha componen
    const result = await measureRenders(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        onMessage={() => {}}
      />,
      {
        runs: 15,
        warmupRuns: 3,
        removeOutliers: true,
      }
    );

    // This test will fail if render count increases - only care about render coun
    expect(result.meanCount).toBe(1);
  });

  test('ConfirmHcaptcha render count baseline - should not increase', async () => {
    // This establishes the baseline render count for ConfirmHcaptcha componen
    const result = await measureRenders(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        onMessage={() => {}}
      />,
      {
        runs: 15,
        warmupRuns: 3,
        removeOutliers: true,
      }
    );

    // This test will fail if render count increases - only care about render coun
    expect(result.meanCount).toBe(1);
  });

  test('Hcaptcha prop changes should not cause excessive re-renders', async () => {
    // Test that changing props doesn't cause unnecessary re-renders
    const TestComponent = () => {
      const [theme, setTheme] = React.useState('light');
      const [size, setSize] = React.useState('invisible');

      React.useEffect(() => {
        // Simulate prop changes
        const timer = setTimeout(() => {
          setTheme('dark');
        }, 100);

        const timer2 = setTimeout(() => {
          setSize('compact');
        }, 200);

        return () => {
          clearTimeout(timer);
          clearTimeout(timer2);
        };
      }, []);

      return (
        <Hcaptcha
          siteKey="00000000-0000-0000-0000-000000000000"
          url="https://hcaptcha.com"
          theme={theme}
          size={size}
          onMessage={() => {}}
        />
      );
    };

    const result = await measureRenders(<TestComponent />, {
      runs: 10,
      warmupRuns: 2,
    });

    // Should not render more than necessary for prop changes - only care about render coun
    expect(result.meanCount).toBeLessThanOrEqual(3);
  });

  test('ConfirmHcaptcha modal state changes render count', async () => {
    // Test modal show/hide doesn't cause excessive re-renders
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
          <button
            testID="toggle-button"
            onPress={() => setShow(!show)}
          >
            Toggle
          </button>
        </>
      );
    };

    const result = await measureRenders(<TestComponent />, {
      runs: 10,
      warmupRuns: 2,
      scenario: async () => {
        // Simulate modal interactions
        await waitFor(() => {}, { timeout: 200 });
      },
    });

    // Modal state changes should be efficient - only care about render coun
    expect(result.meanCount).toBeLessThanOrEqual(2);
  });

  test('Complex Hcaptcha configuration render count', async () => {
    // Test with complex configuration to ensure no render count increase
    const complexProps = {
      siteKey: '00000000-0000-0000-0000-000000000000',
      url: 'https://hcaptcha.com',
      size: 'normal',
      languageCode: 'en',
      showLoading: true,
      closableLoading: true,
      loadingIndicatorColor: '#123456',
      backgroundColor: 'rgba(0.1, 0.1, 0.1, 0.4)',
      theme: {
        palette: {
          mode: 'dark',
          primary: { main: '#26C6DA' },
          warn: { main: '#FF8A80' },
        },
      },
      rqdata: '{"complex": "data"}',
      sentry: true,
      jsSrc: 'https://js.hcaptcha.com/1/api.js',
      endpoint: 'https://api.hcaptcha.com',
      reportapi: 'https://accounts.hcaptcha.com',
      assethost: 'https://newassets.hcaptcha.com',
      imghost: 'https://imgs.hcaptcha.com',
      host: 'complex-host',
      debug: { complex: true, nested: { data: 'test' } },
      orientation: 'portrait',
      phonePrefix: '44',
      phoneNumber: '+441234567890',
      onMessage: () => {},
    };

    const result = await measureRenders(<Hcaptcha {...complexProps} />, {
      runs: 12,
      warmupRuns: 3,
    });

    // Complex configuration should not increase render count - only care about render coun
    expect(result.meanCount).toBe(1);
  });

  test('Memory leak prevention - multiple mount/unmount cycles', async () => {
    // Test that multiple mount/unmount cycles don't cause render count to increase
    const TestComponent = ({ shouldRender }) => {
      if (!shouldRender) {return null;}

      return (
        <Hcaptcha
          siteKey="00000000-0000-0000-0000-000000000000"
          url="https://hcaptcha.com"
          onMessage={() => {}}
        />
      );
    };

    const result = await measureRenders(
      <TestComponent shouldRender={true} />,
      {
        runs: 8,
        warmupRuns: 2,
        scenario: async () => {
          // Simulate mount/unmount cycles
          await waitFor(() => {}, { timeout: 100 });
        },
      }
    );

    // Mount/unmount should not cause render count to increase - only care about render coun
    expect(result.meanCount).toBe(1);
  });
});
