declare global {
  interface Window {
    __liveblocksUserInfo?: {
      userId: string;
      memberId: string;
      userName: string;
      userAvatar?: string;
    };
  }
}

export {};
