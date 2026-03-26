import React from 'react';
import Hcaptcha, { HcaptchaProps } from './Hcaptcha';

export type JourneyRuntimeStats = {
  activeConsumers: number;
  bufferedEvents: number;
  capturing: boolean;
  currentRoute: { key?: string; name: string } | null;
  initialized: boolean;
  wrapperInstalled: boolean;
};

export type JourneyTrackingOptions = {
  navigationContainerRef?: unknown;
  debug?: boolean;
  onStats?: (stats: JourneyRuntimeStats) => void;
};

type ConfirmHcaptchaProps = Omit<HcaptchaProps, 'url' | 'style'> & {
  /**
   * Indicates whether the passive mode is enabled; when true, the modal won't be shown at all
   */
  passiveSiteKey?: boolean;
  /**
   * The url domain defined on your hCaptcha. You generally will not need to change this.
   */
  baseUrl?: string;
  /**
   * Defines if the modal backdrop is shown (true by default). If `hasBackdrop=false`,
   * `backgroundColor` will apply only after the hCaptcha visual challenge is presented.
   */
  hasBackdrop?: boolean;
  /**
   * Defines if the view containing the hCaptcha should use a SafeAreaView or a View component (true by default)
   */
  useSafeAreaView?: boolean;
};

export default class ConfirmHcaptcha extends React.Component<ConfirmHcaptchaProps> {
  /**
   * Shows the modal containing the challenge
   */
  show: () => void;
  /**
   * Hides the modal containing the challenge. Do not pass any argument to trigger
   * the onMessage `cancel` event
   */
  hide: (source?: any) => void;
  /**
   * Stops automatic event recording for this captcha instance.
   */
  stopEvents: () => void;
}

export function initJourneyTracking(options?: JourneyTrackingOptions): void;

export function registerJourneyNavigationContainer(ref: unknown): void;

export { Hcaptcha };
