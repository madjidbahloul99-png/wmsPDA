import AsyncStorage from '@react-native-async-storage/async-storage';

export const USER_TOKEN_STORAGE_KEY = 'userToken';

type JwtLoginResponse = {
  code?: number | string;
  Code?: number | string;
  message?: string;
  Message?: string;
  data?: { token?: string; Token?: string };
  Data?: { token?: string; Token?: string };
};

/** Authenticate against the JWT API and persist its access token. */
export const loginWithJwt = async (
  baseUrl: string,
  userCode: string,
  password: string,
): Promise<string> => {
  try {
    // Do not leave a previous user's token behind if this login fails.
    await AsyncStorage.removeItem(USER_TOKEN_STORAGE_KEY);

    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ UserCode: userCode, Password: password }),
    });

    const result = (await response.json().catch(() => null)) as JwtLoginResponse | null;
    const code = result?.code ?? result?.Code;
    const data = result?.data ?? result?.Data;
    const token = data?.token ?? data?.Token;

    if (!response.ok || Number(code) !== 200 || !token) {
      throw new Error(result?.message ?? result?.Message ?? `JWT login failed (${response.status})`);
    }

    await AsyncStorage.setItem(USER_TOKEN_STORAGE_KEY, token);
    return token;
  } catch (error) {
    await AsyncStorage.removeItem(USER_TOKEN_STORAGE_KEY).catch(() => undefined);
    throw error;
  }
};

/** Remove the JWT when the user exits the signed-in app session. */
export const clearJwtToken = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(USER_TOKEN_STORAGE_KEY);
  } catch (error) {
    console.warn('Could not remove the saved JWT token.', error);
  }
};
