import { buildDebugInfo, buildVerifyData } from '../Hcaptcha';

describe('buildVerifyData', () => {
  it('maps legacy props to the final wire keys', () => {
    expect(buildVerifyData({
      rqdata: '{"some":"data"}',
      phonePrefix: '44',
      phoneNumber: '+441234567890',
    })).toEqual({
      rqdata: '{"some":"data"}',
      mfa_phoneprefix: '44',
      mfa_phone: '+441234567890',
    });
  });

  it('prefers verifyParams over legacy props', () => {
    expect(buildVerifyData({
      rqdata: 'legacy-rqdata',
      phonePrefix: '11',
      phoneNumber: '+111',
      verifyParams: {
        rqdata: 'preferred-rqdata',
        phonePrefix: '44',
        phoneNumber: '+44123',
      },
    })).toEqual({
      rqdata: 'preferred-rqdata',
      mfa_phoneprefix: '44',
      mfa_phone: '+44123',
    });
  });

  it('backfills missing verifyParams fields from legacy props', () => {
    expect(buildVerifyData({
      rqdata: 'legacy-rqdata',
      phonePrefix: '44',
      phoneNumber: '+44123',
      verifyParams: {
        rqdata: 'preferred-rqdata',
      },
    })).toEqual({
      rqdata: 'preferred-rqdata',
      mfa_phoneprefix: '44',
      mfa_phone: '+44123',
    });
  });

  it('includes userjourney only when events exist', () => {
    expect(buildVerifyData({
      userJourney: [],
    })).toEqual({});

    expect(buildVerifyData({
      userJourney: [
        { ts: 123, k: 'click', v: 'View', m: { id: 'screen', ac: 'tap' } },
      ],
    })).toEqual({
      userjourney: [
        { ts: 123, k: 'click', v: 'View', m: { id: 'screen', ac: 'tap' } },
      ],
    });
  });
});

describe('buildDebugInfo', () => {
  it('adds sdk and dependency markers even when the RN version shape is missing', () => {
    expect(buildDebugInfo({ custom: true }, {})).toEqual({
      custom: true,
      'dep_mocked-md5': true,
      rnver_0_0_0: true,
      sdk_4_0_0: true,
    });
  });

  it('adds the normalized RN version marker when available', () => {
    expect(buildDebugInfo({}, { version: { major: 1, minor: 2, patch: 3 } })).toEqual({
      rnver_1_2_3: true,
      'dep_mocked-md5': true,
      sdk_4_0_0: true,
    });
  });
});
