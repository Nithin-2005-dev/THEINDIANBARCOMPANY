import {
  detectMultilingualSignal,
  detectSourceLanguage,
} from './assistant-language';

describe('assistant language detection', () => {
  it('detects Hinglish from mixed Hindi-English prompts', () => {
    expect(
      detectSourceLanguage('Mujhe Hyderabad mein 50 logon ka corporate event chahiye'),
    ).toBe('Hinglish');
    expect(detectMultilingualSignal('Unread chats dikhao')).toBe(true);
    expect(detectMultilingualSignal('Payment kitna pending hai')).toBe(true);
    expect(detectMultilingualSignal('Ye booking stuck lag rahi hai')).toBe(true);
    expect(detectMultilingualSignal('Indoor hi rakhna')).toBe(true);
    expect(detectMultilingualSignal('Hyderabad wala booking dikhao')).toBe(true);
  });

  it('detects Hindi from Devanagari text', () => {
    expect(detectSourceLanguage('हैदराबाद में 50 लोगों का कॉर्पोरेट इवेंट चाहिए')).toBe(
      'Hindi',
    );
  });

  it('keeps plain English operational prompts as English', () => {
    expect(detectSourceLanguage('Show unread chats')).toBe('English');
    expect(detectMultilingualSignal('Show unread chats')).toBe(false);
  });
});
