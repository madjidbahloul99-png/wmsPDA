/**
 * REST Client for PalletSearch (Frm_KucunNew) flow in src2
 * Provides HTTP POST constructs.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as pubfunction from "../pubfunction";

const doRestPost = async (url: string, body: any): Promise<any> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
   body: pubfunction.classToUrlStr(body),
  });

  if (!response.ok) {
    pubfunction.ShowError(`REST Post failed: HTTP ${response.status}`);
    return null;
  }


  return await response.json();
};

export const getScanBarCodeSumInfo = async (
  baseUrl: string,
  warehouseCode: string,
  scanBarCode: string,
  scanBarCodeType: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/warehouse/billInfo/getScanBarCodeSumInfo`;

  const qo = {
    billCode: "",
    billType: "",
    warehouseCode: warehouseCode,
    scanBarCode: pubfunction.PostSpecialStr(scanBarCode),
    scanBarCodeType: scanBarCodeType,
    model: "0"
  };

  const signedQo = pubfunction.SetUserSignInfo(
    qo,
    userCode,
    userName,
    "2",
    passwordSalt,
    version,
    "en_US"
  );

  try {
    const res = await doRestPost(url, signedQo);
    if (res && res.success) {
      const listObj = typeof res.list === "string" ? JSON.parse(res.list) : res.list;
      return { success: true, list: listObj };
    }
    return { success: false, msg: res?.msg || "Failed to load scan barcode sum info" };
  } catch (err: any) {
    pubfunction.ShowError(err.message);
    return { success: false, msg: "Network Error" };
  }
};
