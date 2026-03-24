import CryptoJS from 'crypto-js';

const SECRET_KEY = 'secure-pass-manager-key'; // In production, this should be more dynamic or user-specific

export const encrypt = (text: string) => {
  return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
};

export const decrypt = (ciphertext: string) => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    return 'Decryption Error';
  }
};
