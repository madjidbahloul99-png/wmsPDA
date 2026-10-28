import AsyncStorage from '@react-native-async-storage/async-storage';

export const USER_TOKEN_STORAGE_KEY = 'userToken';


type JwtLoginData = {
  token?: string;
  userCode?: string;
  userName?: string;
  role?: string;
  permissions?: string[];
  Token?: string;
};

type JwtLoginResponse = {
  code?: number | string;
  Code?: number | string;
  message?: string;
  Message?: string;
  msg?: string;
  Msg?: string;
  data?: JwtLoginData;
  Data?: JwtLoginData;
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

    const url = `${baseUrl.replace(/\/+$/, '')}/api/auth/login`;
    console.info('[JWT] Login request started:', url);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ UserCode: userCode, Password: password }),
    });

    const result = (await response
      .json()
      .catch(() => null)) as JwtLoginResponse | null;
    const code = result?.code ?? result?.Code;
    const data = result?.data ?? result?.Data;
    const token = data?.token ?? data?.Token;
    const message =
      result?.message ?? result?.Message ?? result?.msg ?? result?.Msg ?? '';

    const responseSummary = {
      status: response.status,
      code: code ?? null,
      message,
      responseKeys:
        result && typeof result === 'object' ? Object.keys(result) : [],
      dataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
      tokenReceived: Boolean(token),
    };
    console.info('[JWT] Login response:', JSON.stringify(responseSummary));

    if (!response.ok) {
      throw new Error(
        `JWT login HTTP request failed (${response.status})${
          message ? `: ${message}` : ''
        }`,
      );
    }
    if (Number(code) !== 200) {
      throw new Error(
        `JWT login API returned code ${code ?? 'missing'}${
          message ? `: ${message}` : ''
        }`,
      );
    }
    if (!token) {
      throw new Error(
        `JWT login returned code 200 but no token was found (response keys: ${
          responseSummary.responseKeys.join(', ') || 'none'
        }; data keys: ${responseSummary.dataKeys.join(', ') || 'none'}).`,
      );
    }

    await AsyncStorage.setItem(USER_TOKEN_STORAGE_KEY, token);
    console.info('[JWT] Login succeeded; token saved.');
    return token;
  } catch (error) {
    await AsyncStorage.removeItem(USER_TOKEN_STORAGE_KEY).catch(
      () => undefined,
    );
    console.error('[JWT] Login failed:', error);
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
