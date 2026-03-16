export type SmsSendPayload = {
  phoneNumber: string;
  message: string;
};

export type SmsSendResult = {
  provider: string;
  messageId?: string;
};
