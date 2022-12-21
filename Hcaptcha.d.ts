import React from "react"
import { StyleProp, ViewStyle } from "react-native";
import { WebViewMessageEvent } from "react-native-webview";

type HcaptchaProps = {
  /**
   * The hCaptcha siteKey
   */
  siteKey: string;
  /**
   * The url domain defined on your hCaptcha. You generally will not need to change this.
   */
  url?: string;
  /**
   * The callback function that runs after receiving a response, error, or when user cancels.
   */
  onMessage?: (event: WebViewMessageEvent) => void;
  /**
   * Default language for hCaptcha; overrides phone defaults.
   * A complete list of supported languages and their codes can be found [here](https://docs.hcaptcha.com/languages/)
   */
  languageCode?: string;
  /**
   * Whether to show a loading indicator while the hCaptcha web content loads
   */
  showLoading?: boolean;
  /**
   * Color of the ActivityIndicator
   */
  loadingIndicatorColor?: string;
  /**
   * The background color code that will be applied to the main HTML element
   */
  backgroundColor?: string;
  /**
   * The theme can be 'light', 'dark', 'contrast' or a custom theme object (see Enterprise docs)
   */
  theme?: 'light' | 'dark' | 'contrast' | Object;
  /**
   * Hcaptcha execution options (see Enterprise docs)
   */
  rqdata?: string;
  /**
   * The webview style
   */
  style?: StyleProp<ViewStyle>
}

export default class Hcaptcha extends React.Component<HcaptchaProps> {}
