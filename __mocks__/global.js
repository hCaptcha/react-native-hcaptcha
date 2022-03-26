jest.mock('react-native-modal', () => 'Modal');
jest.mock('react-native-webview', () => 'WebView');
jest.mock('react', () => {
  let ActualReact = jest.requireActual('react');
  return {
    ...ActualReact,
    useMemo: jest.fn()
      .mockImplementation(ActualReact.useMemo)
      .mockImplementationOnce(() => ActualReact.useMemo(() => ["test_key"], []))
  }
});