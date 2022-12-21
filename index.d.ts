import React from "react"
import { HcaptchaProps } from './Hcaptcha'

type ConfirmHcaptchaProps = Omit<HcaptchaProps, 'url' | 'style'> & {
  /**
   * Indicates whether the passive mode is enabled; when true, the modal won't be shown at all
   */
  passiveSiteKey?: boolean;
  /**
   * The url domain defined on your hCaptcha. You generally will not need to change this.
   */
  baseUrl?: string;
}

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
}
