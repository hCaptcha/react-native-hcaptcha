jest.mock('react-native-webview');
jest.mock('@hcaptcha/loader/inline', () => ({
  __esModule: true,
  default: 'window.__hcaptcha_loader_inline__ = true;',
}));
jest.mock('react', () => {
  let ActualReact = jest.requireActual('react');
  return {
    ...ActualReact,
    useMemo: jest.fn()
      .mockImplementation(ActualReact.useMemo)
      .mockImplementationOnce(() => ActualReact.useMemo(() => ['test_key'], [])),
  };
});
jest.mock('react-native/Libraries/Core/ReactNativeVersion', () => {
  return { version: { major: 0, minor: 0, patch: 0 } };
});
jest.mock('../md5', () => () => 'mocked-md5');
