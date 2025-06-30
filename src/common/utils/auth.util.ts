export const generateVerificationCode = (length: number = 8): string => {
  const characters = "0123456789";
  let verificationCode = "";
  for (let i = 0; i < length; i++) {
    verificationCode += characters.charAt(
      Math.floor(Math.random() * characters.length)
    );
  }
  return verificationCode;
};
