import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import md5 from 'md5';

/* ==========================================================================
   Equivalent implementation of C# pubfunction utility class in TypeScript
========================================================================== */

export const globalstr = {
  gs_userCode: "",
  gs_userName: "",
  gs_randomNumber: "2",
  gs_PasswordSalt: "abc12345",
  gs_version: "1.0.0",
  appConfig: {
    languageType: "en_US"
  }
};

/**
 * Encodes special characters for POST transmission as done in C# HttpWebRequest.
 */
export const PostSpecialStr = (barcode: string): string => {
  if (!barcode) return "";
  let newStr = barcode;
  newStr = newStr.replace(/%/g, "%25");
  newStr = newStr.replace(/#/g, "%23");
  newStr = newStr.replace(/&/g, "%26");
  newStr = newStr.replace(/\+/g, "%2B");
  newStr = newStr.replace(/\\/g, "%2F");
  newStr = newStr.replace(/=/g, "%3D");
  newStr = newStr.replace(/\?/g, "%3F");
  newStr = newStr.replace(/ /g, " ");
  return newStr;
};

/**
 * Reads AppConfig configuration dynamically using AsyncStorage.
 */
export const ReadAppConfig = async (): Promise<any | null> => {
  try {
    const configStr = await AsyncStorage.getItem("appConfig");
    return configStr ? JSON.parse(configStr) : null;
  } catch (e) {
    console.error("ReadAppConfig error:", e);
    return null;
  }
};

/**
 * Writes AppConfig configuration dynamically into AsyncStorage.
 */
export const WriteAppConfig = async (appConfig: any): Promise<boolean> => {
  try {
    await AsyncStorage.setItem("appConfig", JSON.stringify(appConfig));
    return true;
  } catch (e) {
    console.error("WriteAppConfig error:", e);
    return false;
  }
};

/**
 * Checks if key represents a double or valid numeric value.
 */
export const isNum = (inputstr: string): boolean => {
  if (!inputstr) return false;
  const num = Number(inputstr);
  return !isNaN(num);
};

/**
 * Shows an information/error popup to the user.
 */
export const ShowError = (msg: string): void => {
  Alert.alert("Info", msg);
};

/**
 * Shows a confirmation dialog choice popup.
 */
export const ShowConfirm = (msg: string): Promise<boolean> => {
  return new Promise((resolve) => {
    Alert.alert(
      "Confirm",
      msg,
      [
        { text: "Cancel", onPress: () => resolve(false), style: "cancel" },
        { text: "OK", onPress: () => resolve(true) }
      ],
      { cancelable: false }
    );
  });
};

/**
 * Gets path representing execution root equivalent.
 */
export const GetAppStartupPath = (): string => {
  return "./";
};

/**
 * Gets path representing PC execution root equivalent.
 */
export const GetAppPathPc = (): string => {
  return "./";
};

/**
 * MD5 hashing helper function.
 */
export const MD5 = (password: string): string => {
  return md5(password);
};

/**
 * Encrypt password using password text concatenated with salt from globalstr.
 */
export const GetPasswordEncrypt = (password: string): string => {
  return MD5(password + globalstr.gs_PasswordSalt);
};

/**
 * Generates parameters for user signature using globalstr parameters.
 */
export const GetUserSign = (addchar: string): string => {
  let urlCur = "";
  let usercode = "";
  let username = "";
  
  if (globalstr.gs_userCode === "") {
    usercode = "admin";
    username = "admin";
  } else {
    usercode = globalstr.gs_userCode;
    username = globalstr.gs_userName;
  }

  const signStr = MD5(usercode + username + globalstr.gs_randomNumber + globalstr.gs_PasswordSalt);
  urlCur = urlCur + addchar + "operatorUser=" + usercode;
  urlCur = urlCur + "&operatorUserName=" + username;
  urlCur = urlCur + "&randomNumber=" + globalstr.gs_randomNumber;
  urlCur = urlCur + "&sign=" + signStr;
  urlCur = urlCur + "&version=" + globalstr.gs_version;
  urlCur = urlCur + "&languageType=" + globalstr.appConfig.languageType;
  return urlCur;
};

/**
 * Decorates request model with signature attributes properties.
 */
export const SetUserSignInfo = <T extends Record<string, any>>(
  model: T,
  userCode: string,
  userName: string,
  randomNumber: string,
  passwordSalt: string,
  version: string,
  languageType: string
): T => {
  const finalUser = userCode || globalstr.gs_userCode || "admin";
  const finalName = userName || globalstr.gs_userName || finalUser;
  // Use globalstr for random number to ensure correct signature even if callers pass "2"
  const finalRandom = globalstr.gs_randomNumber || randomNumber || "2";
  const finalSalt = passwordSalt || globalstr.gs_PasswordSalt || "abc12345";
  const finalVersion = version || globalstr.gs_version || "1.0.0";
  const finalLang = languageType || globalstr.appConfig.languageType || "en_US";

  const signStr = MD5(finalUser + finalName + finalRandom + finalSalt);

  return {
    ...model,
    operatorUser: finalUser,
    operatorUserName: finalName,
    randomNumber: finalRandom,
    sign: signStr,
    version: finalVersion,
    languageType: finalLang,
  };
};

/**
 * Concatenates query name and value into existing endpoint url reference string.
 */
export const AddUrlQuery = (urlCur: string, addchar: string, queryName: string, queryValue: string): string => {
  return urlCur + addchar + encodeURIComponent(queryName) + "=" + encodeURIComponent(queryValue);
};

/**
 * Determines barcode classification type.
 */
export const getBarcodeType = (SN: string): "PALLET" | "BOX" | "SN" => {
  if (!SN) return "SN";
  const firstLetter = SN.substring(0, 1).toUpperCase();
  if (firstLetter === "P") {
    return "PALLET";
  } else if (firstLetter === "C") {
    return "BOX";
  } else {
    return "SN";
  }
};

/**
 * Looks up column index by matching header columns array list text.
 */
export const GetListColndex = (columns: Array<{ text: string }>, colText: string): number => {
  for (let i = 0; i < columns.length; i++) {
    if (columns[i].text.toLowerCase().trim() === colText.toLowerCase().trim()) {
      return i;
    }
  }
  return 0;
};

/**
 * Formats a plain object key value mapping into a web URL query string.
 */
export const classToUrlStr = (model: Record<string, any>): string => {
  let url = "";
  for (const [key, value] of Object.entries(model)) {
    const valueStr = value === null || value === undefined ? "" : String(value);
    if (url !== "") {
      url += "&" + key + "=" + encodeURIComponent(valueStr);
    } else {
      url += key + "=" + encodeURIComponent(valueStr);
    }
  }
  return url;
};
